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
    case "vault-write", "vault-read":
        let local = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: local, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: local) }
        let grant = VaultFolderGrant(metadata: local.appendingPathComponent("grant"))
        try grant.select(URL(fileURLWithPath: args[2], isDirectory: true))
        let vault = try DocumentVault(folder: VaultFolder(grant: grant), scratch: local.appendingPathComponent("scratch"), checkpoint: local.appendingPathComponent("checkpoint"))
        if args[1] == "vault-write" {
            try vault.initialize(password: "Gemäßigtes Passwort €")
            let ticket = try vault.begin(store: "files", id: "doc-1")
            let input = try FileHandle(forReadingFrom: URL(fileURLWithPath: args[3]))
            defer { try? input.close() }
            var size: UInt64 = 0
            while let bytes = try input.read(upToCount: VaultCrypto.chunk), !bytes.isEmpty {
                try vault.append(ticket: ticket, offset: size, bytes: bytes); size += UInt64(bytes.count)
            }
            print(try vault.finish(ticket: ticket, size: size).hash)
        } else {
            try vault.open(password: "Gema\u{308}ßigtes Passwort €")
            var digest = SHA256(), offset: UInt64 = 0
            while true {
                let bytes = try vault.read(store: "files", id: "doc-1", offset: offset)
                if bytes.isEmpty { break }
                digest.update(data: bytes); offset += UInt64(bytes.count)
            }
            let hash = digest.finalize().map { String(format: "%02x", $0) }.joined()
            guard try vault.info(store: "files", id: "doc-1")?.hash == hash else { throw VaultFailure.damaged }
            print(hash)
        }
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
