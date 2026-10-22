import XCTest
import CryptoKit
@testable import WorkflowNativeCore

final class VaultCryptoTests: XCTestCase {
    private func directory() throws -> URL {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        addTeardownBlock { try? FileManager.default.removeItem(at: root) }
        return root
    }
    func testBoundarySizesAndRandomAccess() throws {
        let root = try directory(), key = SymmetricKey(size: .bits256)
        for size in [0, 1, VaultCrypto.chunk - 1, VaultCrypto.chunk, VaultCrypto.chunk + 1, 900_000] {
            let plain = Data((0..<size).map { UInt8($0 % 251) })
            let source = root.appendingPathComponent("input"), encrypted = root.appendingPathComponent(UUID().uuidString)
            try plain.write(to: source)
            try VaultCrypto.encrypt(source: source, destination: encrypted, key: key, name: "files:Мюллер")
            let reader = try VaultCrypto.Reader(url: encrypted, key: key, name: "files:Мюллер")
            XCTAssertEqual(reader.size, UInt64(size))
            XCTAssertEqual(try reader.digest(), SHA256.hash(data: plain).map { String(format: "%02x", $0) }.joined())
            let offset = min(size, VaultCrypto.chunk - 2)
            XCTAssertEqual(try reader.read(offset: UInt64(offset), maximum: 2), plain.subdata(in: offset..<min(size, offset + 2)))
            XCTAssertThrowsError(try reader.read(offset: UInt64(size + 1)))
            XCTAssertThrowsError(try VaultCrypto.encrypt(source: source, destination: encrypted, key: key, name: "files:Мюллер"))
            XCTAssertEqual(try reader.digest(), SHA256.hash(data: plain).map { String(format: "%02x", $0) }.joined())
        }
    }
    func testWrongKeyNameTamperingTruncationAndReorderingFail() throws {
        let root = try directory(), key = SymmetricKey(size: .bits256)
        let source = root.appendingPathComponent("input"), encrypted = root.appendingPathComponent("cipher")
        try Data(repeating: 0x79, count: 2 * VaultCrypto.chunk + 12).write(to: source)
        try VaultCrypto.encrypt(source: source, destination: encrypted, key: key, name: "files:doc")
        XCTAssertThrowsError(try VaultCrypto.Reader(url: encrypted, key: SymmetricKey(size: .bits256), name: "files:doc"))
        XCTAssertThrowsError(try VaultCrypto.Reader(url: encrypted, key: key, name: "files:other"))
        let original = try Data(contentsOf: encrypted)
        var changed = original; changed[changed.count - 1] ^= 1
        let block = VaultCrypto.chunk + VaultCrypto.overhead, head = VaultCrypto.headerSize
        var reordered = original
        reordered.replaceSubrange(head..<(head + block), with: original[(head + block)..<(head + 2 * block)])
        reordered.replaceSubrange((head + block)..<(head + 2 * block), with: original[head..<(head + block)])
        let truncated = Data(original.prefix(head + block))
        let extra = original + Data(repeating: 0, count: VaultCrypto.overhead)
        for damaged in [changed, reordered, truncated, extra, Data(original.dropLast())] {
            try damaged.write(to: encrypted)
            XCTAssertThrowsError(try VaultCrypto.Reader(url: encrypted, key: key, name: "files:doc").digest())
        }
    }
    func testEmptyAuthenticationAndExistingSymlinkAreNotBypassed() throws {
        let root = try directory(), key = SymmetricKey(size: .bits256)
        let source = root.appendingPathComponent("input"), encrypted = root.appendingPathComponent("cipher")
        try Data().write(to: source)
        try VaultCrypto.encrypt(source: source, destination: encrypted, key: key, name: "empty")
        var bytes = try Data(contentsOf: encrypted); bytes[bytes.count - 1] ^= 1
        try bytes.write(to: encrypted)
        XCTAssertThrowsError(try VaultCrypto.Reader(url: encrypted, key: key, name: "empty").read(offset: 0))
        let link = root.appendingPathComponent("link")
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: source)
        XCTAssertThrowsError(try VaultCrypto.encrypt(source: source, destination: link, key: key, name: "x"))
        XCTAssertEqual(try Data(contentsOf: source), Data())
        XCTAssertThrowsError(try VaultCrypto.plainSize(UInt64(VaultCrypto.headerSize + VaultCrypto.chunk + 2 * VaultCrypto.overhead)))
    }
    func testNFCPasswordAndKDFBounds() throws {
        let salt = Data(repeating: 0x31, count: 16)
        let a = try VaultCrypto.passwordKey("Gemäßigtes Passwort €", salt: salt)
        let b = try VaultCrypto.passwordKey("Gema\u{308}ßigtes Passwort €", salt: salt)
        XCTAssertEqual(a.withUnsafeBytes { Data($0) }, b.withUnsafeBytes { Data($0) })
        XCTAssertThrowsError(try VaultCrypto.passwordKey("x", salt: salt, rounds: 99_999))
        XCTAssertThrowsError(try VaultCrypto.passwordKey("x", salt: salt, rounds: 10_000_001))
        XCTAssertThrowsError(try VaultCrypto.passwordKey("", salt: salt))
    }
    func testAllThreeOfFiveSelectionsAndInvalidRecoveryInputs() throws {
        let secret = Data(0..<32), set = Data([1, 2, 3, 4])
        let shares = try VaultRecovery.split(secret, set: set)
        for a in 0..<3 { for b in (a + 1)..<4 { for c in (b + 1)..<5 {
            let selected = try [shares[a], shares[b], shares[c]].map { try VaultRecovery.decode(VaultRecovery.encode($0).lowercased().replacingOccurrences(of: "-", with: " ").replacingOccurrences(of: "0", with: "o")) }
            XCTAssertEqual(try VaultRecovery.combine(selected), secret)
        } } }
        XCTAssertThrowsError(try VaultRecovery.combine(Array(shares.prefix(2))))
        XCTAssertThrowsError(try VaultRecovery.combine([shares[0], shares[0], shares[2]]))
        let other = try VaultRecovery.split(secret, set: Data([5, 6, 7, 8]))
        XCTAssertThrowsError(try VaultRecovery.combine([shares[0], shares[1], other[2]]))
        var typo = Array(VaultRecovery.encode(shares[0])); typo[12] = typo[12] == "A" ? "B" : "A"
        XCTAssertThrowsError(try VaultRecovery.decode(String(typo)))
    }
}
