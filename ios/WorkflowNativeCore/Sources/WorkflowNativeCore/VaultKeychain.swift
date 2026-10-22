import Foundation
import Security
import CryptoKit

public enum VaultKeychainFailure: String, Error {
    case unavailable = "VAULT_UNAVAILABLE"
    case locked = "VAULT_LOCKED"
}

/// Optional device-only remembered data keys, never passwords. This class is not
/// registered as a Capacitor plugin. The portable vault uses password wrapping.
public final class VaultKeychain {
    private let service: String
    public init(service: String = "de.familyprojekt.workflowpdf.pro.vault") { self.service = service }
    private func query(_ vaultID: String) throws -> [String: Any] {
        guard UUID(uuidString: vaultID) != nil else { throw VaultKeychainFailure.unavailable }
        return [kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: vaultID.lowercased(),
                kSecAttrSynchronizable as String: false]
    }
    public func remember(_ key: SymmetricKey, vaultID: String) throws {
        guard key.bitCount == 256 else { throw VaultKeychainFailure.unavailable }
        let base = try query(vaultID)
        var bytes = key.withUnsafeBytes { Data($0) }
        defer { bytes.resetBytes(in: 0..<bytes.count) }
        let attributes: [String: Any] = [kSecValueData as String: bytes,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        let updated = SecItemUpdate(base as CFDictionary, attributes as CFDictionary)
        if updated == errSecItemNotFound {
            var add = base; attributes.forEach { add[$0.key] = $0.value }
            guard SecItemAdd(add as CFDictionary, nil) == errSecSuccess else { throw VaultKeychainFailure.unavailable }
        } else if updated != errSecSuccess { throw VaultKeychainFailure.unavailable }
    }
    public func recalled(vaultID: String) throws -> SymmetricKey {
        var request = try query(vaultID)
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        request[kSecUseAuthenticationUI as String] = kSecUseAuthenticationUIFail
        var value: CFTypeRef?
        guard SecItemCopyMatching(request as CFDictionary, &value) == errSecSuccess,
              var bytes = value as? Data, bytes.count == 32 else { throw VaultKeychainFailure.locked }
        defer { bytes.resetBytes(in: 0..<bytes.count) }
        return SymmetricKey(data: bytes)
    }
    public func forget(vaultID: String) throws {
        let status = SecItemDelete(try query(vaultID) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw VaultKeychainFailure.unavailable }
    }
}
