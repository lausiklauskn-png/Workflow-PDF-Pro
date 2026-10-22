import Foundation
import CryptoKit
import Darwin

public enum DocumentVaultFailure: String, Error {
    case locked = "VAULT_LOCKED"
    case password = "VAULT_PASSWORD"
    case passwordShort = "VAULT_PASSWORD_SHORT"
    case busy = "VAULT_BUSY"
    case damaged = "VAULT_DAMAGED"
    case notFound = "VAULT_RECORD_NOT_FOUND"
    case changed = "VAULT_RECORD_CHANGED"
    case invalid = "VAULT_INVALID_RECORD"
}

/// Portable folder/index contract shared with Android and Windows. Provider
/// access always goes through VaultFolder. Serial callers only; no UI or JS keys.
public final class DocumentVault {
    public static let format = "workflow-pdf-pro-vault"
    public static let headerName = "workflow-pdf-pro.tresor.json"
    public static let stores = ["folders", "docs", "files", "texte", "vektoren", "settings"]
    public struct Reference: Codable, Equatable {
        public let id: String
        public let vaultId: String
        public let hash: String
    }
    public struct Record: Codable, Equatable {
        public let store: String
        public let id: String
        public let file: String
        public let size: UInt64
        public let hash: String
        public let reference: Reference?
    }
    private struct Header: Codable {
        let app: String; let v: Int; let id: String; let iterations: Int
        let salt: Data; let wrapped: Data
    }
    private struct Marker: Codable { let index: String; let revision: UInt64 }
    private struct Envelope: Codable {
        let app: String; let v: Int; let revision: UInt64; let records: [String: Record]
    }
    public struct Checkpoint: Codable {
        public let id: String
        public let revision: UInt64
        // Optional only to read checkpoints from an earlier app build.
        public let hash: String?
    }
    public struct RecoveryInfo: Codable {
        public let app: String; public let v: Int; public let id: String
        public let set: String; public let n: Int; public let k: Int
        public let created: UInt64; public let wrapped: Data
    }
    private struct Pending {
        let store: String; let id: String; let reference: Reference?
        let file: URL; var size: UInt64
    }
    private let folder: VaultFolder
    private let scratch: URL
    private let checkpoint: URL
    private var key: SymmetricKey?
    public private(set) var identity = ""
    public private(set) var revision: UInt64 = 0
    public private(set) var generationHash: String?
    private var generationMarker: String?
    private var records: [String: Record] = [:]
    private var batch: [String: Record]?
    private var batchFiles = Set<String>()
    private var pending: [String: Pending] = [:]
    private var setupFiles: [String]?
    public var unlocked: Bool { key != nil }
    public var busy: Bool { batch != nil || !pending.isEmpty }

    public init(folder: VaultFolder, scratch: URL, checkpoint: URL) throws {
        self.folder = folder; self.scratch = scratch; self.checkpoint = checkpoint
        try FileManager.default.createDirectory(at: scratch, withIntermediateDirectories: true)
    }
    private func logical(_ name: String) -> String { Self.format + ":" + identity + ":" + name }
    private func require() throws -> SymmetricKey {
        guard let key = key else { throw DocumentVaultFailure.locked }
        let names = try folder.names() // Missing provider never becomes an empty record set.
        if revision > 0 {
            let commits = commitNames(names)
            guard let newest = commits.last, newest == generationMarker,
                  commits.filter({ $0.hasPrefix(String(format: "commit-%020llu-", revision)) }).count == 1 else { throw DocumentVaultFailure.changed }
        }
        return key
    }
    private func commitNames(_ names: [String]) -> [String] {
        names.filter { $0.range(of: "^commit-[0-9]{20}-[0-9a-f-]{36}\\.json$", options: .regularExpression) != nil }.sorted()
    }
    private func recordName(_ store: String, _ id: String) throws -> String {
        guard Self.stores.contains(store), !id.isEmpty else { throw DocumentVaultFailure.invalid }
        return store + ":" + id
    }
    private func fileName(_ name: String) throws {
        guard name.hasSuffix(".wpv"), UUID(uuidString: String(name.dropLast(4))) != nil,
              name == name.lowercased() else { throw DocumentVaultFailure.damaged }
    }
    private func small<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        try folder.read(name) { url in
            guard let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize, size <= 65_536 else { throw DocumentVaultFailure.damaged }
            return try JSONDecoder().decode(type, from: Data(contentsOf: url))
        }
    }
    private func temporary() -> URL { scratch.appendingPathComponent(UUID().uuidString.lowercased()) }
    private func encode<T: Encodable>(_ value: T) throws -> Data {
        let encoder = JSONEncoder()
        // Match the canonical unescaped Base64 strings emitted by Android and
        // Windows, including their existing pure-Java compatibility reader.
        encoder.outputFormatting = [.withoutEscapingSlashes]
        return try encoder.encode(value)
    }
    private func publish<T: Encodable>(_ value: T, name: String) throws {
        let local = temporary()
        defer { try? FileManager.default.removeItem(at: local) }
        try encode(value).write(to: local, options: .atomic)
        try folder.createVerified(name, from: local)
        if setupFiles != nil { setupFiles?.append(name) }
    }
    private func validate(_ header: Header) throws {
        guard header.app == Self.format, header.v == 1, UUID(uuidString: header.id) != nil,
              header.id == header.id.lowercased(), (100_000...10_000_000).contains(header.iterations),
              header.salt.count == 16, header.wrapped.count == 60 else { throw DocumentVaultFailure.damaged }
    }
    private func passwordKey(_ header: Header, password: String) throws -> SymmetricKey {
        try validate(header)
        let derived = try VaultCrypto.passwordKey(password, salt: header.salt, rounds: header.iterations)
        var data: Data
        do { data = try VaultCrypto.open(header.wrapped, key: derived, aad: Data(logical("password").utf8)) }
        catch { throw DocumentVaultFailure.password }
        defer { data.resetBytes(in: 0..<data.count) }
        guard data.count == 32 else { throw DocumentVaultFailure.damaged }
        return SymmetricKey(data: data)
    }
    public func open(password: String) throws {
        guard !busy else { throw DocumentVaultFailure.busy }
        lock()
        let header = try small(Self.headerName, as: Header.self)
        try validate(header); identity = header.id
        do {
            do { key = try passwordKey(header, password: password) }
            catch DocumentVaultFailure.password {
                // Password slots created by 3-of-5 recovery preserve the header.
                for name in try folder.names().sorted() where name.hasPrefix("workflow-pdf-pro.kennwort-") && name.hasSuffix(".json") {
                    let suffix = String(name.dropFirst("workflow-pdf-pro.kennwort-".count).dropLast(5))
                    guard UUID(uuidString: suffix) != nil else { continue }
                    let slot = try small(name, as: Header.self)
                    guard slot.id == identity else { continue }
                    if let candidate = try? passwordKey(slot, password: password) { key = candidate; break }
                }
                guard key != nil else { throw DocumentVaultFailure.password }
            }
            try loadIndex()
        } catch { lock(); throw error }
    }
    public func open(rememberedKey: SymmetricKey) throws {
        guard !busy else { throw DocumentVaultFailure.busy }
        lock()
        let header = try small(Self.headerName, as: Header.self)
        try validate(header); identity = header.id; key = rememberedKey
        do { try loadIndex() } catch { lock(); throw error }
    }
    public func initialize(password: String) throws {
        guard !busy else { throw DocumentVaultFailure.busy }
        guard password.precomposedStringWithCanonicalMapping.unicodeScalars.count >= 10 else { throw DocumentVaultFailure.passwordShort }
        guard try folder.names().isEmpty, !FileManager.default.fileExists(atPath: checkpoint.path) else { throw VaultFolderFailure.exists }
        lock(); identity = UUID().uuidString.lowercased(); key = SymmetricKey(size: .bits256)
        setupFiles = []
        do {
            let salt = SymmetricKey(size: .bits128).withUnsafeBytes { Data($0) }
            let derived = try VaultCrypto.passwordKey(password, salt: salt)
            var raw = try require().withUnsafeBytes { Data($0) }
            defer { raw.resetBytes(in: 0..<raw.count) }
            let header = Header(app: Self.format, v: 1, id: identity, iterations: VaultCrypto.iterations, salt: salt,
                                wrapped: try VaultCrypto.seal(raw, key: derived, aad: Data(logical("password").utf8)))
            try commit([:])
            try publish(header, name: Self.headerName)
            setupFiles = nil
        } catch {
            for name in (setupFiles ?? []).reversed() { try? folder.remove(name) }
            setupFiles = nil
            try? FileManager.default.removeItem(at: checkpoint)
            lock(); throw error
        }
    }
    public func dataKey() throws -> SymmetricKey { try require() }
    public func recoveryInfo() throws -> RecoveryInfo? {
        _ = try require()
        let names = try recoveryNames()
        guard names.count <= 1 else { throw DocumentVaultFailure.damaged }
        guard let name = names.first else { return nil }
        let info = try small(name, as: RecoveryInfo.self)
        try validateRecovery(info, name: name)
        return info
    }
    private func recoveryNames() throws -> [String] {
        try folder.names().filter { $0.range(of: "^workflow-pdf-pro\\.ersatz-[0-9a-f]{8}\\.json$", options: .regularExpression) != nil }
    }
    private func validateRecovery(_ info: RecoveryInfo, name: String) throws {
        guard info.app == Self.format, info.v == 1, info.id == identity,
              info.n == 5, info.k == 3, info.wrapped.count == 60,
              name == "workflow-pdf-pro.ersatz-" + info.set + ".json" else { throw DocumentVaultFailure.damaged }
    }
    public func createRecovery() throws -> [String] {
        let dataKey = try require()
        guard !busy else { throw DocumentVaultFailure.busy }
        let previous = try recoveryNames()
        for name in previous { try validateRecovery(small(name, as: RecoveryInfo.self), name: name) }
        let secret = SymmetricKey(size: .bits256)
        var rawSecret = secret.withUnsafeBytes { Data($0) }, rawData = dataKey.withUnsafeBytes { Data($0) }
        defer { rawSecret.resetBytes(in: 0..<rawSecret.count); rawData.resetBytes(in: 0..<rawData.count) }
        let set = SymmetricKey(size: .bits128).withUnsafeBytes { Data($0.prefix(4)) }
        let setHex = set.map { String(format: "%02x", $0) }.joined()
        let shares = try VaultRecovery.split(rawSecret, set: set)
        let info = RecoveryInfo(app: Self.format, v: 1, id: identity, set: setHex, n: 5, k: 3,
            created: UInt64(Date().timeIntervalSince1970 * 1000),
            wrapped: try VaultCrypto.seal(rawData, key: secret, aad: Data(logical("recovery:" + setHex).utf8)))
        let name = "workflow-pdf-pro.ersatz-" + setHex + ".json"
        try publish(info, name: name)
        let back = try small(name, as: RecoveryInfo.self)
        try validateRecovery(back, name: name)
        var checked = try VaultCrypto.open(back.wrapped, key: secret, aad: Data(logical("recovery:" + setHex).utf8))
        defer { checked.resetBytes(in: 0..<checked.count) }
        guard checked == rawData, try VaultRecovery.combine(Array(shares.prefix(3))) == rawSecret else { throw DocumentVaultFailure.damaged }
        for old in previous { try folder.remove(old) }
        return shares.map(VaultRecovery.encode)
    }
    public func recover(shares: [String], newPassword: String) throws {
        guard !busy else { throw DocumentVaultFailure.busy }
        guard newPassword.precomposedStringWithCanonicalMapping.unicodeScalars.count >= 10 else { throw DocumentVaultFailure.passwordShort }
        let decoded = try shares.map(VaultRecovery.decode)
        var secret = try VaultRecovery.combine(decoded)
        defer { secret.resetBytes(in: 0..<secret.count) }
        let set = decoded[0].set.map { String(format: "%02x", $0) }.joined()
        lock()
        do {
            let header = try small(Self.headerName, as: Header.self)
            try validate(header); identity = header.id
            let name = "workflow-pdf-pro.ersatz-" + set + ".json"
            let info = try small(name, as: RecoveryInfo.self)
            try validateRecovery(info, name: name)
            guard info.k == Int(decoded[0].threshold) else { throw RecoveryFailure.mixed }
            var raw = try VaultCrypto.open(info.wrapped, key: SymmetricKey(data: secret), aad: Data(logical("recovery:" + set).utf8))
            defer { raw.resetBytes(in: 0..<raw.count) }
            guard raw.count == 32 else { throw DocumentVaultFailure.damaged }
            key = SymmetricKey(data: raw)
            try loadIndex() // Verify the archive before publishing a new slot.
            let salt = SymmetricKey(size: .bits128).withUnsafeBytes { Data($0) }
            let derived = try VaultCrypto.passwordKey(newPassword, salt: salt)
            let slot = Header(app: Self.format, v: 1, id: identity, iterations: VaultCrypto.iterations, salt: salt,
                              wrapped: try VaultCrypto.seal(raw, key: derived, aad: Data(logical("password").utf8)))
            try publish(slot, name: "workflow-pdf-pro.kennwort-" + UUID().uuidString.lowercased() + ".json")
        } catch { lock(); throw error }
    }
    public func lock() {
        abortBatch()
        for item in pending.values { try? FileManager.default.removeItem(at: item.file) }
        pending = [:]; batch = nil; records = [:]; key = nil; revision = 0
        generationHash = nil; generationMarker = nil
    }
    /// Native continuity evidence, read without resolving a revoked folder grant.
    public static func savedCheckpoint(at url: URL) throws -> Checkpoint? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let values = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey])
        guard values.isRegularFile == true, values.isSymbolicLink != true,
              let size = values.fileSize, size <= 4096 else { throw DocumentVaultFailure.damaged }
        let stored = try JSONDecoder().decode(Checkpoint.self, from: Data(contentsOf: url))
        guard UUID(uuidString: stored.id) != nil, stored.id == stored.id.lowercased(),
              stored.revision > 0, stored.revision <= UInt64(Int64.max),
              stored.hash.map({ $0.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil }) ?? true else {
            throw DocumentVaultFailure.damaged
        }
        return stored
    }
    private func loadIndex() throws {
        let names = commitNames(try folder.names())
        guard let newest = names.last else { throw DocumentVaultFailure.damaged }
        let marker = try small(newest, as: Marker.self)
        guard marker.revision > 0, marker.revision <= UInt64(Int64.max),
              newest.hasPrefix(String(format: "commit-%020llu-", marker.revision)) else { throw DocumentVaultFailure.damaged }
        guard names.filter({ $0.hasPrefix(String(format: "commit-%020llu-", marker.revision)) }).count == 1 else { throw DocumentVaultFailure.damaged }
        let stored = try Self.savedCheckpoint(at: checkpoint)
        if let stored = stored {
            guard stored.id == identity, marker.revision >= stored.revision else { throw DocumentVaultFailure.damaged }
        }
        try fileName(marker.index)
        let key = try require()
        let (envelope, hash): (Envelope, String) = try folder.read(marker.index) { url in
            let reader = try VaultCrypto.Reader(url: url, key: key, name: logical("index"))
            var bytes = Data()
            for index in 0..<max(1, (reader.size + UInt64(VaultCrypto.chunk) - 1) / UInt64(VaultCrypto.chunk)) { bytes.append(try reader.block(index)) }
            return (try JSONDecoder().decode(Envelope.self, from: bytes), SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined())
        }
        guard envelope.app == Self.format, envelope.v == 1, envelope.revision == marker.revision else { throw DocumentVaultFailure.damaged }
        for (name, record) in envelope.records {
            guard name == (try recordName(record.store, record.id)), record.hash.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil else { throw DocumentVaultFailure.damaged }
            try fileName(record.file)
        }
        if let stored = stored, stored.revision == marker.revision, let known = stored.hash {
            guard known == hash else { throw DocumentVaultFailure.changed }
        }
        records = envelope.records; revision = marker.revision
        generationHash = hash; generationMarker = newest
        _ = try require()
        try checkpointRevision()
    }
    private func checkpointRevision() throws {
        try FileManager.default.createDirectory(at: checkpoint.deletingLastPathComponent(), withIntermediateDirectories: true)
        try encode(Checkpoint(id: identity, revision: revision, hash: generationHash)).write(to: checkpoint, options: .atomic)
        let handle = try FileHandle(forWritingTo: checkpoint)
        defer { try? handle.close() }
        try handle.synchronize()
        let descriptor = Darwin.open(checkpoint.deletingLastPathComponent().path, O_RDONLY)
        guard descriptor >= 0 else { throw VaultFolderFailure.unavailable }
        defer { Darwin.close(descriptor) }
        guard fsync(descriptor) == 0 else { throw VaultFolderFailure.unavailable }
    }
    /// Validate all generations before deleting anything. Keep the same three
    /// committed generations as Windows; unknown/uncommitted objects are retained.
    public func prune() throws {
        _ = try require()
        guard !busy, setupFiles == nil else { return }
        let names = Array(commitNames(try folder.names()).reversed())
        guard names.count > 3 else { return }
        var retained = Set<String>(), expired = Set<String>()
        for (position, name) in names.enumerated() {
            let marker = try small(name, as: Marker.self)
            guard marker.revision > 0, name.hasPrefix(String(format: "commit-%020llu-", marker.revision)) else { throw DocumentVaultFailure.damaged }
            try fileName(marker.index)
            let key = try require()
            let envelope: Envelope = try folder.read(marker.index) { url in
                let reader = try VaultCrypto.Reader(url: url, key: key, name: logical("index"))
                var bytes = Data()
                for index in 0..<max(1, (reader.size + UInt64(VaultCrypto.chunk) - 1) / UInt64(VaultCrypto.chunk)) { bytes.append(try reader.block(index)) }
                return try JSONDecoder().decode(Envelope.self, from: bytes)
            }
            guard envelope.app == Self.format, envelope.v == 1, envelope.revision == marker.revision else { throw DocumentVaultFailure.damaged }
            var owned = Set([marker.index])
            for record in envelope.records.values { try fileName(record.file); owned.insert(record.file) }
            if position < 3 { retained.formUnion(owned) } else { expired.formUnion(owned) }
        }
        for name in expired.subtracting(retained) { try folder.remove(name) }
        for name in names.dropFirst(3) { try folder.remove(name) }
    }
    private func encrypted(_ source: URL, kind: String) throws -> (String, UInt64, String) {
        let key = try require(), local = temporary(), name = UUID().uuidString.lowercased() + ".wpv"
        defer { try? FileManager.default.removeItem(at: local) }
        try VaultCrypto.encrypt(source: source, destination: local, key: key, name: logical(kind))
        let expected = try VaultCrypto.Reader(url: local, key: key, name: logical(kind))
        let hash = try expected.digest()
        try folder.createVerified(name, from: local)
        if setupFiles != nil { setupFiles?.append(name) }
        try folder.read(name) { url in
            let checked = try VaultCrypto.Reader(url: url, key: key, name: logical(kind))
            guard checked.size == expected.size, try checked.digest() == hash else { throw DocumentVaultFailure.damaged }
        }
        return (name, expected.size, hash)
    }
    private func commit(_ next: [String: Record]) throws {
        guard revision < UInt64(Int64.max) else { throw DocumentVaultFailure.damaged }
        let updated = revision + 1, source = temporary()
        defer { try? FileManager.default.removeItem(at: source) }
        try encode(Envelope(app: Self.format, v: 1, revision: updated, records: next)).write(to: source, options: .atomic)
        let (file, _, hash) = try encrypted(source, kind: "index")
        let marker = Marker(index: file, revision: updated)
        let name = String(format: "commit-%020llu-", updated) + UUID().uuidString.lowercased() + ".json"
        try publish(marker, name: name)
        records = next; revision = updated
        generationHash = hash; generationMarker = name
        _ = try require()
        // If local checkpointing fails after publication, report failure. A retry
        // must reopen the committed generation; never claim the old state saved.
        try checkpointRevision()
    }
    public func begin(store: String, id: String, reference: Reference? = nil) throws -> String {
        _ = try require(); _ = try recordName(store, id)
        guard pending.count < 128 else { throw DocumentVaultFailure.busy }
        if let reference = reference {
            guard store == "files", reference.id == id, UUID(uuidString: reference.vaultId) != nil,
                  reference.hash.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil else { throw DocumentVaultFailure.invalid }
        }
        let ticket = UUID().uuidString.lowercased(), file = temporary()
        #if os(iOS)
        try Data().write(to: file, options: [.withoutOverwriting, .completeFileProtection])
        #else
        try Data().write(to: file, options: .withoutOverwriting)
        #endif
        pending[ticket] = Pending(store: store, id: id, reference: reference, file: file, size: 0)
        return ticket
    }
    public func append(ticket: String, offset: UInt64, bytes: Data) throws {
        _ = try require()
        guard var item = pending[ticket], item.size == offset, bytes.count <= VaultCrypto.chunk else { throw WorkflowError.invalidTransfer }
        let out = try FileHandle(forWritingTo: item.file)
        defer { try? out.close() }
        guard try out.seekToEnd() == offset else { throw WorkflowError.invalidTransfer }
        try out.write(contentsOf: bytes); try out.synchronize()
        item.size += UInt64(bytes.count); pending[ticket] = item
    }
    public func abort(ticket: String) { if let item = pending.removeValue(forKey: ticket) { try? FileManager.default.removeItem(at: item.file) } }
    @discardableResult public func finish(ticket: String, size: UInt64) throws -> Record {
        _ = try require()
        defer { abort(ticket: ticket) }
        guard let item = pending[ticket], item.size == size,
              try item.file.resourceValues(forKeys: [.fileSizeKey]).fileSize == Int(exactly: size) else { throw WorkflowError.invalidTransfer }
        let kind = try recordName(item.store, item.id)
        let (file, checkedSize, hash) = try encrypted(item.file, kind: kind)
        let record = Record(store: item.store, id: item.id, file: file, size: checkedSize, hash: hash, reference: item.reference)
        var next = batch ?? records; next[kind] = record
        if batch != nil { batch = next; batchFiles.insert(file) } else { try commit(next) }
        return record
    }
    public func info(store: String, id: String) throws -> Record? { _ = try require(); return (batch ?? records)[try recordName(store, id)] }
    public func list(store: String) throws -> [String] {
        _ = try require(); guard Self.stores.contains(store) else { throw DocumentVaultFailure.invalid }
        return (batch ?? records).values.filter { $0.store == store }.map(\.id).sorted()
    }
    public func read(store: String, id: String, offset: UInt64, hash: String? = nil) throws -> Data {
        let key = try require()
        guard let item = try info(store: store, id: id) else { throw DocumentVaultFailure.notFound }
        if let hash = hash, hash != item.hash { throw DocumentVaultFailure.changed }
        return try folder.read(item.file) { url in
            let reader = try VaultCrypto.Reader(url: url, key: key, name: logical(store + ":" + id))
            guard reader.size == item.size else { throw DocumentVaultFailure.damaged }
            return try reader.read(offset: offset)
        }
    }
    public func remove(store: String, id: String, prefix: Bool = false) throws {
        _ = try require(); _ = try recordName(store, id)
        let next = (batch ?? records).filter { _, record in record.store != store || !(record.id == id || (prefix && record.id.hasPrefix(id + "#"))) }
        if batch != nil { batch = next } else { try commit(next) }
    }
    public func beginBatch() throws {
        _ = try require(); guard !busy else { throw DocumentVaultFailure.busy }; batch = records
    }
    public func commitBatch() throws {
        _ = try require(); guard let next = batch, pending.isEmpty else { throw DocumentVaultFailure.busy }
        try commit(next); batch = nil; batchFiles = []
    }
    public func abortBatch() {
        for ticket in Array(pending.keys) { abort(ticket: ticket) }; batch = nil
        let committed = Set(records.values.map(\.file))
        for name in batchFiles.subtracting(committed) { try? folder.remove(name) }
        batchFiles = []
    }
}
