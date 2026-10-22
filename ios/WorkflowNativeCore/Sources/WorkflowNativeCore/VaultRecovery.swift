import Foundation
import CryptoKit

public enum RecoveryFailure: String, Error {
    case typo = "VAULT_RECOVERY_TYPO"
    case incomplete = "VAULT_RECOVERY_INCOMPLETE"
    case mixed = "VAULT_RECOVERY_MIXED"
    case duplicate = "VAULT_RECOVERY_DUPLICATE"
}

/// Same WFP1 shares as Android and Windows. Secrets never need a JavaScript hop.
public enum VaultRecovery {
    public struct Share: Equatable {
        public let set: Data
        public let threshold: UInt8
        public let index: UInt8
        public let data: Data
    }
    private static let alphabet = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
    private static func multiply(_ a: UInt8, _ b: UInt8) -> UInt8 {
        var x = a, y = b, out: UInt8 = 0
        for _ in 0..<8 {
            if y & 1 != 0 { out ^= x }
            let high = x & 0x80
            x = x &<< 1
            if high != 0 { x ^= 0x1b }
            y >>= 1
        }
        return out
    }
    private static func inverse(_ value: UInt8) -> UInt8 {
        var result: UInt8 = 1, base = value, power = 254
        while power > 0 {
            if power & 1 != 0 { result = multiply(result, base) }
            base = multiply(base, base); power >>= 1
        }
        return result
    }
    public static func split(_ secret: Data, set: Data, count: UInt8 = 5, threshold: UInt8 = 3) throws -> [Share] {
        guard secret.count == 32, set.count == 4, threshold >= 2, count >= threshold else { throw RecoveryFailure.typo }
        var values = Array(repeating: Data(count: 32), count: Int(count))
        for (position, byte) in secret.enumerated() {
            var coefficients = SymmetricKey(size: .bits256).withUnsafeBytes { Data($0.prefix(Int(threshold) - 1)) }
            // Larger thresholds need additional independent random bytes.
            while coefficients.count < Int(threshold) - 1 {
                coefficients.append(SymmetricKey(size: .bits256).withUnsafeBytes { Data($0) })
            }
            coefficients = Data(coefficients.prefix(Int(threshold) - 1))
            coefficients.insert(byte, at: 0)
            for slot in 0..<Int(count) {
                var value: UInt8 = 0
                for coefficient in coefficients.reversed() { value = multiply(value, UInt8(slot + 1)) ^ coefficient }
                values[slot][position] = value
            }
            coefficients.resetBytes(in: 0..<coefficients.count)
        }
        return values.enumerated().map { Share(set: set, threshold: threshold, index: UInt8($0.offset + 1), data: $0.element) }
    }
    public static func combine(_ shares: [Share]) throws -> Data {
        guard let first = shares.first else { throw RecoveryFailure.incomplete }
        var seen = Set<UInt8>()
        for share in shares {
            guard share.set.count == 4, share.set == first.set, share.threshold == first.threshold,
                  share.threshold >= 2, share.data.count == 32, share.index > 0 else { throw RecoveryFailure.mixed }
            guard seen.insert(share.index).inserted else { throw RecoveryFailure.duplicate }
        }
        guard shares.count >= Int(first.threshold) else { throw RecoveryFailure.incomplete }
        let used = Array(shares.prefix(Int(first.threshold)))
        var result = Data(count: 32)
        for byte in 0..<32 {
            for (i, share) in used.enumerated() {
                var numerator: UInt8 = 1, denominator: UInt8 = 1
                for (j, other) in used.enumerated() where i != j {
                    numerator = multiply(numerator, other.index)
                    denominator = multiply(denominator, other.index ^ share.index)
                }
                result[byte] ^= multiply(share.data[byte], multiply(numerator, inverse(denominator)))
            }
        }
        return result
    }
    public static func encode(_ share: Share) -> String {
        var payload = Data([1]); payload.append(share.set)
        payload.append(share.threshold); payload.append(share.index); payload.append(share.data)
        payload.append(contentsOf: SHA256.hash(data: payload).prefix(2))
        var buffer: UInt32 = 0, bits = 0
        var body: [Character] = []
        for byte in payload {
            buffer = (buffer &<< 8) | UInt32(byte); bits += 8
            while bits >= 5 { bits -= 5; body.append(alphabet[Int((buffer >> bits) & 31)]) }
        }
        if bits > 0 { body.append(alphabet[Int((buffer &<< (5 - bits)) & 31)]) }
        return "WFP1-" + stride(from: 0, to: body.count, by: 5).map { String(body[$0..<min($0 + 5, body.count)]) }.joined(separator: "-")
    }
    public static func decode(_ text: String) throws -> Share {
        guard text.utf8.count <= 1024 else { throw RecoveryFailure.typo }
        let cleaned = text.uppercased().filter { !$0.isWhitespace && $0 != "-" }
        guard cleaned.hasPrefix("WFP1") else { throw RecoveryFailure.typo }
        var buffer: UInt32 = 0, bits = 0, bytes = Data()
        for raw in cleaned.dropFirst(4) {
            let char: Character = raw == "O" ? "0" : (["I", "L"].contains(raw) ? "1" : raw)
            guard let value = alphabet.firstIndex(of: char) else { throw RecoveryFailure.typo }
            buffer = (buffer &<< 5) | UInt32(value); bits += 5
            if bits >= 8 { bits -= 8; bytes.append(UInt8(truncatingIfNeeded: buffer >> bits)) }
        }
        guard bytes.count == 41, bytes[0] == 1,
              Data(SHA256.hash(data: bytes.prefix(39)).prefix(2)) == bytes.suffix(2),
              bytes[5] >= 2, bytes[6] > 0 else { throw RecoveryFailure.typo }
        return Share(set: bytes.subdata(in: 1..<5), threshold: bytes[5], index: bytes[6], data: bytes.subdata(in: 7..<39))
    }
}
