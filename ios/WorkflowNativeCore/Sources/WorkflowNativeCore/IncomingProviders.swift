import Foundation
import UniformTypeIdentifiers

/// Copy each provider-owned temporary URL during its callback. Publish one batch
/// only after all representations have arrived and cancellation is checked.
public enum IncomingProviders {
    public static func receive(_ providers: [NSItemProvider], into store: SharedIncomingStore,
                               staging: URL, willCommit: @escaping () async -> Void = {}) async throws -> IncomingBatch {
        guard !providers.isEmpty, providers.count <= 256 else { throw WorkflowError.invalidTransfer }
        let directory = staging.appendingPathComponent("share-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        var files: [URL] = []
        for (index, provider) in providers.enumerated() {
            try Task.checkCancellation()
            // Prefer the original document representation over a preview image.
            let supported = provider.registeredTypeIdentifiers.filter { identifier in
                guard let type = UTType(identifier) else { return false }
                return type.conforms(to: .pdf) || type.conforms(to: .image) || type.conforms(to: .json)
            }
            guard let type = supported.first(where: { UTType($0)?.conforms(to: .pdf) == true }) ?? supported.first else {
                throw WorkflowError.invalidTransfer
            }
            let destination = directory.appendingPathComponent(String(index), isDirectory: true)
            try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: false)
            let file: URL = try await withCheckedThrowingContinuation { continuation in
                provider.loadFileRepresentation(forTypeIdentifier: type) { url, error in
                    do {
                        if let error = error { throw error }
                        guard let url = url else { throw WorkflowError.unavailable }
                        let scoped = url.startAccessingSecurityScopedResource()
                        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                        var coordinationError: NSError?, outcome: Result<URL, Error>?
                        NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: url, options: [], error: &coordinationError) { source in
                            outcome = Result {
                                let values = try source.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
                                guard values.isRegularFile == true, values.isSymbolicLink != true else { throw WorkflowError.unavailable }
                                var filename = Transfers.filename(provider.suggestedName ?? source.lastPathComponent)
                                if URL(fileURLWithPath: filename).pathExtension.isEmpty, let ext = UTType(type)?.preferredFilenameExtension {
                                    filename += "." + ext
                                }
                                let target = destination.appendingPathComponent(filename)
                                try FileManager.default.copyItem(at: source, to: target)
                                return target
                            }
                        }
                        if let error = coordinationError { throw error }
                        guard let outcome = outcome else { throw WorkflowError.unavailable }
                        continuation.resume(with: outcome)
                    } catch { continuation.resume(throwing: error) }
                }
            }
            files.append(file)
        }
        try Task.checkCancellation()
        await willCommit()
        try Task.checkCancellation()
        return try store.access { try $0.receive(files) }
    }
}
