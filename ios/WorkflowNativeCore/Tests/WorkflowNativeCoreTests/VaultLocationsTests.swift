import XCTest
@testable import WorkflowNativeCore

final class VaultLocationsTests: XCTestCase {
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
