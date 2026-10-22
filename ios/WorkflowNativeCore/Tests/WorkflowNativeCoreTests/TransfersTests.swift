import XCTest
@testable import WorkflowNativeCore

final class TransfersTests: XCTestCase {
    private func temporary() throws -> URL {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        addTeardownBlock { try? FileManager.default.removeItem(at: root) }
        return root
    }
    func testChunkedTransferRejectsGapsAndUnfinishedFiles() throws {
        let store = try Transfers(root: temporary())
        let id = try store.begin(name: "../Мüller.pdf", mime: "application/pdf")
        XCTAssertThrowsError(try store.file(id: id))
        let bytes = Data(repeating: 42, count: Transfers.chunk)
        XCTAssertThrowsError(try store.append(id: id, offset: 1, base64: bytes.base64EncodedString()))
        XCTAssertEqual(try store.append(id: id, offset: 0, base64: bytes.base64EncodedString()), UInt64(bytes.count))
        XCTAssertThrowsError(try store.append(id: id, offset: 0, base64: ""))
        XCTAssertThrowsError(try store.finish(id: id, size: 1))
        try store.finish(id: id, size: UInt64(bytes.count))
        XCTAssertEqual(try Data(contentsOf: store.file(id: id)), bytes)
        XCTAssertThrowsError(try store.append(id: id, offset: UInt64(bytes.count), base64: ""))
        let file = try store.file(id: id)
        try store.abort(id: id)
        XCTAssertFalse(FileManager.default.fileExists(atPath: file.path))
        XCTAssertThrowsError(try store.file(id: id))
    }
    func testOversizeInvalidBase64AndUnknownTicketsFail() throws {
        let store = try Transfers(root: temporary())
        let id = try store.begin(name: "empty.pdf", mime: "application/pdf")
        XCTAssertThrowsError(try store.append(id: id, offset: 0, base64: "not-base64!"))
        XCTAssertThrowsError(try store.append(id: id, offset: 0, base64: Data(repeating: 0, count: Transfers.chunk + 1).base64EncodedString()))
        XCTAssertThrowsError(try store.finish(id: "../unknown", size: 0))
        try store.finish(id: id, size: 0)
        XCTAssertEqual(try Data(contentsOf: store.file(id: id)), Data())
        XCTAssertEqual(Transfers.filename(".."), "Dokument")
        XCTAssertFalse(Transfers.filename("path/unsafe\0name.pdf").contains("/"))
        XCTAssertEqual(Transfers.filename("Mu\u{0308}ller.pdf"), "Müller.pdf")
        let unicode = try store.begin(name: String(repeating: "😀", count: 90) + ".pdf", mime: "application/pdf")
        try store.finish(id: unicode, size: 0)
        let filename = try store.file(id: unicode).lastPathComponent
        XCTAssertTrue(filename.hasSuffix(".pdf"))
        XCTAssertLessThanOrEqual(filename.utf8.count, 240)
        try store.abort(id: unicode)
    }
    func testInboxRestartConsentArchiveRestoreAndChunkIdentity() throws {
        let root = try temporary()
        let inboxURL = root.appendingPathComponent("inbox")
        let input = root.appendingPathComponent("Формуляр.pdf")
        let original = Data((0..<700_000).map { UInt8($0 % 251) })
        try original.write(to: input)
        var inbox = try IncomingStore(root: inboxURL)
        let batch = try inbox.receive([input])
        try FileManager.default.removeItem(at: input)
        inbox = try IncomingStore(root: inboxURL)
        XCTAssertEqual(try inbox.pending()?.id, batch.id)
        var restored = Data()
        var done = false
        while !done {
            let part = try inbox.read(batch: batch.id, id: batch.files[0].id, offset: UInt64(restored.count))
            restored.append(part.0); done = part.1
        }
        XCTAssertEqual(restored, original)
        XCTAssertThrowsError(try inbox.read(batch: "../other", id: batch.files[0].id, offset: 0))
        XCTAssertThrowsError(try inbox.read(batch: batch.id, id: "../other", offset: 0))
        try inbox.acknowledge(id: batch.id, discard: false)
        XCTAssertNil(try inbox.pending())
        XCTAssertEqual(try inbox.history().count, 1)
        try inbox.restore(id: batch.id)
        XCTAssertEqual(try inbox.pending()?.id, batch.id)
        try inbox.acknowledge(id: batch.id, discard: true)
        XCTAssertNil(try inbox.pending())
        XCTAssertTrue(try inbox.history().isEmpty)
    }
    func testMissingSecondInputNeverCommitsPartialBatch() throws {
        let root = try temporary()
        let source = root.appendingPathComponent("first.pdf")
        try Data([1, 2, 3]).write(to: source)
        let inbox = try IncomingStore(root: root.appendingPathComponent("inbox"))
        XCTAssertThrowsError(try inbox.receive([source, root.appendingPathComponent("missing.pdf")]))
        XCTAssertNil(try inbox.pending())
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: root.appendingPathComponent("inbox").path), ["inbox.json"])
    }
    func testCorruptionIsNeverAnEmptyInbox() throws {
        let root = try temporary()
        let source = root.appendingPathComponent("source.pdf")
        try Data([1, 2, 3]).write(to: source)
        let inboxURL = root.appendingPathComponent("inbox")
        let inbox = try IncomingStore(root: inboxURL)
        let batch = try inbox.receive([source])
        try Data([9]).write(to: inboxURL.appendingPathComponent(batch.id).appendingPathComponent(batch.files[0].id))
        XCTAssertThrowsError(try inbox.pending())
        XCTAssertThrowsError(try IncomingStore(root: inboxURL))
        try Data("corrupt".utf8).write(to: inboxURL.appendingPathComponent("inbox.json"))
        XCTAssertThrowsError(try IncomingStore(root: inboxURL))
    }
    func testMissingIndexDoesNotResetExistingIntake() throws {
        let root = try temporary()
        let source = root.appendingPathComponent("source.pdf")
        try Data([1, 2, 3]).write(to: source)
        let inboxURL = root.appendingPathComponent("inbox")
        let inbox = try IncomingStore(root: inboxURL)
        _ = try inbox.receive([source])
        try FileManager.default.removeItem(at: inboxURL.appendingPathComponent("inbox.json"))
        XCTAssertThrowsError(try IncomingStore(root: inboxURL))
    }
    func testSymlinkAndTraversalMetadataAreRejected() throws {
        let root = try temporary()
        let file = root.appendingPathComponent("document.pdf")
        try Data([1]).write(to: file)
        let link = root.appendingPathComponent("link.pdf")
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: file)
        let inboxURL = root.appendingPathComponent("inbox")
        let inbox = try IncomingStore(root: inboxURL)
        XCTAssertThrowsError(try inbox.receive([link]))
        let state: [String: Any] = ["pending": [["id": "..", "files": [["id": "outside", "name": "file.pdf", "mime": "application/pdf", "size": 1]]]], "archive": []]
        try JSONSerialization.data(withJSONObject: state).write(to: inboxURL.appendingPathComponent("inbox.json"))
        XCTAssertThrowsError(try inbox.pending())
    }
}
