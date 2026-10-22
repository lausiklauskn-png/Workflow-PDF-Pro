import XCTest
@testable import WorkflowNativeCore

final class DocumentVaultTests: XCTestCase {
    func testSameRevisionReplacementIsRejectedWhileOpenAndAfterRestart() throws {
        let local = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: local, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: local) }
        let root = local.appendingPathComponent("vault"), forkRoot = local.appendingPathComponent("fork")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        func session(_ folder: URL, name: String) throws -> DocumentVault {
            let grant = VaultFolderGrant(metadata: local.appendingPathComponent(name + ".bookmark"))
            try grant.select(folder)
            return try DocumentVault(folder: VaultFolder(grant: grant), scratch: local.appendingPathComponent(name + "-scratch"), checkpoint: local.appendingPathComponent(name + ".checkpoint"))
        }
        func put(_ vault: DocumentVault, _ text: String) throws {
            let bytes = Data(text.utf8), ticket = try vault.begin(store: "docs", id: "document")
            try vault.append(ticket: ticket, offset: 0, bytes: bytes)
            try vault.finish(ticket: ticket, size: UInt64(bytes.count))
        }
        let vault = try session(root, name: "current")
        try vault.initialize(password: "Test password 123")
        try FileManager.default.copyItem(at: root, to: forkRoot)
        let fork = try session(forkRoot, name: "fork")
        try fork.open(password: "Test password 123")
        try put(vault, "My form edits")
        try put(fork, "Other form edits")
        XCTAssertEqual(vault.revision, fork.revision)
        for name in try FileManager.default.contentsOfDirectory(atPath: root.path) {
            try FileManager.default.removeItem(at: root.appendingPathComponent(name))
        }
        for name in try FileManager.default.contentsOfDirectory(atPath: forkRoot.path) {
            try FileManager.default.copyItem(at: forkRoot.appendingPathComponent(name), to: root.appendingPathComponent(name))
        }
        XCTAssertThrowsError(try vault.dataKey())
        vault.lock()
        XCTAssertThrowsError(try vault.open(password: "Test password 123"))
        XCTAssertFalse(vault.unlocked)
    }
    func testRetentionKeepsThreeGenerationsAndDamageStopsCleanup() throws {
        let local = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: local, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: local) }
        let root = local.appendingPathComponent("vault")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        let grant = VaultFolderGrant(metadata: local.appendingPathComponent("grant"))
        try grant.select(root)
        let vault = try DocumentVault(folder: VaultFolder(grant: grant), scratch: local.appendingPathComponent("scratch"), checkpoint: local.appendingPathComponent("checkpoint"))
        try vault.initialize(password: "Test password 123")
        for value in UInt8(1)...5 {
            let ticket = try vault.begin(store: "files", id: "file")
            try vault.append(ticket: ticket, offset: 0, bytes: Data([value]))
            try vault.finish(ticket: ticket, size: 1)
        }
        try vault.prune()
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: root.path).filter { $0.hasPrefix("commit-") }.count, 3)
        XCTAssertEqual(try vault.read(store: "files", id: "file", offset: 0), Data([5]))
        for value in UInt8(6)...7 {
            let ticket = try vault.begin(store: "files", id: "file")
            try vault.append(ticket: ticket, offset: 0, bytes: Data([value]))
            try vault.finish(ticket: ticket, size: 1)
        }
        let before = Set(try FileManager.default.contentsOfDirectory(atPath: root.path))
        let oldest = before.filter { $0.hasPrefix("commit-") }.sorted().first!
        try Data("broken".utf8).write(to: root.appendingPathComponent(oldest))
        XCTAssertThrowsError(try vault.prune())
        XCTAssertEqual(Set(try FileManager.default.contentsOfDirectory(atPath: root.path)), before)
        XCTAssertEqual(try vault.read(store: "files", id: "file", offset: 0), Data([7]))
    }
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
