import Foundation

/// Cross-process serialization for the app and its Share Extension. There is no
/// fallback directory: a missing App Group entitlement remains an explicit error.
public final class SharedIncomingStore {
    public static let group = "group.de.familyprojekt.workflowpdf.pro"
    private let root: URL
    public init(root: URL) { self.root = root }
    public static func live() throws -> SharedIncomingStore {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else { throw WorkflowError.unavailable }
        return SharedIncomingStore(root: container.appendingPathComponent("WorkflowIncoming", isDirectory: true))
    }
    public func access<T>(_ operation: (IncomingStore) throws -> T) throws -> T {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        #if os(iOS)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: root.path)
        #endif
        var coordinationError: NSError?, result: Result<T, Error>?
        NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: root, options: .forMerging, error: &coordinationError) { folder in
            result = Result { try operation(IncomingStore(root: folder)) }
        }
        if let error = coordinationError { throw error }
        guard let result = result else { throw WorkflowError.unavailable }
        return try result.get()
    }
}
