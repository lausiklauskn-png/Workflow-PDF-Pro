import Capacitor
import UIKit
import WorkflowNativeCore

final class WorkflowIntake {
    static let shared = WorkflowIntake()
    private var store: IncomingStore?
    func inbox() throws -> IncomingStore {
        if let store = store { return store }
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let root = support.appendingPathComponent("WorkflowIncoming", isDirectory: true)
        let value = try IncomingStore(root: root)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: root.path)
        store = value
        return value
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
                try inbox().receive(coordinated)
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
    private func object(_ batch: IncomingBatch) throws -> JSObject {
        let bytes = try JSONEncoder().encode(batch)
        guard let value = try JSONSerialization.jsonObject(with: bytes) as? JSObject else { throw WorkflowError.damagedInbox }
        return value
    }
    @objc func pending(_ call: CAPPluginCall) {
        perform(call) { [self] in
            guard let batch = try WorkflowIntake.shared.inbox().pending() else { return ["empty": true] }
            return try object(batch)
        }
    }
    @objc func read(_ call: CAPPluginCall) {
        perform(call) { [self] in
            let (data, done) = try WorkflowIntake.shared.inbox().read(batch: text(call, "batch"), id: text(call, "id"), offset: number(call, "offset"))
            return ["data": data.base64EncodedString(), "done": done]
        }
    }
    @objc func acknowledge(_ call: CAPPluginCall) {
        perform(call) { [self] in try WorkflowIntake.shared.inbox().acknowledge(id: text(call, "id"), discard: call.getBool("discard") ?? false); return [:] }
    }
    @objc func history(_ call: CAPPluginCall) {
        perform(call) { [self] in ["receipts": try WorkflowIntake.shared.inbox().history().map { try object($0) }] }
    }
    @objc func restore(_ call: CAPPluginCall) {
        perform(call) { [self] in try WorkflowIntake.shared.inbox().restore(id: text(call, "id")); return [:] }
    }
    @objc func discardArchived(_ call: CAPPluginCall) {
        perform(call) { [self] in try WorkflowIntake.shared.inbox().discardArchived(id: text(call, "id")); return [:] }
    }
}
