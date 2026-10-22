import XCTest
@testable import WorkflowNativeCore

final class SharedIncomingStoreTests: XCTestCase {
    func testIndependentClientsPreserveAllBatchesAndNeverResetDamage() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appendingPathComponent("Документ.pdf")
        try Data([1, 2, 3]).write(to: source)
        let root = directory.appendingPathComponent("shared")
        let first = SharedIncomingStore(root: root), second = SharedIncomingStore(root: root)
        let a = try first.access { try $0.receive([source]) }
        let b = try second.access { try $0.receive([source]) }
        XCTAssertEqual(try second.access { try $0.pending()?.id }, a.id)
        try second.access { try $0.acknowledge(id: a.id, discard: false) }
        XCTAssertEqual(try first.access { try $0.pending()?.id }, b.id)
        XCTAssertEqual(try first.access { try $0.history().first?.id }, a.id)
        try Data([0]).write(to: root.appendingPathComponent("inbox.json"))
        XCTAssertThrowsError(try second.access { try $0.pending() })
    }
}
