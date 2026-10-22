import XCTest
@testable import WorkflowNativeCore

final class VaultLocationsTests: XCTestCase {
    func testRegrantRejectsMetadataRollbackAndSameRevisionForkWithoutChangingPrimary() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: root) }
        let folder = root.appendingPathComponent("current")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        let locations = try VaultLocations(root: root.appendingPathComponent("metadata"), cache: root.appendingPathComponent("cache"))
        func put(_ vault: DocumentVault, store: String, text: String) throws {
            let bytes = Data(text.utf8), ticket = try vault.begin(store: store, id: "document")
            try vault.append(ticket: ticket, offset: 0, bytes: bytes)
            try vault.finish(ticket: ticket, size: UInt64(bytes.count))
        }
        let initial = try locations.candidate(folder: folder)
        try initial.vault.initialize(password: "Test password 123")
        try put(initial.vault, store: "files", text: "%PDF unchanged")
        try put(initial.vault, store: "docs", text: "Original metadata")
        let id = try locations.adopt(initial)
        try locations.select(id)
        let staleFolder = root.appendingPathComponent("stale"), forkFolder = root.appendingPathComponent("fork")
        try FileManager.default.copyItem(at: folder, to: staleFolder)
        try FileManager.default.copyItem(at: folder, to: forkFolder)
        let current = try locations.get(id)
        try put(current, store: "docs", text: "New form edits")
        let originalFile = try current.info(store: "files", id: "document")

        let stale = try locations.candidate(folder: staleFolder)
        try stale.vault.open(password: "Test password 123")
        XCTAssertEqual(try stale.vault.info(store: "files", id: "document"), originalFile)
        XCTAssertThrowsError(try locations.adopt(stale))
        try locations.discard(stale)

        let fork = try locations.candidate(folder: forkFolder)
        try fork.vault.open(password: "Test password 123")
        try put(fork.vault, store: "docs", text: "Different form edits")
        XCTAssertEqual(fork.vault.revision, current.revision)
        XCTAssertEqual(try fork.vault.info(store: "files", id: "document"), originalFile)
        XCTAssertThrowsError(try locations.adopt(fork))
        try locations.discard(fork)
        XCTAssertEqual(locations.primary, id)
        XCTAssertEqual(locations.entries.count, 1)
        XCTAssertEqual(try current.read(store: "docs", id: "document", offset: 0), Data("New form edits".utf8))

        // The checkpoint remains usable even if the previous provider grant is
        // gone: a faithful current copy can be adopted without opening that grant.
        let faithfulFolder = root.appendingPathComponent("faithful")
        try FileManager.default.copyItem(at: folder, to: faithfulFolder)
        try FileManager.default.removeItem(at: folder)
        let faithful = try locations.candidate(folder: faithfulFolder)
        try faithful.vault.open(password: "Test password 123")
        let replacement = try locations.adopt(faithful)
        XCTAssertEqual(locations.primary, id)
        try locations.select(replacement)
        XCTAssertEqual(try locations.get(replacement).read(store: "docs", id: "document", offset: 0), Data("New form edits".utf8))
    }
    func testSelectionMigrationAndCorruptCatalogNeverBecomeInternalReset() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: root) }
        let metadata = root.appendingPathComponent("metadata"), cache = root.appendingPathComponent("cache")
        let folder = root.appendingPathComponent("selected")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        let locations = try VaultLocations(root: metadata, cache: cache)
        XCTAssertEqual(try locations.state()["configured"] as? Bool, false)
        let candidate = try locations.candidate(folder: folder)
        try candidate.vault.initialize(password: "Test password 123")
        let id = try locations.adopt(candidate)
        XCTAssertNil(locations.primary)
        try locations.prepareMigration(id)
        try locations.get(id).beginBatch()
        XCTAssertThrowsError(try locations.completeMigration(id))
        try locations.get(id).abortBatch()
        try locations.completeMigration(id)
        XCTAssertEqual(locations.primary, id)
        let restarted = try VaultLocations(root: metadata, cache: cache)
        XCTAssertEqual(restarted.primary, id)
        XCTAssertFalse(try restarted.get(id).unlocked)
        try restarted.get(id).open(password: "Test password 123")
        XCTAssertEqual(try restarted.get(id).identity, try locations.get(id).identity)
        try Data("broken".utf8).write(to: metadata.appendingPathComponent("locations.json"))
        XCTAssertThrowsError(try VaultLocations(root: metadata, cache: cache))
        try FileManager.default.removeItem(at: metadata.appendingPathComponent("locations.json"))
        XCTAssertThrowsError(try VaultLocations(root: metadata, cache: cache))
    }
}
