import XCTest
@testable import WorkflowNativeCore

final class DocumentVaultTests: XCTestCase {
    func testWholeVaultRestartBatchFailureAndDamagedNewestGeneration() throws {
        let local = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: local, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: local) }
        let root = local.appendingPathComponent("vault")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        let grant = VaultFolderGrant(metadata: local.appendingPathComponent("grant"))
        try grant.select(root)
        func session() throws -> DocumentVault {
            try DocumentVault(folder: VaultFolder(grant: grant), scratch: local.appendingPathComponent(UUID().uuidString), checkpoint: local.appendingPathComponent("checkpoint"))
        }
        let vault = try session(); try vault.initialize(password: "Gemäßigtes Passwort €")
        let id = vault.identity, bytes = Data(repeating: 0x71, count: 900_000)
        let ticket = try vault.begin(store: "files", id: "original")
        XCTAssertThrowsError(try vault.append(ticket: ticket, offset: 1, bytes: Data([1])))
        var offset = 0
        while offset < bytes.count {
            let end = min(bytes.count, offset + VaultCrypto.chunk)
            try vault.append(ticket: ticket, offset: UInt64(offset), bytes: bytes.subdata(in: offset..<end)); offset = end
        }
        let info = try vault.finish(ticket: ticket, size: UInt64(bytes.count))
        XCTAssertEqual(info.size, UInt64(bytes.count))
        XCTAssertThrowsError(try vault.append(ticket: ticket, offset: UInt64(bytes.count), bytes: Data()))
        vault.lock()
        XCTAssertThrowsError(try vault.read(store: "files", id: "original", offset: 0))
        let reopened = try session()
        XCTAssertThrowsError(try reopened.open(password: "wrong"))
        XCTAssertFalse(reopened.unlocked)
        try reopened.open(password: "Gema\u{308}ßigtes Passwort €")
        XCTAssertEqual(reopened.identity, id)
        XCTAssertEqual(try reopened.info(store: "files", id: "original"), info)
        XCTAssertEqual(try reopened.read(store: "files", id: "original", offset: 0), Data(bytes.prefix(VaultCrypto.chunk)))
        XCTAssertThrowsError(try reopened.read(store: "files", id: "original", offset: 0, hash: String(repeating: "0", count: 64)))
        try reopened.beginBatch()
        try reopened.remove(store: "files", id: "original")
        XCTAssertNil(try reopened.info(store: "files", id: "original"))
        reopened.abortBatch()
        XCTAssertNotNil(try reopened.info(store: "files", id: "original"))
        let header = try Data(contentsOf: root.appendingPathComponent(DocumentVault.headerName))
        let shares = try reopened.createRecovery()
        XCTAssertEqual(shares.count, 5)
        XCTAssertEqual(try reopened.recoveryInfo()?.k, 3)
        reopened.lock()
        XCTAssertThrowsError(try reopened.recover(shares: Array(shares.prefix(2)), newPassword: "New password 123"))
        try reopened.recover(shares: [shares[4], shares[0], shares[2]], newPassword: "New password 123")
        XCTAssertEqual(try Data(contentsOf: root.appendingPathComponent(DocumentVault.headerName)), header)
        reopened.lock(); try reopened.open(password: "New password 123")
        XCTAssertEqual(try reopened.info(store: "files", id: "original"), info)
        try reopened.beginBatch(); try reopened.remove(store: "files", id: "original"); try reopened.commitBatch()
        let last = try FileManager.default.contentsOfDirectory(atPath: root.path).filter { $0.hasPrefix("commit-") }.sorted().last!
        try Data("broken".utf8).write(to: root.appendingPathComponent(last))
        reopened.lock()
        XCTAssertThrowsError(try reopened.open(password: "Gemäßigtes Passwort €"))
        XCTAssertFalse(reopened.unlocked, "Must not fall back to a previous intact generation")
    }
}
