import Foundation

public enum WorkflowError: String, Error {
    case invalidTransfer = "FILE_INVALID_TRANSFER"
    case unavailable = "FILE_UNAVAILABLE"
    case damagedInbox = "INCOMING_DAMAGED"
}

/// Serial callers only. A ticket never exposes a native path to JavaScript.
public final class Transfers {
    public static let chunk = 262_144
    private struct Ticket {
        let file: URL
        let name: String
        let mime: String
        var size: UInt64 = 0
        var finished = false
    }
    private let root: URL
    private var tickets: [String: Ticket] = [:]
    public init(root: URL) throws {
        self.root = root
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }
    public static func filename(_ name: String) -> String {
        let value = name.precomposedStringWithCanonicalMapping
            .components(separatedBy: CharacterSet(charactersIn: "/\\:\0").union(.controlCharacters)).joined(separator: "_")
        let trimmed = String(value.prefix(180)).trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty || trimmed == "." || trimmed == ".." ? "Dokument" : trimmed
    }
    public func begin(name: String, mime: String) throws -> String {
        guard tickets.count < 128 else { throw WorkflowError.unavailable }
        let id = UUID().uuidString
        let directory = root.appendingPathComponent(id, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
        let safeName = Self.filename(name)
        let file = directory.appendingPathComponent(safeName)
        guard FileManager.default.createFile(atPath: file.path, contents: Data()) else { throw WorkflowError.unavailable }
        tickets[id] = Ticket(file: file, name: safeName, mime: mime)
        return id
    }
    public func append(id: String, offset: UInt64, base64: String) throws -> UInt64 {
        guard var ticket = tickets[id], !ticket.finished, ticket.size == offset,
              base64.utf8.count <= 349_528, let bytes = Data(base64Encoded: base64), bytes.count <= Self.chunk
        else { throw WorkflowError.invalidTransfer }
        let handle = try FileHandle(forWritingTo: ticket.file)
        defer { try? handle.close() }
        guard try handle.seekToEnd() == offset else { throw WorkflowError.invalidTransfer }
        try handle.write(contentsOf: bytes)
        try handle.synchronize()
        ticket.size += UInt64(bytes.count)
        tickets[id] = ticket
        return ticket.size
    }
    public func finish(id: String, size: UInt64) throws {
        guard var ticket = tickets[id], !ticket.finished, ticket.size == size,
              try ticket.file.resourceValues(forKeys: [.fileSizeKey]).fileSize == Int(exactly: size)
        else { throw WorkflowError.invalidTransfer }
        ticket.finished = true
        tickets[id] = ticket
    }
    public func file(id: String) throws -> URL {
        guard let ticket = tickets[id], ticket.finished else { throw WorkflowError.invalidTransfer }
        return ticket.file
    }
    public func abort(id: String) throws {
        guard let ticket = tickets[id] else { return }
        // Keep the ticket if removal fails so cleanup can be retried.
        try FileManager.default.removeItem(at: ticket.file.deletingLastPathComponent())
        tickets.removeValue(forKey: id)
    }
}

public struct IncomingFile: Codable {
    public let id: String
    public let name: String
    public let mime: String
    public let size: UInt64
}
public struct IncomingBatch: Codable {
    public let id: String
    public let files: [IncomingFile]
}

/// Durable native intake. Metadata is committed only after all files are copied.
/// Invalid metadata fails closed instead of returning an empty, successful inbox.
public final class IncomingStore {
    private struct State: Codable {
        var pending: [IncomingBatch] = []
        var archive: [IncomingBatch] = []
    }
    private let root: URL
    private let index: URL
    public init(root: URL) throws {
        self.root = root
        index = root.appendingPathComponent("inbox.json")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        if !FileManager.default.fileExists(atPath: index.path) {
            guard try FileManager.default.contentsOfDirectory(atPath: root.path).isEmpty else { throw WorkflowError.damagedInbox }
            try save(State())
        }
        _ = try load()
    }
    private func load() throws -> State {
        do {
            let state = try JSONDecoder().decode(State.self, from: Data(contentsOf: index))
            let batches = state.pending + state.archive
            guard Set(batches.map(\.id)).count == batches.count else { throw WorkflowError.damagedInbox }
            for batch in batches {
                guard UUID(uuidString: batch.id) != nil, !batch.files.isEmpty,
                      Set(batch.files.map(\.id)).count == batch.files.count else { throw WorkflowError.damagedInbox }
                for file in batch.files {
                    guard UUID(uuidString: file.id) != nil,
                          let size = try path(batch.id, file.id).resourceValues(forKeys: [.fileSizeKey]).fileSize,
                          UInt64(size) == file.size else { throw WorkflowError.damagedInbox }
                }
            }
            return state
        } catch { throw WorkflowError.damagedInbox }
    }
    private func save(_ state: State) throws {
        try JSONEncoder().encode(state).write(to: index, options: .atomic)
    }
    private func path(_ batch: String, _ file: String) -> URL {
        root.appendingPathComponent(batch, isDirectory: true).appendingPathComponent(file)
    }
    @discardableResult public func receive(_ urls: [URL]) throws -> IncomingBatch {
        guard !urls.isEmpty, urls.count <= 256 else { throw WorkflowError.invalidTransfer }
        var state = try load()
        let batchID = UUID().uuidString
        let directory = root.appendingPathComponent(batchID, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
        do {
            var files: [IncomingFile] = []
            for url in urls {
                let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
                guard values.isRegularFile == true, values.isSymbolicLink != true else { throw WorkflowError.unavailable }
                let id = UUID().uuidString
                let destination = path(batchID, id)
                try FileManager.default.copyItem(at: url, to: destination)
                let size = try destination.resourceValues(forKeys: [.fileSizeKey]).fileSize!
                guard size == values.fileSize else { throw WorkflowError.unavailable }
                let ext = url.pathExtension.lowercased()
                let mime = ["pdf": "application/pdf", "json": "application/json", "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "heic": "image/heic"][ext] ?? "application/octet-stream"
                files.append(IncomingFile(id: id, name: Transfers.filename(url.lastPathComponent), mime: mime, size: UInt64(size)))
            }
            let batch = IncomingBatch(id: batchID, files: files)
            state.pending.append(batch)
            try save(state)
            return batch
        } catch {
            try? FileManager.default.removeItem(at: directory)
            throw error
        }
    }
    public func pending() throws -> IncomingBatch? { try load().pending.first }
    public func history() throws -> [IncomingBatch] { try load().archive }
    public func read(batch: String, id: String, offset: UInt64) throws -> (Data, Bool) {
        let state = try load()
        guard let item = state.pending.first, item.id == batch,
              let file = item.files.first(where: { $0.id == id }), offset <= file.size
        else { throw WorkflowError.invalidTransfer }
        let handle = try FileHandle(forReadingFrom: path(batch, id))
        defer { try? handle.close() }
        try handle.seek(toOffset: offset)
        let data = try handle.read(upToCount: Transfers.chunk) ?? Data()
        guard data.count == min(Transfers.chunk, Int(file.size - offset)) else { throw WorkflowError.unavailable }
        return (data, offset + UInt64(data.count) == file.size)
    }
    public func acknowledge(id: String, discard: Bool) throws {
        var state = try load()
        guard state.pending.first?.id == id else { throw WorkflowError.invalidTransfer }
        let batch = state.pending.removeFirst()
        if !discard { state.archive.append(batch) }
        try save(state)
        // A failed cleanup leaves inaccessible orphan bytes, never invalid metadata.
        if discard { try? FileManager.default.removeItem(at: root.appendingPathComponent(id)) }
    }
    public func restore(id: String) throws {
        var state = try load()
        guard let position = state.archive.firstIndex(where: { $0.id == id }) else { throw WorkflowError.invalidTransfer }
        state.pending.append(state.archive.remove(at: position))
        try save(state)
    }
    public func discardArchived(id: String) throws {
        var state = try load()
        guard let position = state.archive.firstIndex(where: { $0.id == id }) else { throw WorkflowError.invalidTransfer }
        state.archive.remove(at: position)
        try save(state)
        try? FileManager.default.removeItem(at: root.appendingPathComponent(id))
    }
}
