import Foundation
import CryptoKit
import CommonCrypto
import Darwin

public enum VaultFailure: String, Error {
    case damaged = "VAULT_DAMAGED"
    case unavailable = "VAULT_UNAVAILABLE"
    case invalidInput = "INVALID_INPUT"
}

/// PBV1 as used by Android VaultCrypto.java and windows/core/src/crypto.rs.
/// This is the file codec, not a provider, password UI or complete document vault.
public enum VaultCrypto {
    public static let chunk = 262_144
    public static let headerSize = 69
    public static let overhead = 28
    public static let iterations = 600_000

    public static func passwordKey(_ password: String, salt: Data, rounds: Int = iterations) throws -> SymmetricKey {
        guard !password.isEmpty, !salt.isEmpty, (100_000...10_000_000).contains(rounds) else {
            throw VaultFailure.invalidInput
        }
        var utf8 = Data(password.precomposedStringWithCanonicalMapping.utf8)
        defer { utf8.resetBytes(in: 0..<utf8.count) }
        var result = Data(count: 32)
        let status = result.withUnsafeMutableBytes { output in
            utf8.withUnsafeBytes { input in
                salt.withUnsafeBytes { saltBytes in
                    CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2),
                        input.bindMemory(to: Int8.self).baseAddress, input.count,
                        saltBytes.bindMemory(to: UInt8.self).baseAddress, saltBytes.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), UInt32(rounds),
                        output.bindMemory(to: UInt8.self).baseAddress, output.count)
                }
            }
        }
        defer { result.resetBytes(in: 0..<result.count) }
        guard status == kCCSuccess else { throw VaultFailure.unavailable }
        return SymmetricKey(data: result)
    }

    public static func seal(_ plain: Data, key: SymmetricKey, aad: Data) throws -> Data {
        guard key.bitCount == 256 else { throw VaultFailure.invalidInput }
        guard let sealed = try AES.GCM.seal(plain, using: key, authenticating: aad).combined else {
            throw VaultFailure.unavailable
        }
        return sealed
    }

    public static func open(_ sealed: Data, key: SymmetricKey, aad: Data) throws -> Data {
        guard key.bitCount == 256, sealed.count >= overhead else { throw VaultFailure.damaged }
        do { return try AES.GCM.open(AES.GCM.SealedBox(combined: sealed), using: key, authenticating: aad) }
        catch { throw VaultFailure.damaged }
    }

    public static func plainSize(_ encrypted: UInt64) throws -> UInt64 {
        guard encrypted >= UInt64(headerSize + overhead) else { throw VaultFailure.damaged }
        let body = encrypted - UInt64(headerSize), full = UInt64(chunk + overhead)
        let tail = body % full
        guard tail == 0 || (tail >= UInt64(overhead) && (tail != UInt64(overhead) || body < full)) else { throw VaultFailure.damaged }
        return body / full * UInt64(chunk) + (tail == 0 ? 0 : tail - UInt64(overhead))
    }

    private static func aad(_ header: Data, name: String, index: UInt64, last: Bool) -> Data {
        var result = header
        result.append(contentsOf: name.utf8)
        result.append(0)
        var bigEndian = index.bigEndian
        withUnsafeBytes(of: &bigEndian) { result.append(contentsOf: $0) }
        result.append(last ? 1 : 0)
        return result
    }

    private static func exact(_ handle: FileHandle, count: Int) throws -> Data {
        var result = Data()
        while result.count < count {
            guard let part = try handle.read(upToCount: count - result.count), !part.isEmpty else {
                throw VaultFailure.damaged
            }
            result.append(part)
        }
        return result
    }

    private static func nextBlock(_ handle: FileHandle) throws -> Data {
        var result = Data()
        while result.count < chunk {
            guard let part = try handle.read(upToCount: chunk - result.count), !part.isEmpty else { break }
            result.append(part)
        }
        return result
    }

    /// Bounded memory; caller supplies a new destination and owns publication.
    /// A failure removes only the file created by this call.
    public static func encrypt(source: URL, destination: URL, key: SymmetricKey, name: String) throws {
        let input = try FileHandle(forReadingFrom: source)
        defer { try? input.close() }
        let descriptor = Darwin.open(destination.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, S_IRUSR | S_IWUSR)
        guard descriptor >= 0 else { throw VaultFailure.unavailable }
        let output = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        defer { try? output.close() }
        do {
            let fileKey = SymmetricKey(size: .bits256)
            var rawKey = fileKey.withUnsafeBytes { Data($0) }
            defer { rawKey.resetBytes(in: 0..<rawKey.count) }
            let wrapped = try seal(rawKey, key: key, aad: Data(("pbv1-key|" + name).utf8))
            // PBV1, version 1, big endian 262144, nonce + wrapped key + tag.
            var header = Data([0x50, 0x42, 0x56, 0x31, 1, 0, 4, 0, 0])
            header.append(wrapped)
            try output.write(contentsOf: header)
            var current = try nextBlock(input)
            var index: UInt64 = 0
            while true {
                let next = try nextBlock(input)
                let last = next.isEmpty
                try output.write(contentsOf: seal(current, key: fileKey, aad: aad(header, name: name, index: index, last: last)))
                current.resetBytes(in: 0..<current.count)
                if last { break }
                current = next
                index += 1
            }
            try output.synchronize()
        } catch {
            try? FileManager.default.removeItem(at: destination)
            throw error
        }
    }

    /// Reader verifies name, chunk position and final marker. Serial callers only.
    public final class Reader {
        private let input: FileHandle
        private let key: SymmetricKey
        private let header: Data
        private let name: String
        public let size: UInt64
        private let chunks: UInt64
        public init(url: URL, key: SymmetricKey, name: String) throws {
            let handle = try FileHandle(forReadingFrom: url)
            do {
                size = try plainSize(handle.seekToEnd())
                chunks = max(1, (size + UInt64(chunk) - 1) / UInt64(chunk))
                try handle.seek(toOffset: 0)
                let bytes = try exact(handle, count: headerSize)
                guard bytes.prefix(9) == Data([0x50, 0x42, 0x56, 0x31, 1, 0, 4, 0, 0]) else {
                    throw VaultFailure.damaged
                }
                var rawKey = try open(Data(bytes.dropFirst(9)), key: key, aad: Data(("pbv1-key|" + name).utf8))
                defer { rawKey.resetBytes(in: 0..<rawKey.count) }
                guard rawKey.count == 32 else { throw VaultFailure.damaged }
                self.key = SymmetricKey(data: rawKey)
                header = bytes
                self.name = name
                input = handle
            } catch { try? handle.close(); throw error }
        }
        deinit { try? input.close() }
        public func block(_ index: UInt64) throws -> Data {
            guard index < chunks else { throw VaultFailure.invalidInput }
            let last = index == chunks - 1
            let length = Int(last ? size - index * UInt64(chunk) : UInt64(chunk)) + overhead
            try input.seek(toOffset: UInt64(headerSize) + index * UInt64(chunk + overhead))
            return try open(exact(input, count: length), key: key, aad: aad(header, name: name, index: index, last: last))
        }
        public func read(offset: UInt64, maximum: Int = chunk) throws -> Data {
            guard offset <= size, (0...chunk).contains(maximum) else { throw VaultFailure.invalidInput }
            // Authenticate even the empty file's mandatory final block.
            if size == 0 { _ = try block(0); return Data() }
            if offset == size { return Data() }
            var bytes = try block(offset / UInt64(chunk))
            defer { bytes.resetBytes(in: 0..<bytes.count) }
            return bytes.subdata(in: Int(offset % UInt64(chunk))..<min(bytes.count, Int(offset % UInt64(chunk)) + maximum))
        }
        public func digest() throws -> String {
            var hash = SHA256()
            for index in 0..<chunks {
                var bytes = try block(index)
                hash.update(data: bytes)
                bytes.resetBytes(in: 0..<bytes.count)
            }
            return hash.finalize().map { String(format: "%02x", $0) }.joined()
        }
    }
}
