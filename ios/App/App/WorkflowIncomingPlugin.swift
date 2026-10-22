import Capacitor
import UIKit
import WorkflowNativeCore

final class WorkflowIntake {
    static let shared = WorkflowIntake()
    private var store: IncomingStore?
    private func legacyInbox() throws -> IncomingStore {
        if let store = store { return store }
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let root = support.appendingPathComponent("WorkflowIncoming", isDirectory: true)
        let value = try IncomingStore(root: root)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: root.path)
        store = value
        return value
    }
    // Keep the pre-extension inbox readable. Never silently move or abandon
    // existing receipts while switching new intake to the shared container.
    func access<T>(_ operation: (IncomingStore, IncomingStore) throws -> T) throws -> T {
        try SharedIncomingStore.live().access { shared in try operation(legacyInbox(), shared) }
    }
    func pending() throws -> IncomingBatch? { try access { try $0.pending() ?? $1.pending() } }
    func read(batch: String, id: String, offset: UInt64) throws -> (Data, Bool) {
        try access { legacy, shared in
            let source = try legacy.pending()?.id == batch ? legacy : shared
            return try source.read(batch: batch, id: id, offset: offset)
        }
    }
    func acknowledge(id: String, discard: Bool) throws {
        try access { legacy, shared in
            let source = try legacy.pending()?.id == id ? legacy : shared
            try source.acknowledge(id: id, discard: discard)
        }
    }
    func history() throws -> [IncomingBatch] { try access { try $0.history() + $1.history() } }
    func restore(id: String, discard: Bool = false) throws {
        try access { legacy, shared in
            let source = try legacy.history().contains(where: { $0.id == id }) ? legacy : shared
            if discard { try source.discardArchived(id: id) } else { try source.restore(id: id) }
        }
    }
    func receive(_ urls: [URL], controller: UIViewController?) {
        guard !urls.isEmpty else { return }
        WorkflowPlugin.io.async { [self] in
            do {
                var coordinated: [URL] = []
                let staging = FileManager.default.temporaryDirectory.appendingPathComponent("wfp-received-" + UUID().uuidString)
                try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: false)
                defer { try? FileManager.default.removeItem(at: staging) }
                for (index, url) in urls.enumerated() {
                    let scoped = url.startAccessingSecurityScopedResource()
                    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                    var error: NSError?
                    var copyingError: Error?
                    let folder = staging.appendingPathComponent(String(index), isDirectory: true)
                    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
                    let target = folder.appendingPathComponent(Transfers.filename(url.lastPathComponent))
                    NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: url, options: [], error: &error) { file in
                        do {
                            guard try file.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink != true else { throw WorkflowError.unavailable }
                            try FileManager.default.copyItem(at: file, to: target)
                        } catch { copyingError = error }
                    }
                    if let failure = error ?? copyingError as NSError? { throw failure }
                    coordinated.append(target)
                }
                _ = try access { _, shared in try shared.receive(coordinated) }
                DispatchQueue.main.async { NotificationCenter.default.post(name: .workflowIncomingChanged, object: nil) }
            } catch {
                DispatchQueue.main.async {
                    let alert = UIAlertController(title: "Dateien nicht eingelesen", message: "Die Dateien konnten nicht vollständig übernommen werden. Bitte erneut aus der Dateien-App öffnen. Vorhandene Dokumente wurden nicht verändert.", preferredStyle: .alert)
                    alert.addAction(UIAlertAction(title: "OK", style: .default))
                    controller?.present(alert, animated: true)
                }
            }
        }
    }
}
extension Notification.Name { static let workflowIncomingChanged = Notification.Name("WorkflowIncomingChanged") }

@objc(WorkflowIncomingPlugin)
final class WorkflowIncomingPlugin: WorkflowPlugin, CAPBridgedPlugin {
    let identifier = "WorkflowIncomingPlugin"
    let jsName = "WorkflowIncoming"
    let pluginMethods: [CAPPluginMethod] = ["pending", "read", "acknowledge", "history", "restore", "discardArchived"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    override func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(changed), name: .workflowIncomingChanged, object: nil)
    }
    deinit { NotificationCenter.default.removeObserver(self) }
    @objc private func changed() { notifyListeners("available", data: [:], retainUntilConsumed: true) }
    private func object(_ batch: IncomingBatch) -> JSObject {
        // Foundation's untyped JSON objects do not reliably conform to
        // Capacitor's Swift JSValue protocol. Build the bridge value explicitly.
        let files: [JSObject] = batch.files.map { file in
            ["id": file.id, "name": file.name, "mime": file.mime, "size": NSNumber(value: file.size)]
        }
        return ["id": batch.id, "files": files]
    }
    @objc func pending(_ call: CAPPluginCall) {
        perform(call) { [self] in
            guard let batch = try WorkflowIntake.shared.pending() else { return ["empty": true] }
            return object(batch)
        }
    }
    @objc func read(_ call: CAPPluginCall) {
        perform(call) { [self] in
            let (data, done) = try WorkflowIntake.shared.read(batch: text(call, "batch"), id: text(call, "id"), offset: number(call, "offset"))
            return ["data": data.base64EncodedString(), "done": done]
        }
    }
    @objc func acknowledge(_ call: CAPPluginCall) {
        perform(call) { [self] in try WorkflowIntake.shared.acknowledge(id: text(call, "id"), discard: call.getBool("discard") ?? false); return [:] }
    }
    @objc func history(_ call: CAPPluginCall) {
        perform(call) { [self] in ["receipts": try WorkflowIntake.shared.history().map { object($0) }] }
    }
    @objc func restore(_ call: CAPPluginCall) {
        perform(call) { [self] in try WorkflowIntake.shared.restore(id: text(call, "id")); return [:] }
    }
    @objc func discardArchived(_ call: CAPPluginCall) {
        perform(call) { [self] in try WorkflowIntake.shared.restore(id: text(call, "id"), discard: true); return [:] }
    }
}
