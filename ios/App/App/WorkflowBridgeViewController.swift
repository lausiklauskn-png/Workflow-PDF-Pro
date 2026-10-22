import Capacitor
import WebKit

/// Gate before Capacitor dispatch: a plugin call has no originating frame field.
/// Checking only the WebView's top URL inside a plugin would admit hostile frames.
final class WorkflowMessageGate: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    static func trusted(_ url: URL?) -> Bool {
        guard let url = url else { return false }
        return url.scheme == "capacitor" && url.host == "localhost" && url.port == nil
            && ["", "/", "/index.html"].contains(url.path) && url.user == nil && url.password == nil
    }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, Self.trusted(message.frameInfo.request.url),
              Self.trusted(message.webView?.url) else { return }
        target?.userContentController(controller, didReceive: message)
    }
}

final class WorkflowBridgeViewController: CAPBridgeViewController {
    private var messageGate: WorkflowMessageGate?
    override func capacitorDidLoad() {
        guard let capacitor = bridge as? CapacitorBridge, let webView = webView else { return }
        let gate = WorkflowMessageGate()
        gate.target = capacitor.webViewDelegationHandler
        let controller = webView.configuration.userContentController
        controller.removeScriptMessageHandler(forName: "bridge")
        controller.add(gate, name: "bridge")
        messageGate = gate
        bridge?.registerPluginInstance(WorkflowFilesPlugin())
        bridge?.registerPluginInstance(WorkflowImportPlugin())
        bridge?.registerPluginInstance(WorkflowIncomingPlugin())
        if #available(iOS 16.4, *) { webView.isInspectable = false }
    }
}
