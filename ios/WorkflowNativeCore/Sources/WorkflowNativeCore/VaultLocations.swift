import Foundation
import CryptoKit
import Darwin

public enum VaultLocationFailure: String, Error {
    case unavailable = "VAULT_LOCATION_UNAVAILABLE"
    case notConfigured = "VAULT_NOT_CONFIGURED"
    case wrongFolder = "VAULT_WRONG_FOLDER"
    case recoveryRequired = "VAULT_RECOVERY_REQUIRED"
}

/// Device-local selection and migration pointers. Portable records never contain
/// these bookmarks, native paths or Keychain entries. Serial callers only.
public final class VaultLocations {
    public struct Entry: Codable {
        public let location: String
        public let vaultID: String
        public let label: String
    }
    public struct Candidate {
        public let vault: DocumentVault
        fileprivate let directory: URL
        fileprivate let label: String
    }
    private struct Catalog: Codable {
        var items: [Entry] = []
        var primary: String?
        var migration: String?
    }
    private let root: URL
    private let cache: URL
    private let catalogURL: URL
    private let keychain: VaultKeychain
    private var catalog = Catalog()
    private var sessions: [String: DocumentVault] = [:]
    public var primary: String? { catalog.primary }
    public var migration: String? { catalog.migration }
    public var entries: [Entry] { catalog.items }
    public init(root: URL, cache: URL, keychain: VaultKeychain = VaultKeychain()) throws {
        self.root = root; self.cache = cache; self.keychain = keychain
        catalogURL = root.appendingPathComponent("locations.json")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        if FileManager.default.fileExists(atPath: catalogURL.path) {
            catalog = try JSONDecoder().decode(Catalog.self, from: Data(contentsOf: catalogURL))
        } else {
            let existing = try FileManager.default.contentsOfDirectory(atPath: root.path)
            guard !existing.contains(where: { Self.valid($0) }) else { throw VaultLocationFailure.recoveryRequired }
            catalog = Catalog()
        }
        let ids = Set(catalog.items.map(\.location))
        guard ids.count == catalog.items.count,
              catalog.items.allSatisfy({ Self.valid($0.location) && UUID(uuidString: $0.vaultID) != nil }),
              catalog.primary.map({ ids.contains($0) }) ?? true,
              catalog.migration.map({ ids.contains($0) }) ?? true else { throw VaultLocationFailure.recoveryRequired }
    }
    private static func valid(_ id: String) -> Bool {
        id.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil
    }
    private func save(_ next: Catalog) throws {
        try JSONEncoder().encode(next).write(to: catalogURL, options: .atomic)
        // Publication has happened even if the subsequent durability check fails.
        // Keep memory aligned with the published catalogue and preserve its files.
        catalog = next
        let handle = try FileHandle(forWritingTo: catalogURL)
        defer { try? handle.close() }
        try handle.synchronize()
        let descriptor = Darwin.open(root.path, O_RDONLY)
        guard descriptor >= 0 else { throw VaultLocationFailure.unavailable }
        defer { Darwin.close(descriptor) }
        guard fsync(descriptor) == 0 else { throw VaultLocationFailure.unavailable }
    }
    private func session(_ directory: URL) throws -> DocumentVault {
        let grant = VaultFolderGrant(metadata: directory.appendingPathComponent("folder.bookmark"))
        guard grant.configured else { throw VaultLocationFailure.unavailable }
        return try DocumentVault(folder: VaultFolder(grant: grant), scratch: cache.appendingPathComponent(UUID().uuidString), checkpoint: directory.appendingPathComponent("checkpoint.json"))
    }
    public func candidate(folder: URL) throws -> Candidate {
        try ensureIdle()
        let directory = root.appendingPathComponent("candidate-" + UUID().uuidString.lowercased())
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
        do {
            let grant = VaultFolderGrant(metadata: directory.appendingPathComponent("folder.bookmark"))
            try grant.select(folder)
            return Candidate(vault: try session(directory), directory: directory, label: folder.lastPathComponent)
        } catch { try? FileManager.default.removeItem(at: directory); throw error }
    }
    public func discard(_ candidate: Candidate) throws {
        candidate.vault.lock()
        guard candidate.directory.deletingLastPathComponent().standardizedFileURL == root.standardizedFileURL,
              candidate.directory.lastPathComponent.hasPrefix("candidate-") else { throw VaultLocationFailure.unavailable }
        try FileManager.default.removeItem(at: candidate.directory)
    }
    public func adopt(_ candidate: Candidate) throws -> String {
        try ensureIdle()
        guard !candidate.vault.busy else { throw DocumentVaultFailure.busy }
        let key = try candidate.vault.dataKey()
        // Regranting a folder must preserve document/form metadata as well as PDF
        // bytes. The shared adapter's file-reference hashes cannot detect a
        // metadata-only rollback or a different branch at the same revision.
        for entry in catalog.items where entry.vaultID == candidate.vault.identity {
            guard let known = try DocumentVault.savedCheckpoint(at: root.appendingPathComponent(entry.location).appendingPathComponent("checkpoint.json")),
                  known.id == candidate.vault.identity else { throw VaultLocationFailure.recoveryRequired }
            guard candidate.vault.revision >= known.revision,
                  candidate.vault.revision != known.revision || known.hash == nil || known.hash == candidate.vault.generationHash else {
                throw VaultLocationFailure.recoveryRequired
            }
        }
        let location = SHA256.hash(data: Data(UUID().uuidString.utf8)).map { String(format: "%02x", $0) }.joined()
        let directory = root.appendingPathComponent(location)
        try FileManager.default.moveItem(at: candidate.directory, to: directory)
        do {
            let vault = try session(directory)
            try vault.open(rememberedKey: key)
            var next = catalog
            next.items.append(Entry(location: location, vaultID: vault.identity, label: candidate.label))
            try save(next)
            sessions[location] = vault
            candidate.vault.lock()
            return location
        } catch {
            // Never move a directory away from an already published catalogue.
            if !catalog.items.contains(where: { $0.location == location }) {
                try? FileManager.default.moveItem(at: directory, to: candidate.directory)
            }
            throw error
        }
    }
    public func get(_ requested: String? = nil) throws -> DocumentVault {
        guard let id = requested ?? catalog.primary else { throw VaultLocationFailure.notConfigured }
        guard Self.valid(id), catalog.items.contains(where: { $0.location == id }) else { throw VaultLocationFailure.unavailable }
        if let vault = sessions[id] { return vault }
        let vault = try session(root.appendingPathComponent(id)); sessions[id] = vault
        return vault
    }
    public func ensureIdle() throws {
        guard !sessions.values.contains(where: { $0.busy }) else { throw DocumentVaultFailure.busy }
    }
    public func unlock(_ location: String?, password: String, remember: Bool) throws {
        let vault = try get(location)
        try vault.open(password: password)
        guard let entry = catalog.items.first(where: { $0.location == (location ?? primary) }), entry.vaultID == vault.identity else {
            vault.lock(); throw VaultLocationFailure.wrongFolder
        }
        if remember { try keychain.remember(vault.dataKey(), vaultID: vault.identity) }
        else { try keychain.forget(vaultID: vault.identity) }
    }
    public func remember(_ location: String, enabled: Bool) throws {
        let vault = try get(location)
        if enabled { try keychain.remember(vault.dataKey(), vaultID: vault.identity) }
        else { try keychain.forget(vaultID: vault.identity) }
    }
    public func state(_ requested: String? = nil) throws -> [String: Any] {
        guard let id = requested ?? primary else { return ["configured": false, "internal": true] }
        guard let entry = catalog.items.first(where: { $0.location == id }) else { throw VaultLocationFailure.unavailable }
        let vault = try get(id)
        var result: [String: Any] = ["configured": true, "id": entry.vaultID, "location": id, "folder": entry.label, "primary": id == primary, "unlocked": false]
        do {
            if !vault.unlocked { try vault.open(rememberedKey: keychain.recalled(vaultID: entry.vaultID)) }
            guard vault.identity == entry.vaultID else { vault.lock(); throw VaultLocationFailure.wrongFolder }
            _ = try vault.dataKey()
            result["unlocked"] = true; result["reachable"] = true; result["revision"] = vault.revision
        } catch { result["problem"] = Self.code(error) }
        return result
    }
    public func select(_ id: String?) throws {
        try ensureIdle()
        if let id = id { _ = try get(id).dataKey() }
        var next = catalog; next.primary = id; try save(next)
    }
    public func prepareMigration(_ id: String) throws {
        try ensureIdle(); _ = try get(id).dataKey()
        guard migration == nil || migration == id else { throw DocumentVaultFailure.busy }
        var next = catalog; next.migration = id; try save(next)
    }
    public func completeMigration(_ id: String) throws {
        try ensureIdle(); _ = try get(id).dataKey()
        guard migration == id else { throw VaultLocationFailure.recoveryRequired }
        var next = catalog; next.primary = id; next.migration = nil; try save(next)
    }
    public func cancelMigration() throws { try ensureIdle(); var next = catalog; next.migration = nil; try save(next) }
    public func lock() throws {
        closeWorking()
        for entry in catalog.items { try keychain.forget(vaultID: entry.vaultID) }
    }
    public func closeWorking() { for vault in sessions.values { vault.lock() } }
    public static func code(_ error: Error) -> String {
        if let e = error as? DocumentVaultFailure { return e.rawValue }
        if let e = error as? VaultFailure { return e.rawValue }
        if let e = error as? VaultFolderFailure { return e.rawValue }
        if let e = error as? VaultLocationFailure { return e.rawValue }
        if let e = error as? VaultKeychainFailure { return e.rawValue }
        if let e = error as? RecoveryFailure { return e.rawValue }
        return "VAULT_UNAVAILABLE"
    }
}
