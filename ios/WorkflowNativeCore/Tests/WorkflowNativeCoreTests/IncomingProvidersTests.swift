import XCTest
import UniformTypeIdentifiers
@testable import WorkflowNativeCore

final class IncomingProvidersTests: XCTestCase {
    func testTemporaryProviderFilesAreCopiedBeforeCallbackEndsAndWholeBatchIsRequired() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: root) }
        let inbox = SharedIncomingStore(root: root.appendingPathComponent("inbox"))
        func provider(_ name: String, bytes: Data) -> NSItemProvider {
            let provider = NSItemProvider()
            provider.registerFileRepresentation(forTypeIdentifier: UTType.pdf.identifier, fileOptions: [], visibility: .all) { completion in
                let file = root.appendingPathComponent(name)
                do {
                    try bytes.write(to: file)
                    completion(file, false, nil)
                    try? FileManager.default.removeItem(at: file)
                } catch { completion(nil, false, error) }
                return nil
            }
            return provider
        }
        let batch = try await IncomingProviders.receive([provider("Документ.pdf", bytes: Data([1, 2, 3])), provider("Zweite.pdf", bytes: Data([4, 5]))], into: inbox, staging: root.appendingPathComponent("staging"))
        XCTAssertEqual(batch.files.count, 2)
        let bytes = try inbox.access { try $0.read(batch: batch.id, id: batch.files[0].id, offset: 0).0 }
        XCTAssertEqual(bytes, Data([1, 2, 3]))
        try inbox.access { try $0.acknowledge(id: batch.id, discard: true) }
        let invalid = NSItemProvider(item: "Unsupported text" as NSString, typeIdentifier: UTType.plainText.identifier)
        do {
            _ = try await IncomingProviders.receive([provider("Good.pdf", bytes: Data([6])), invalid], into: inbox, staging: root.appendingPathComponent("staging"))
            XCTFail("A partially received share must never be published")
        } catch {}
        XCTAssertNil(try inbox.access { try $0.pending() })
        let cancelled = Task {
            try await IncomingProviders.receive([provider("Cancelled.pdf", bytes: Data([7]))], into: inbox, staging: root.appendingPathComponent("staging"), willCommit: { withUnsafeCurrentTask { $0?.cancel() } })
        }
        do { _ = try await cancelled.value; XCTFail("Cancellation before publication must leave no batch") }
        catch is CancellationError {}
        XCTAssertNil(try inbox.access { try $0.pending() })
    }
}
