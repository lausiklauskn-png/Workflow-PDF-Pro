import Capacitor
import UIKit
import WebKit
import CryptoKit
import WorkflowNativeCore

/// All file state runs on one queue. UIKit presentation always runs on main.
class WorkflowPlugin: CAPPlugin {
    static let io = DispatchQueue(label: "de.familyprojekt.workflowpdf.ios.files")
    func perform(_ call: CAPPluginCall, _ operation: @escaping () throws -> JSObject) {
        Self.io.async {
            do { call.resolve(try operation()) }
            catch let error as WorkflowError { call.reject(error.rawValue, error.rawValue) }
            catch { call.reject("Dateiaktion fehlgeschlagen. Es wurde kein Erfolg bestätigt.", "FILE_UNAVAILABLE") }
        }
    }
    func number(_ call: CAPPluginCall, _ key: String) throws -> UInt64 {
        guard let value = call.getDouble(key), value.isFinite, value >= 0,
              value <= 9_007_199_254_740_991, value.rounded() == value
        else { throw WorkflowError.invalidTransfer }
        return UInt64(value)
    }
    func text(_ call: CAPPluginCall, _ key: String) throws -> String {
        guard let value = call.getString(key) else { throw WorkflowError.invalidTransfer }
        return value
    }
    override func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        if navigationAction.targetFrame?.isMainFrame == true || navigationAction.targetFrame == nil {
            return WorkflowMessageGate.trusted(navigationAction.request.url) ? nil : NSNumber(value: true)
        }
        // No subframe receives a native bridge, including same-origin frames.
        let scheme = navigationAction.request.url?.scheme
        return ["blob", "about", "capacitor"].contains(scheme ?? "") ? nil : NSNumber(value: true)
    }
}

@objc(WorkflowFilesPlugin)
final class WorkflowFilesPlugin: WorkflowPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "WorkflowFilesPlugin"
    public let jsName = "WorkflowFiles"
    public let pluginMethods: [CAPPluginMethod] = ["appInfo", "begin", "append", "finish", "abort", "save", "share", "print", "openLink"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var transfers: Transfers?
    private var exportCall: CAPPluginCall?
    private var exportFile: URL?
    private var presenting = false
    private func store() throws -> Transfers {
        if let transfers = transfers { return transfers }
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("wfp-transfers-" + UUID().uuidString)
        let value = try Transfers(root: root)
        transfers = value
        return value
    }
    @objc func appInfo(_ call: CAPPluginCall) {
        call.resolve(["version": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "", "platform": "ios"])
    }
    @objc func begin(_ call: CAPPluginCall) {
        perform(call) { [self] in ["id": try store().begin(name: text(call, "name"), mime: call.getString("mime") ?? "application/octet-stream")] }
    }
    @objc func append(_ call: CAPPluginCall) {
        perform(call) { [self] in ["size": try store().append(id: text(call, "id"), offset: number(call, "offset"), base64: text(call, "data"))] }
    }
    @objc func finish(_ call: CAPPluginCall) {
        perform(call) { [self] in try store().finish(id: text(call, "id"), size: number(call, "size")); return ["ok": true] }
    }
    @objc func abort(_ call: CAPPluginCall) {
        perform(call) { [self] in try store().abort(id: text(call, "id")); return ["ok": true] }
    }
    @objc func save(_ call: CAPPluginCall) {
        Self.io.async { [self] in
            do {
                let file = try store().file(id: text(call, "id"))
                DispatchQueue.main.async { [self] in
                    guard !presenting, let viewController = bridge?.viewController, viewController.presentedViewController == nil else { call.reject("Eine Dateiaktion ist bereits geöffnet.", "FILE_BUSY"); return }
                    presenting = true; exportCall = call; exportFile = file
                    let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
                    picker.delegate = self
                    viewController.present(picker, animated: true)
                }
            } catch { call.reject("FILE_INVALID_TRANSFER", "FILE_INVALID_TRANSFER") }
        }
    }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        let call = exportCall
        exportCall = nil; exportFile = nil; presenting = false
        call?.resolve(["saved": false, "cancelled": true])
    }
    private func digest(_ url: URL) throws -> Data {
        let file = try FileHandle(forReadingFrom: url)
        defer { try? file.close() }
        var hash = SHA256()
        while let part = try file.read(upToCount: Transfers.chunk), !part.isEmpty { hash.update(data: part) }
        return Data(hash.finalize())
    }
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = exportCall, let source = exportFile else { return }
        exportCall = nil; exportFile = nil; presenting = false
        Self.io.async { [self] in
            guard urls.count == 1, let target = urls.first else { call.reject("FILE_SAVE_FAILED", "FILE_SAVE_FAILED"); return }
            let scoped = target.startAccessingSecurityScopedResource()
            defer { if scoped { target.stopAccessingSecurityScopedResource() } }
            var failure: Error?
            var verified = false
            NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: target, options: [], error: nil) { coordinated in
                do { verified = try digest(source) == digest(coordinated) } catch { failure = error }
            }
            guard verified, failure == nil else { call.reject("Die gespeicherte Datei konnte nicht bestätigt werden.", "FILE_SAVE_FAILED"); return }
            call.resolve(["saved": true, "verified": true])
        }
    }
    @objc func share(_ call: CAPPluginCall) {
        Self.io.async { [self] in
            do {
                let ids = call.getArray("ids", String.self) ?? []
                guard ids.count <= 128 else { throw WorkflowError.invalidTransfer }
                var items: [Any] = try ids.map { try store().file(id: $0) }
                if let text = call.getString("text"), !text.isEmpty { items.append(text) }
                if let raw = call.getString("url"), !raw.isEmpty {
                    guard let url = URL(string: raw), ["https", "http"].contains(url.scheme?.lowercased() ?? "") else { throw WorkflowError.invalidTransfer }
                    items.append(url)
                }
                guard !items.isEmpty else { throw WorkflowError.invalidTransfer }
                DispatchQueue.main.async { [self] in
                    guard !presenting, let viewController = bridge?.viewController, viewController.presentedViewController == nil else { call.reject("FILE_BUSY", "FILE_BUSY"); return }
                    presenting = true
                    let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
                    sheet.popoverPresentationController?.sourceView = viewController.view
                    sheet.popoverPresentationController?.sourceRect = CGRect(x: viewController.view.bounds.midX, y: viewController.view.bounds.midY, width: 1, height: 1)
                    sheet.completionWithItemsHandler = { [weak self] _, completed, _, error in
                        self?.presenting = false
                        if error != nil { call.reject("FILE_SHARE_FAILED", "FILE_SHARE_FAILED") }
                        else if !completed { call.reject("Abgebrochen", "USER_CANCELLED") }
                        else { call.resolve(["opened": true, "deliveryConfirmed": false]) }
                    }
                    viewController.present(sheet, animated: true)
                }
            } catch { call.reject("FILE_INVALID_TRANSFER", "FILE_INVALID_TRANSFER") }
        }
    }
    @objc func print(_ call: CAPPluginCall) {
        Self.io.async { [self] in
            do {
                let file = try store().file(id: text(call, "id"))
                DispatchQueue.main.async { [self] in
                    guard !presenting, let view = bridge?.viewController?.view, UIPrintInteractionController.canPrint(file) else { call.reject("FILE_PRINT_UNAVAILABLE", "FILE_PRINT_UNAVAILABLE"); return }
                    presenting = true
                    let printer = UIPrintInteractionController.shared
                    printer.printingItem = file
                    let done: (UIPrintInteractionController, Bool, Error?) -> Void = { [weak self] _, completed, error in
                        self?.presenting = false
                        if error != nil { call.reject("FILE_PRINT_FAILED", "FILE_PRINT_FAILED") }
                        else { call.resolve(["printed": completed, "cancelled": !completed]) }
                    }
                    printer.present(from: CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1), in: view, animated: true, completionHandler: done)
                }
            } catch { call.reject("FILE_INVALID_TRANSFER", "FILE_INVALID_TRANSFER") }
        }
    }
    @objc func openLink(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw),
              ["https", "http", "mailto", "tel"].contains(url.scheme?.lowercased() ?? ""), url.user == nil, url.password == nil
        else { call.reject("NOT_ALLOWED", "NOT_ALLOWED"); return }
        DispatchQueue.main.async { UIApplication.shared.open(url) { opened in
            if opened { call.resolve(["opened": true]) } else { call.reject("LINK_UNAVAILABLE", "LINK_UNAVAILABLE") }
        } }
    }
}
