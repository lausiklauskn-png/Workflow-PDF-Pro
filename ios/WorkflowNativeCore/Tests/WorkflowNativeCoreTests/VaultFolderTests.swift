import XCTest
@testable import WorkflowNativeCore

final class VaultFolderTests: XCTestCase {
    func testBookmarkRestartVerifiedCreateAndNoFallback() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: root) }
        let selected = root.appendingPathComponent("provider"), metadata = root.appendingPathComponent("grant")
        try FileManager.default.createDirectory(at: selected, withIntermediateDirectories: false)
        try VaultFolderGrant(metadata: metadata).select(selected)
        let reopened = VaultFolderGrant(metadata: metadata), folder = VaultFolder(grant: reopened)
        XCTAssertTrue(reopened.configured)
        let source = root.appendingPathComponent("encrypted-fixture")
        let bytes = Data(repeating: 0x79, count: 900_000)
        try bytes.write(to: source)
        try folder.createVerified("record.wpv", from: source)
        XCTAssertEqual(try folder.read("record.wpv") { try Data(contentsOf: $0) }, bytes)
        XCTAssertThrowsError(try folder.createVerified("record.wpv", from: source))
        XCTAssertThrowsError(try folder.read("../encrypted-fixture") { try Data(contentsOf: $0) })
        try FileManager.default.createSymbolicLink(at: selected.appendingPathComponent("link"), withDestinationURL: source)
        XCTAssertThrowsError(try folder.read("link") { try Data(contentsOf: $0) })
        XCTAssertThrowsError(try folder.createVerified("link", from: source))
        try FileManager.default.removeItem(at: selected)
        XCTAssertThrowsError(try folder.names())
        XCTAssertTrue(reopened.configured, "Missing provider must preserve the selected grant")
        XCTAssertFalse(FileManager.default.fileExists(atPath: selected.path))
        try Data([1, 2, 3]).write(to: metadata)
        XCTAssertThrowsError(try folder.names())
    }
}
