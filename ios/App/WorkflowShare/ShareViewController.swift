import UIKit
import WorkflowNativeCore

final class ShareViewController: UIViewController {
    private let status = UILabel(), accept = UIButton(type: .system), cancel = UIButton(type: .system)
    private var receiver: Task<Void, Never>?
    private var finished = false
    private var providers: [NSItemProvider] = []
    private var language: Int {
        let code = Locale.preferredLanguages.first?.split(separator: "-").first.map(String.init) ?? "en"
        return ["de", "en", "ru", "ar"].firstIndex(of: code) ?? 1
    }
    private func text(_ values: [String]) -> String { values[language] }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        view.semanticContentAttribute = language == 3 ? .forceRightToLeft : .forceLeftToRight
        providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
        let title = UILabel(); title.text = "Workflow PDF Pro"; title.font = .preferredFont(forTextStyle: .title2)
        title.adjustsFontForContentSizeCategory = true
        status.numberOfLines = 0; status.font = .preferredFont(forTextStyle: .body); status.adjustsFontForContentSizeCategory = true
        status.text = text([
            "\(providers.count) Datei(en) für den Eingang übernehmen? Öffne danach Workflow PDF Pro und bestätige dort den Import in die Bibliothek.",
            "Receive \(providers.count) file(s)? Then open Workflow PDF Pro and confirm their import into your library.",
            "Принять файлы (\(providers.count))? Затем откройте Workflow PDF Pro и подтвердите импорт в библиотеку.",
            "هل تريد استلام \(providers.count) ملف؟ افتح Workflow PDF Pro بعد ذلك وأكّد استيرادها إلى المكتبة."
        ])
        accept.setTitle(text(["Dateien übernehmen", "Receive files", "Принять файлы", "استلام الملفات"]), for: .normal)
        cancel.setTitle(text(["Abbrechen", "Cancel", "Отмена", "إلغاء"]), for: .normal)
        accept.addTarget(self, action: #selector(receive), for: .touchUpInside)
        cancel.addTarget(self, action: #selector(cancelReceive), for: .touchUpInside)
        accept.isEnabled = !providers.isEmpty && providers.count <= 256
        let stack = UIStackView(arrangedSubviews: [title, status, accept, cancel]); stack.axis = .vertical; stack.spacing = 24
        stack.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 32),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24)
        ])
    }
    @objc private func receive() {
        if finished { extensionContext?.completeRequest(returningItems: nil); return }
        guard receiver == nil else { return }
        accept.isEnabled = false
        status.text = text(["Dateien werden vollständig kopiert …", "Copying all files …", "Копирование всех файлов …", "جارٍ نسخ جميع الملفات …"])
        let inputs = providers
        receiver = Task.detached { [weak self] in
            do {
                let store = try SharedIncomingStore.live()
                _ = try await IncomingProviders.receive(inputs, into: store, staging: FileManager.default.temporaryDirectory, willCommit: { [weak self] in
                    await MainActor.run { self?.cancel.isEnabled = false }
                })
                await MainActor.run {
                    guard let self = self else { return }
                    self.finished = true; self.receiver = nil; self.accept.isEnabled = true; self.cancel.isHidden = true
                    self.status.text = self.text(["Im Eingang gespeichert. Öffne Workflow PDF Pro, um den Import zu bestätigen.", "Saved in the inbox. Open Workflow PDF Pro to confirm the import.", "Сохранено во входящих. Откройте Workflow PDF Pro для подтверждения импорта.", "تم الحفظ في الوارد. افتح Workflow PDF Pro لتأكيد الاستيراد."])
                    self.accept.setTitle(self.text(["Fertig", "Done", "Готово", "تم"]), for: .normal)
                }
            } catch is CancellationError {
                await MainActor.run { self?.extensionContext?.cancelRequest(withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError)) }
            } catch {
                await MainActor.run {
                    guard let self = self else { return }
                    self.receiver = nil; self.cancel.isEnabled = true
                    self.status.text = self.text(["Die Übernahme wurde nicht bestätigt. Prüfe den Eingang in Workflow PDF Pro, bevor du die Dateien erneut teilst. Bereits gespeicherte Dokumente bleiben erhalten.", "Receipt could not be confirmed. Check the inbox in Workflow PDF Pro before sharing again. Existing documents are preserved.", "Получение не подтверждено. Проверьте входящие в Workflow PDF Pro перед повторной отправкой. Существующие документы сохранены.", "تعذّر تأكيد الاستلام. تحقّق من الوارد في Workflow PDF Pro قبل المشاركة مجددًا. المستندات الموجودة محفوظة."])
                }
            }
        }
    }
    @objc private func cancelReceive() {
        if let receiver = receiver { cancel.isEnabled = false; receiver.cancel() }
        else { extensionContext?.cancelRequest(withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError)) }
    }
}
