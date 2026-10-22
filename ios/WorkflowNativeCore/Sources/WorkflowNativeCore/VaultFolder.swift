import Foundation
import CryptoKit
import Darwin

public enum VaultFolderFailure: String, Error {
    case unavailable = "VAULT_FOLDER_UNAVAILABLE"
    case exists = "VAULT_FILE_EXISTS"
    case damaged = "VAULT_DAMAGED"
}

/// A persisted user grant, separate from the portable vault and its keys.
/// No fallback folder is created on a stale, missing or revoked grant.
/// Serial callers only. A bookmark is private app metadata, never web content.
public final class VaultFolderGrant {
    private let metadata: URL
    public init(metadata: URL) { self.metadata = metadata }
    public var configured: Bool { FileManager.default.fileExists(atPath: metadata.path) }
    public func select(_ folder: URL) throws {
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        let values = try folder.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        guard values.isDirectory == true, values.isSymbolicLink != true else { throw VaultFolderFailure.unavailable }
        // iOS persists security-scoped picker URLs with minimal bookmarks;
        // the macOS-only withSecurityScope option is not an iOS API.
        let bookmark = try folder.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
        try FileManager.default.createDirectory(at: metadata.deletingLastPathComponent(), withIntermediateDirectories: true)
        try bookmark.write(to: metadata, options: .atomic)
    }
    public func withAccess<T>(_ operation: (URL) throws -> T) throws -> T {
        let bytes: Data
        do { bytes = try Data(contentsOf: metadata) } catch { throw VaultFolderFailure.unavailable }
        guard bytes.count <= 1_048_576 else { throw VaultFolderFailure.unavailable }
        var stale = false
        let folder: URL
        do { folder = try URL(resolvingBookmarkData: bytes, options: [.withoutUI, .withoutMounting], relativeTo: nil, bookmarkDataIsStale: &stale) }
        catch { throw VaultFolderFailure.unavailable }
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        guard (try? folder.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey]))?.isDirectory == true,
              (try? folder.resourceValues(forKeys: [.isSymbolicLinkKey]))?.isSymbolicLink != true else { throw VaultFolderFailure.unavailable }
        if stale {
            let refreshed = try folder.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
            try refreshed.write(to: metadata, options: .atomic)
        }
        return try operation(folder)
    }
}

/// Coordinate provider access for the *whole* operation; never retain a resolved
/// provider URL for use after the security-scope/coordinator accessor has ended.
public final class VaultFolder {
    private let grant: VaultFolderGrant
    public init(grant: VaultFolderGrant) { self.grant = grant }
    private func valid(_ name: String) throws {
        guard !name.isEmpty, name != ".", name != "..", name.utf8.count <= 255,
              !name.contains("/"), !name.contains("\\"), !name.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) else { throw VaultFolderFailure.damaged }
    }
    private func coordinate<T>(write: Bool, _ operation: (URL) throws -> T) throws -> T {
        try grant.withAccess { folder in
            let coordinator = NSFileCoordinator(filePresenter: nil)
            var coordinationError: NSError?
            var result: Result<T, Error>?
            let accessor: (URL) -> Void = { url in result = Result { try operation(url) } }
            if write {
                coordinator.coordinate(writingItemAt: folder, options: .forMerging, error: &coordinationError, byAccessor: accessor)
            } else {
                coordinator.coordinate(readingItemAt: folder, options: [], error: &coordinationError, byAccessor: accessor)
            }
            if coordinationError != nil { throw VaultFolderFailure.unavailable }
            guard let result = result else { throw VaultFolderFailure.unavailable }
            return try result.get()
        }
    }
    public func names() throws -> [String] {
        try coordinate(write: false) { try FileManager.default.contentsOfDirectory(atPath: $0.path) }
    }
    public func read<T>(_ name: String, _ operation: (URL) throws -> T) throws -> T {
        try valid(name)
        return try coordinate(write: false) { folder in
            let file = folder.appendingPathComponent(name)
            let values = try file.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
            guard values.isRegularFile == true, values.isSymbolicLink != true else { throw VaultFolderFailure.damaged }
            return try operation(file)
        }
    }
    /// Publish a new already-encrypted local file. Verify bytes after provider
    /// writing and fsync; a successful return is not a remote iCloud sync receipt.
    public func createVerified(_ name: String, from source: URL) throws {
        try valid(name)
        try coordinate(write: true) { folder in
            let destination = folder.appendingPathComponent(name)
            let descriptor = Darwin.open(destination.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, S_IRUSR | S_IWUSR)
            guard descriptor >= 0 else {
                if errno == EEXIST { throw VaultFolderFailure.exists }
                throw VaultFolderFailure.unavailable
            }
            let output = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
            defer { try? output.close() }
            do {
                let input = try FileHandle(forReadingFrom: source)
                defer { try? input.close() }
                var digest = SHA256(), size: UInt64 = 0
                while let bytes = try input.read(upToCount: VaultCrypto.chunk), !bytes.isEmpty {
                    try output.write(contentsOf: bytes); digest.update(data: bytes); size += UInt64(bytes.count)
                }
                try output.synchronize()
                try output.close()
                let back = try FileHandle(forReadingFrom: destination)
                defer { try? back.close() }
                var checked = SHA256(), checkedSize: UInt64 = 0
                while let bytes = try back.read(upToCount: VaultCrypto.chunk), !bytes.isEmpty {
                    checked.update(data: bytes); checkedSize += UInt64(bytes.count)
                }
                guard checkedSize == size, checked.finalize() == digest.finalize() else { throw VaultFolderFailure.damaged }
                // Persist the directory entry where the filesystem supports it.
                let directory = Darwin.open(folder.path, O_RDONLY)
                guard directory >= 0 else { throw VaultFolderFailure.unavailable }
                defer { Darwin.close(directory) }
                guard fsync(directory) == 0 else { throw VaultFolderFailure.unavailable }
            } catch {
                // Only a file created by this call can be removed here.
                try? FileManager.default.removeItem(at: destination)
                throw error
            }
        }
    }
    public func remove(_ name: String) throws {
        try valid(name)
        try coordinate(write: true) { folder in
            let file = folder.appendingPathComponent(name)
            let values = try file.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
            guard values.isRegularFile == true, values.isSymbolicLink != true else { throw VaultFolderFailure.damaged }
            try FileManager.default.removeItem(at: file)
        }
    }
}
