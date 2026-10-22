import Capacitor
import UIKit
import UniformTypeIdentifiers
import CryptoKit
import WorkflowNativeCore

/// Same asynchronous storage contract as Android/Windows. Passwords, remembered
/// keys and recovery shares are handled only in native UI and native storage.
@objc(WorkflowVaultPlugin)
final class WorkflowVaultPlugin: WorkflowPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    let identifier = "WorkflowVaultPlugin"
    let jsName = "WorkflowVault"
    let pluginMethods: [CAPPluginMethod] = ["state", "locations", "migration", "prepareMigration", "completeMigration", "cancelMigration", "beginBatch", "commitBatch", "abortBatch", "setPrimary", "choose", "unlock", "lock", "begin", "append", "finish", "abort", "info", "read", "list", "remove", "recoveryInfo", "createRecovery"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    var storage: VaultLocations? // Native module state; never a bridged property.
    private var uiBusy = false // Main queue only.
    private var folderCall: CAPPluginCall?
    private var secretExport: URL?
    private var returnToShares: ((Bool?) -> Void)?
    override func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(protectedDataUnavailable), name: UIApplication.protectedDataWillBecomeUnavailableNotification, object: nil)
    }
    deinit { NotificationCenter.default.removeObserver(self) }
    @objc private func protectedDataUnavailable() { Self.io.async { [weak self] in self?.storage?.closeWorking() } }
    private func store() throws -> VaultLocations {
        if let storage = storage { return storage }
        let manager = FileManager.default
        let app = try manager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let cache = try manager.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let staging = cache.appendingPathComponent("WorkflowVaultStaging")
        // Only this app-private staging namespace is disposable. A crashed
        // transfer never leaves a permanent internal copy of an external PDF.
        if manager.fileExists(atPath: staging.path) { try manager.removeItem(at: staging) }
        let value = try VaultLocations(root: app.appendingPathComponent("WorkflowVault"), cache: staging)
        storage = value; return value
    }
    private func work(_ call: CAPPluginCall, _ task: @escaping (VaultLocations) throws -> [String: Any]) {
        Self.io.async { [self] in
            do { call.resolve(try task(store())) }
            catch { let code = VaultLocations.code(error); call.reject(code, code) }
        }
    }
    private func vault(_ call: CAPPluginCall, _ locations: VaultLocations) throws -> DocumentVault { try locations.get(call.getString("location")) }
    private func recordInfo(_ record: DocumentVault.Record?) throws -> [String: Any] {
        guard let record = record else { return ["exists": false] }
        var result: [String: Any] = ["exists": true, "size": Double(record.size), "hash": record.hash]
        if let reference = record.reference { result["reference"] = try JSONSerialization.jsonObject(with: JSONEncoder().encode(reference)) }
        return result
    }
    @objc func state(_ call: CAPPluginCall) { work(call) { try $0.state(call.getString("location")) } }
    @objc func locations(_ call: CAPPluginCall) { work(call) { locations in ["items": try locations.entries.map { try locations.state($0.location) }] } }
    @objc func migration(_ call: CAPPluginCall) { work(call) { ["location": $0.migration as Any? ?? NSNull()] } }
    @objc func prepareMigration(_ call: CAPPluginCall) { work(call) { try $0.prepareMigration(self.text(call, "location")); return ["saved": true] } }
    @objc func completeMigration(_ call: CAPPluginCall) { work(call) { try $0.completeMigration(self.text(call, "location")); return try $0.state() } }
    @objc func cancelMigration(_ call: CAPPluginCall) { work(call) { try $0.cancelMigration(); return ["saved": true] } }
    @objc func beginBatch(_ call: CAPPluginCall) { work(call) { try self.vault(call, $0).beginBatch(); return ["started": true] } }
    @objc func commitBatch(_ call: CAPPluginCall) { work(call) { let vault = try self.vault(call, $0); try vault.commitBatch(); try? vault.prune(); return ["saved": true] } }
    @objc func abortBatch(_ call: CAPPluginCall) { work(call) { try self.vault(call, $0).abortBatch(); return ["aborted": true] } }
    @objc func setPrimary(_ call: CAPPluginCall) { work(call) { try $0.select(call.getString("location")); return try $0.state() } }
    @objc func lock(_ call: CAPPluginCall) { work(call) { try $0.lock(); return try $0.state() } }
    @objc func begin(_ call: CAPPluginCall) {
        work(call) { locations in
            let reference = try call.getObject("reference").map { try JSONDecoder().decode(DocumentVault.Reference.self, from: JSONSerialization.data(withJSONObject: $0)) }
            return ["ticket": try self.vault(call, locations).begin(store: self.text(call, "store"), id: self.text(call, "id"), reference: reference)]
        }
    }
    @objc func append(_ call: CAPPluginCall) {
        work(call) { locations in
            let text = try self.text(call, "data")
            guard text.utf8.count <= 349_528, let bytes = Data(base64Encoded: text) else { throw WorkflowError.invalidTransfer }
            try self.vault(call, locations).append(ticket: self.text(call, "ticket"), offset: self.number(call, "offset"), bytes: bytes)
            return ["ok": true]
        }
    }
    @objc func finish(_ call: CAPPluginCall) {
        work(call) { locations in
            let vault = try self.vault(call, locations)
            let record = try vault.finish(ticket: self.text(call, "ticket"), size: self.number(call, "size"))
            try? vault.prune()
            var result = try self.recordInfo(record); result["saved"] = true; return result
        }
    }
    @objc func abort(_ call: CAPPluginCall) { work(call) { try self.vault(call, $0).abort(ticket: self.text(call, "ticket")); return [:] } }
    @objc func info(_ call: CAPPluginCall) { work(call) { try self.recordInfo(self.vault(call, $0).info(store: self.text(call, "store"), id: self.text(call, "id"))) } }
    @objc func read(_ call: CAPPluginCall) { work(call) { ["data": try self.vault(call, $0).read(store: self.text(call, "store"), id: self.text(call, "id"), offset: self.number(call, "offset"), hash: call.getString("hash")).base64EncodedString()] } }
    @objc func list(_ call: CAPPluginCall) { work(call) { ["ids": try self.vault(call, $0).list(store: self.text(call, "store"))] } }
    @objc func remove(_ call: CAPPluginCall) { work(call) { let vault = try self.vault(call, $0); try vault.remove(store: self.text(call, "store"), id: self.text(call, "id"), prefix: call.getBool("prefix") ?? false); try? vault.prune(); return ["saved": true] } }
    @objc func recoveryInfo(_ call: CAPPluginCall) {
        work(call) { locations in
            guard let info = try self.vault(call, locations).recoveryInfo() else { return ["exists": false] }
            return ["exists": true, "set": info.set, "n": info.n, "k": info.k, "created": Double(info.created)]
        }
    }

    private let words: [String: [String]] = [
        "choose": ["Tresorordner wählen", "Choose vault folder", "Выбрать папку хранилища", "اختيار مجلد الخزنة"],
        "create": ["Dokumenttresor einrichten", "Create document vault", "Создать хранилище документов", "إنشاء خزنة المستندات"],
        "open": ["Dokumenttresor öffnen", "Open document vault", "Открыть хранилище документов", "فتح خزنة المستندات"],
        "password": ["Passwort", "Password", "Пароль", "كلمة المرور"],
        "repeat": ["Passwort wiederholen", "Repeat password", "Повторить пароль", "تأكيد كلمة المرور"],
        "notice": ["Mindestens 10 Zeichen. Bewahre das Passwort sicher auf. Ersatzschlüssel können anschließend im Tresordialog erstellt werden.", "At least 10 characters. Keep your password safe. Recovery keys can then be created in the vault dialog.", "Не менее 10 символов. Сохраните пароль надёжно. Ключи восстановления можно затем создать в окне хранилища.", "10 أحرف على الأقل. احتفظ بكلمة المرور بأمان. يمكن إنشاء مفاتيح الاسترداد لاحقاً في نافذة الخزنة."],
        "cancel": ["Abbrechen", "Cancel", "Отмена", "إلغاء"],
        "continue": ["Weiter", "Continue", "Продолжить", "متابعة"],
        "remember": ["Auf diesem Gerät entsperrt halten", "Keep unlocked on this device", "Оставить разблокированным на этом устройстве", "الإبقاء على الخزنة مفتوحة على هذا الجهاز"],
        "forgot": ["Passwort vergessen?", "Forgot password?", "Забыли пароль?", "نسيت كلمة المرور؟"],
        "failed": ["Nicht möglich. Passwort, Schlüssel und Speicherort prüfen. Die Bibliothek wurde nicht zurückgesetzt.", "Could not complete. Check password, keys and storage. The library was not reset.", "Не удалось выполнить. Проверьте пароль, ключи и хранилище. Библиотека не сброшена.", "تعذر الإكمال. تحقق من كلمة المرور والمفاتيح والتخزين. لم تتم إعادة تعيين المكتبة."],
        "recover": ["Mit drei Ersatzschlüsseln öffnen", "Open with three recovery keys", "Открыть тремя ключами восстановления", "الفتح بثلاثة مفاتيح استرداد"],
        "keys": ["Ersatzschlüssel (3 von 5)", "Recovery keys (3 of 5)", "Ключи восстановления (3 из 5)", "مفاتيح الاسترداد (3 من 5)"],
        "key": ["Ersatzschlüssel", "Recovery key", "Ключ восстановления", "مفتاح الاسترداد"],
        "keep": ["Alle fünf Teile getrennt aufbewahren. Drei beliebige Teile öffnen den Tresor. Frühere Sätze sind nicht mehr gültig.", "Keep all five parts separately. Any three open the vault. Previous sets are no longer valid.", "Храните пять частей раздельно. Любые три открывают хранилище. Прежние наборы больше не действуют.", "احتفظ بالأجزاء الخمسة منفصلة. أي ثلاثة منها تفتح الخزنة. المجموعات السابقة لم تعد صالحة."],
        "save": ["Als Datei speichern …", "Save as file …", "Сохранить в файл …", "حفظ كملف …"],
        "done": ["Ich habe alle fünf Teile sicher aufbewahrt", "I have kept all five parts safely", "Я сохранил все пять частей надёжно", "لقد احتفظت بالأجزاء الخمسة بأمان"],
        "saved": ["Datei gespeichert und geprüft. Teile weiterhin getrennt aufbewahren.", "File saved and verified. Still keep the parts separately.", "Файл сохранён и проверен. Храните части раздельно.", "تم حفظ الملف والتحقق منه. احتفظ بالأجزاء منفصلة."],
        "saveFailed": ["Speichern konnte nicht bestätigt werden.", "Saving could not be verified.", "Сохранение не удалось подтвердить.", "تعذر تأكيد الحفظ."]
    ]
    private func t(_ key: String, _ call: CAPPluginCall) -> String { words[key]![ ["de", "en", "ru", "ar"].firstIndex(of: call.getString("language") ?? "de") ?? 0 ] }
    private func present(_ alert: UIAlertController, call: CAPPluginCall) {
        if call.getString("language") == "ar" { alert.view.semanticContentAttribute = .forceRightToLeft }
        guard let controller = bridge?.viewController else { uiBusy = false; call.reject("VAULT_UNAVAILABLE", "VAULT_UNAVAILABLE"); return }
        controller.present(alert, animated: true)
    }
    @objc func choose(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard !uiBusy, let controller = bridge?.viewController, controller.presentedViewController == nil else { call.reject("VAULT_BUSY", "VAULT_BUSY"); return }
            uiBusy = true; folderCall = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
            picker.delegate = self; controller.present(picker, animated: true)
        }
    }
    @objc func unlock(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard !uiBusy, bridge?.viewController?.presentedViewController == nil else { call.reject("VAULT_BUSY", "VAULT_BUSY"); return }
            uiBusy = true; password(call, selected: nil, existing: true)
        }
    }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        if let call = folderCall { folderCall = nil; uiBusy = false; call.resolve(["cancelled": true]) }
        else if let source = secretExport {
            try? FileManager.default.removeItem(at: source.deletingLastPathComponent()); secretExport = nil
            returnToShares?(nil)
        }
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if let source = secretExport { verifyExport(source: source, target: urls.first); return }
        guard let call = folderCall else { return }; folderCall = nil
        guard urls.count == 1, let selected = urls.first else { uiBusy = false; call.reject("VAULT_FOLDER_UNAVAILABLE", "VAULT_FOLDER_UNAVAILABLE"); return }
        Self.io.async { [self] in
            do {
                let scoped = selected.startAccessingSecurityScopedResource()
                defer { if scoped { selected.stopAccessingSecurityScopedResource() } }
                var root = selected
                let manager = FileManager.default
                var existing = false, coordinationError: NSError?, operationError: Error?
                NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: selected, options: [], error: &coordinationError) { coordinated in
                    do {
                        var inspected = coordinated
                        if !manager.fileExists(atPath: inspected.appendingPathComponent(DocumentVault.headerName).path) {
                            let child = inspected.appendingPathComponent("Workflow PDF Pro", isDirectory: true)
                            if manager.fileExists(atPath: child.appendingPathComponent(DocumentVault.headerName).path) {
                                inspected = child; root = selected.appendingPathComponent("Workflow PDF Pro", isDirectory: true)
                            }
                        }
                        existing = manager.fileExists(atPath: inspected.appendingPathComponent(DocumentVault.headerName).path)
                        if let expected = call.getString("expectedVaultId") {
                            let header = inspected.appendingPathComponent(DocumentVault.headerName)
                            guard existing, let size = try header.resourceValues(forKeys: [.fileSizeKey]).fileSize, size <= 65_536,
                                  let data = try JSONSerialization.jsonObject(with: Data(contentsOf: header)) as? [String: Any], data["id"] as? String == expected else { throw VaultLocationFailure.wrongFolder }
                        }
                    } catch { operationError = error }
                }
                if let error = coordinationError ?? operationError as NSError? { throw error }
                DispatchQueue.main.async { self.password(call, selected: root, existing: existing) }
            } catch { DispatchQueue.main.async { self.uiBusy = false; let code = VaultLocations.code(error); call.reject(code, code) } }
        }
    }
    private func password(_ call: CAPPluginCall, selected: URL?, existing: Bool, recovery: Bool = false, failed: Bool = false) {
        let alert = UIAlertController(title: t(recovery ? "recover" : (existing ? "open" : "create"), call), message: failed ? t("failed", call) : (existing ? nil : t("notice", call)), preferredStyle: .alert)
        if recovery {
            for index in 1...3 { alert.addTextField { field in field.placeholder = self.t("key", call) + " \(index)"; field.autocapitalizationType = .allCharacters; field.autocorrectionType = .no; field.textContentType = .oneTimeCode } }
        }
        alert.addTextField { field in field.placeholder = self.t("password", call); field.isSecureTextEntry = true; field.textContentType = existing && !recovery ? .password : .newPassword }
        if !existing || recovery { alert.addTextField { field in field.placeholder = self.t("repeat", call); field.isSecureTextEntry = true; field.textContentType = .newPassword } }
        alert.addAction(UIAlertAction(title: t("cancel", call), style: .cancel) { _ in self.uiBusy = false; call.resolve(["cancelled": true]) })
        if existing && !recovery { alert.addAction(UIAlertAction(title: t("forgot", call), style: .default) { _ in alert.dismiss(animated: true) { self.password(call, selected: selected, existing: existing, recovery: true) } }) }
        for remember in [false, true] {
            alert.addAction(UIAlertAction(title: t(remember ? "remember" : "continue", call), style: .default) { _ in
                let fields = alert.textFields ?? [], offset = recovery ? 3 : 0
                let password = (fields[offset].text ?? "").precomposedStringWithCanonicalMapping
                let repeated = fields.last?.text?.precomposedStringWithCanonicalMapping
                let shares = recovery ? fields.prefix(3).map { $0.text ?? "" } : []
                fields.forEach { $0.text = nil }
                if (!existing || recovery) && (password.unicodeScalars.count < 10 || password != repeated) {
                    alert.dismiss(animated: true) { self.password(call, selected: selected, existing: existing, recovery: recovery, failed: true) }; return
                }
                Self.io.async { [self] in
                    do {
                        let locations = try store()
                        let location: String
                        if let selected = selected {
                            let scoped = selected.startAccessingSecurityScopedResource()
                            defer { if scoped { selected.stopAccessingSecurityScopedResource() } }
                            var root = selected
                            var createdFolder: URL?
                            if !existing && root.lastPathComponent != "Workflow PDF Pro" {
                                root = selected.appendingPathComponent("Workflow PDF Pro", isDirectory: true)
                                var coordinationError: NSError?, creationError: Error?
                                NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: selected, options: .forMerging, error: &coordinationError) { parent in
                                    do {
                                        let child = parent.appendingPathComponent("Workflow PDF Pro", isDirectory: true)
                                        if FileManager.default.fileExists(atPath: child.path) {
                                            guard try FileManager.default.contentsOfDirectory(atPath: child.path).isEmpty else { throw VaultFolderFailure.exists }
                                        } else { try FileManager.default.createDirectory(at: child, withIntermediateDirectories: false); createdFolder = root }
                                    } catch { creationError = error }
                                }
                                if let error = coordinationError ?? creationError as NSError? { throw error }
                            }
                            let candidate = try locations.candidate(folder: root)
                            do {
                                if recovery { try candidate.vault.recover(shares: shares, newPassword: password) }
                                else if existing { try candidate.vault.open(password: password) }
                                else { try candidate.vault.initialize(password: password) }
                                if let expected = call.getString("expectedVaultId"), candidate.vault.identity != expected { throw VaultLocationFailure.wrongFolder }
                                location = try locations.adopt(candidate)
                            } catch {
                                try? locations.discard(candidate)
                                if let folder = createdFolder, (try? FileManager.default.contentsOfDirectory(atPath: folder.path).isEmpty) == true { try? FileManager.default.removeItem(at: folder) }
                                throw error
                            }
                            try locations.remember(location, enabled: remember)
                        } else {
                            guard let chosen = call.getString("location") ?? locations.primary else { throw VaultLocationFailure.notConfigured }
                            location = chosen
                            if recovery { try locations.get(chosen).recover(shares: shares, newPassword: password); try locations.remember(chosen, enabled: remember) }
                            else { try locations.unlock(chosen, password: password, remember: remember) }
                        }
                        let state = try locations.state(location)
                        DispatchQueue.main.async { self.uiBusy = false; call.resolve(["location": location, "state": state, "created": !existing, "opened": existing, "unlocked": true, "recovered": recovery]) }
                    } catch {
                        let code = VaultLocations.code(error)
                        DispatchQueue.main.async {
                            if code == "VAULT_PASSWORD" || code == "VAULT_PASSWORD_SHORT" || error is RecoveryFailure {
                                alert.dismiss(animated: true) { self.password(call, selected: selected, existing: existing, recovery: recovery, failed: true) }
                            } else { self.uiBusy = false; call.reject(code, code) }
                        }
                    }
                }
            })
        }
        present(alert, call: call)
    }
    @objc func createRecovery(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard !uiBusy, bridge?.viewController?.presentedViewController == nil else { call.reject("VAULT_BUSY", "VAULT_BUSY"); return }
            uiBusy = true
            Self.io.async { [self] in
                do {
                    let vault = try self.vault(call, store()), shares = try vault.createRecovery()
                    guard let info = try vault.recoveryInfo() else { throw DocumentVaultFailure.damaged }
                    DispatchQueue.main.async { self.showShares(shares, info: info, call: call) }
                } catch { DispatchQueue.main.async { self.uiBusy = false; let code = VaultLocations.code(error); call.reject(code, code) } }
            }
        }
    }
    private func showShares(_ shares: [String], info: DocumentVault.RecoveryInfo, call: CAPPluginCall, status: String? = nil) {
        let text = t("keep", call) + "\n\n" + shares.enumerated().map { "\($0.offset + 1). \($0.element)" }.joined(separator: "\n\n")
        let alert = UIAlertController(title: t("keys", call), message: text + (status.map { "\n\n" + $0 } ?? ""), preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: t("done", call), style: .default) { _ in
            self.returnToShares = nil; self.uiBusy = false
            call.resolve(["created": true, "set": info.set, "n": info.n, "k": info.k, "createdAt": Double(info.created)])
        })
        alert.addAction(UIAlertAction(title: t("save", call), style: .default) { _ in
            do {
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent("wfp-recovery-" + UUID().uuidString)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
                let file = directory.appendingPathComponent("Workflow-PDF-Pro-Ersatzschluessel.txt")
                try Data(("Workflow PDF Pro\n\n" + text).utf8).write(to: file, options: [.withoutOverwriting, .completeFileProtection])
                self.secretExport = file
                self.returnToShares = { [weak self] status in self?.showShares(shares, info: info, call: call, status: status.map { self?.t($0 ? "saved" : "saveFailed", call) ?? "" }) }
                alert.dismiss(animated: true) {
                    let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true); picker.delegate = self
                    self.bridge?.viewController?.present(picker, animated: true)
                }
            } catch { alert.dismiss(animated: true) { self.showShares(shares, info: info, call: call, status: self.t("saveFailed", call)) } }
        })
        present(alert, call: call)
    }
    private func verifyExport(source: URL, target: URL?) {
        secretExport = nil
        Self.io.async { [self] in
            var verified = false
            if let target = target {
                let scoped = target.startAccessingSecurityScopedResource()
                defer { if scoped { target.stopAccessingSecurityScopedResource() } }
                var coordinationError: NSError?
                NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: target, options: [], error: &coordinationError) { url in
                    func bounded(_ file: URL) throws -> Data {
                        let handle = try FileHandle(forReadingFrom: file)
                        defer { try? handle.close() }
                        var bytes = Data()
                        while let block = try handle.read(upToCount: 65_537 - bytes.count), !block.isEmpty {
                            bytes.append(block)
                            guard bytes.count <= 65_536 else { throw VaultFailure.damaged }
                        }
                        return bytes
                    }
                    if let expected = try? bounded(source), let actual = try? bounded(url) { verified = expected == actual }
                }
                if coordinationError != nil { verified = false }
            }
            try? FileManager.default.removeItem(at: source.deletingLastPathComponent())
            // The callback carries native text only, never the secret file bytes.
            DispatchQueue.main.async { self.returnToShares?(verified) }
        }
    }
}
