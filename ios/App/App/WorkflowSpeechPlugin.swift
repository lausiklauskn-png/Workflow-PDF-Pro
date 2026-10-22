import Capacitor
import UIKit
import Speech
import AVFoundation
import WebKit

/// One foreground recording, started only by the existing speech button. Audio
/// is never written to a file. Prefer local recognition where Apple supports it.
@objc(WorkflowSpeechPlugin)
final class WorkflowSpeechPlugin: WorkflowPlugin, CAPBridgedPlugin {
    let identifier = "WorkflowSpeechPlugin"
    let jsName = "WorkflowSpeech"
    let pluginMethods: [CAPPluginMethod] = ["available", "start", "stop"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var active: String?
    private var recognizer: SFSpeechRecognizer?
    private var engine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var recognition: SFSpeechRecognitionTask?
    private var tapped = false
    private var stopping = false
    private var pendingStart: CAPPluginCall?
    override func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(background), name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(interruption), name: AVAudioSession.interruptionNotification, object: nil)
    }
    deinit { NotificationCenter.default.removeObserver(self) }
    private func event(_ id: String, _ kind: String, extra: JSObject = [:]) {
        var value = extra; value["id"] = id; value["kind"] = kind
        notifyListeners("speech", data: value)
    }
    private func releaseAudio() {
        engine?.stop()
        if tapped { engine?.inputNode.removeTap(onBus: 0); tapped = false }
        request?.endAudio()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
    private func finish(_ id: String, error: String? = nil) {
        guard active == id else { return }
        active = nil
        let pending = pendingStart; pendingStart = nil
        releaseAudio(); recognition?.cancel()
        recognition = nil; request = nil; engine = nil; recognizer = nil; stopping = false
        pending?.reject(error ?? "aborted", error ?? "aborted")
        if let error = error { event(id, "error", extra: ["error": error]) }
        event(id, "end")
    }
    @objc private func background() { if let id = active { finish(id) } }
    override func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        if navigationAction.targetFrame?.isMainFrame == true, let id = active { finish(id) }
        return super.shouldOverrideLoad(navigationAction)
    }
    @objc private func interruption(_ notification: Notification) {
        guard let value = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              value == AVAudioSession.InterruptionType.began.rawValue else { return }
        DispatchQueue.main.async { [weak self] in if let id = self?.active { self?.finish(id, error: "audio-capture") } }
    }
    @objc func available(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let recognizer = SFSpeechRecognizer(locale: Locale(identifier: call.getString("language") ?? "de-DE"))
            call.resolve(["available": recognizer?.isAvailable ?? false, "supportsOnDevice": recognizer?.supportsOnDeviceRecognition ?? false])
        }
    }
    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard let id = call.getString("id"), UUID(uuidString: id) != nil else { call.reject("SPEECH_INVALID_SESSION", "SPEECH_INVALID_SESSION"); return }
            guard active == nil else { call.reject("audio-capture", "audio-capture"); return }
            guard UIApplication.shared.applicationState == .active else { call.reject("aborted", "aborted"); return }
            let locale = Locale(identifier: call.getString("language") ?? "de-DE")
            guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else { call.reject("service-not-allowed", "service-not-allowed"); return }
            active = id; self.recognizer = recognizer; pendingStart = call
            SFSpeechRecognizer.requestAuthorization { status in
                DispatchQueue.main.async { [self] in
                    guard active == id else { return }
                    guard status == .authorized else { finish(id, error: "not-allowed"); return }
                    AVAudioSession.sharedInstance().requestRecordPermission { allowed in
                        DispatchQueue.main.async { [self] in
                            guard active == id else { return }
                            guard allowed else { finish(id, error: "not-allowed"); return }
                            startWhenActive(id, recognizer: recognizer)
                        }
                    }
                }
            }
        }
    }
    private func startWhenActive(_ id: String, recognizer: SFSpeechRecognizer, remaining: Int = 20) {
        guard active == id else { return }
        if UIApplication.shared.applicationState == .active { startAudio(id, recognizer: recognizer); return }
        guard UIApplication.shared.applicationState != .background, remaining > 0 else { finish(id); return }
        // Permission alerts can resolve just before UIKit reports active again.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in self?.startWhenActive(id, recognizer: recognizer, remaining: remaining - 1) }
    }
    private func startAudio(_ id: String, recognizer: SFSpeechRecognizer) {
        do {
            let audio = AVAudioSession.sharedInstance()
            try audio.setCategory(.record, mode: .measurement)
            try audio.setActive(true)
            let engine = AVAudioEngine(), request = SFSpeechAudioBufferRecognitionRequest()
            self.engine = engine; self.request = request
            request.shouldReportPartialResults = true; request.taskHint = .dictation
            request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
            let input = engine.inputNode, format = input.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else { throw NSError(domain: "WorkflowSpeech", code: 1) }
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in request.append(buffer) }
            tapped = true
            recognition = recognizer.recognitionTask(with: request) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self = self, self.active == id else { return }
                    if let result = result {
                        self.event(id, "result", extra: ["text": result.bestTranscription.formattedString, "final": result.isFinal])
                        if result.isFinal { self.finish(id); return }
                    }
                    if let error = error as NSError? {
                        let code = error.domain == NSURLErrorDomain ? "network" : "recognition-failed"
                        self.finish(id, error: self.stopping ? nil : code)
                    }
                }
            }
            engine.prepare(); try engine.start()
            pendingStart?.resolve(["started": true, "onDevice": request.requiresOnDeviceRecognition]); pendingStart = nil
            event(id, "start")
        } catch { finish(id, error: "audio-capture") }
    }
    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard let id = call.getString("id"), active == id else { call.resolve(); return }
            if call.getBool("abort") == true || pendingStart != nil { finish(id) }
            else if !stopping {
                stopping = true; releaseAudio(); recognition?.finish(); event(id, "speechend")
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in self?.finish(id) }
            }
            call.resolve()
        }
    }
}
