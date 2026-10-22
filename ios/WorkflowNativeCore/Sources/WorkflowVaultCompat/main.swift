// Test-only CLI. Never included in the application target or its web bundle.
import Foundation
import CryptoKit
import WorkflowNativeCore

let args = CommandLine.arguments
let key = SymmetricKey(data: Data(0..<32)) // Public, synthetic interoperability key.
let name = "workflow-pdf-pro-vault:compat:files:Мюллер"
do {
    switch args[1] {
    case "write":
        try VaultCrypto.encrypt(source: URL(fileURLWithPath: args[2]), destination: URL(fileURLWithPath: args[3]), key: key, name: name)
    case "read":
        print(try VaultCrypto.Reader(url: URL(fileURLWithPath: args[2]), key: key, name: name).digest())
    case "derive":
        let derived = try VaultCrypto.passwordKey("Gema\u{308}ßigtes Passwort €", salt: Data(0..<16))
        print(derived.withUnsafeBytes { $0.map { String(format: "%02x", $0) }.joined() })
    case "split":
        for share in try VaultRecovery.split(Data(0..<32), set: Data([5, 6, 7, 8])) { print(VaultRecovery.encode(share)) }
    case "combine":
        let result = try VaultRecovery.combine(args.dropFirst(2).map { try VaultRecovery.decode($0) })
        print(result.map { String(format: "%02x", $0) }.joined())
    default: throw VaultFailure.invalidInput
    }
} catch {
    // No plaintext, shares or passwords in error reports.
    FileHandle.standardError.write(Data("Vault compatibility operation failed\n".utf8))
    exit(1)
}
