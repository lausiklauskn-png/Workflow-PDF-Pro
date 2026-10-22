import Capacitor
import UIKit
import UniformTypeIdentifiers
import WorkflowNativeCore

@objc(WorkflowImportPlugin)
final class WorkflowImportPlugin: WorkflowPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    let identifier = "WorkflowImportPlugin"
    let jsName = "WorkflowImport"
    let pluginMethods: [CAPPluginMethod] = ["chooseFolder", "read", "release"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var pickerCall: CAPPluginCall?
    private var root: URL?
    private var files: [String: (URL, UInt64)] = [:]
    @objc func chooseFolder(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard pickerCall == nil, let controller = bridge?.viewController, controller.presentedViewController == nil else { call.reject("IMPORT_BUSY", "IMPORT_BUSY"); return }
            pickerCall = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
            picker.delegate = self
            controller.present(picker, animated: true)
        }
    }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pickerCall?.resolve(["cancelled": true]); pickerCall = nil
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pickerCall else { return }
        pickerCall = nil
        perform(call) { [self] in
            try cleanup()
            guard urls.count == 1, let selected = urls.first else { throw WorkflowError.invalidTransfer }
            let scoped = selected.startAccessingSecurityScopedResource()
            defer { if scoped { selected.stopAccessingSecurityScopedResource() } }
            let snapshot = FileManager.default.temporaryDirectory.appendingPathComponent("wfp-import-" + UUID().uuidString)
            root = snapshot
            try FileManager.default.createDirectory(at: snapshot, withIntermediateDirectories: false)
            var result: [JSObject] = []
            var scanError: Error?
            var coordinationError: NSError?
            NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: selected, options: [], error: &coordinationError) { folder in
                do {
                    guard try folder.resourceValues(forKeys: [.isDirectoryKey]).isDirectory == true,
                          let enumerator = FileManager.default.enumerator(at: folder, includingPropertiesForKeys: [.isSymbolicLinkKey, .isRegularFileKey, .isDirectoryKey], options: [], errorHandler: { _, error in scanError = error; return false }) else { throw WorkflowError.unavailable }
                    for case let url as URL in enumerator {
                        let values = try url.resourceValues(forKeys: [.isSymbolicLinkKey, .isRegularFileKey, .isDirectoryKey])
                        guard values.isSymbolicLink != true else { throw WorkflowError.unavailable }
                        if values.isDirectory == true { continue }
                        guard values.isRegularFile == true, result.count < 4096 else { throw WorkflowError.unavailable }
                        let id = UUID().uuidString
                        let destination = snapshot.appendingPathComponent(id)
                        try FileManager.default.copyItem(at: url, to: destination)
                        guard let size = try destination.resourceValues(forKeys: [.fileSizeKey]).fileSize else { throw WorkflowError.unavailable }
                        files[id] = (destination, UInt64(size))
                        let prefix = folder.path.hasSuffix("/") ? folder.path : folder.path + "/"
                        guard url.path.hasPrefix(prefix) else { throw WorkflowError.unavailable }
                        let relative = String(url.path.dropFirst(prefix.count))
                        let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                        result.append(["id": id, "name": url.lastPathComponent, "path": folder.lastPathComponent + "/" + relative, "mime": mime])
                    }
                } catch { scanError = error }
            }
            if let error = coordinationError ?? scanError as NSError? { try? cleanup(); throw error }
            return ["files": result]
        }
    }
    @objc func read(_ call: CAPPluginCall) {
        perform(call) { [self] in
            let offset = try number(call, "offset")
            guard let (url, size) = files[try text(call, "id")], offset <= size else { throw WorkflowError.invalidTransfer }
            let handle = try FileHandle(forReadingFrom: url)
            defer { try? handle.close() }
            try handle.seek(toOffset: offset)
            let bytes = try handle.read(upToCount: Transfers.chunk) ?? Data()
            guard bytes.count == min(Transfers.chunk, Int(size - offset)) else { throw WorkflowError.unavailable }
            return ["data": bytes.base64EncodedString(), "done": offset + UInt64(bytes.count) == size]
        }
    }
    private func cleanup() throws {
        if let root = root { try FileManager.default.removeItem(at: root) }
        files = [:]; root = nil
    }
    @objc func release(_ call: CAPPluginCall) { perform(call) { [self] in try cleanup(); return [:] } }
}
