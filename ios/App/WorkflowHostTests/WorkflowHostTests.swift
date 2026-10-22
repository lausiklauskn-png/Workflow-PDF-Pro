import XCTest
import WebKit
import UIKit
import CryptoKit
import WorkflowNativeCore
@testable import App

@MainActor final class WorkflowHostTests: XCTestCase {
    private func webView() throws -> WKWebView {
        let controllers = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows).compactMap { $0.rootViewController as? WorkflowBridgeViewController }
        guard let view = controllers.first?.webView else {
            throw NSError(domain: "WorkflowHostTests", code: 3, userInfo: [NSLocalizedDescriptionKey: "App scene is not ready yet"])
        }
        return view
    }
    // Use the Objective-C completion API: the Swift async WebKit overlay is
    // not shipped by every supported simulator runtime.
    private func evaluate(_ code: String) async throws -> Any? {
        let view = try webView()
        return try await withCheckedThrowingContinuation { continuation in
            view.evaluateJavaScript(code) { value, error in
                if let error = error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: value) }
            }
        }
    }
    private func js(_ code: String) async throws -> Any? {
        let key = "__iosProbe_" + UUID().uuidString.replacingOccurrences(of: "-", with: "")
        _ = try await evaluate("window['\(key)']=null;(async()=>{\(code)})().then(value=>window['\(key)']={done:true,value:value??null},error=>window['\(key)']={done:true,error:String(error)});null;")
        for _ in 0..<150 {
            if let result = try await evaluate("window['\(key)']") as? [String: Any], result["done"] as? Bool == true {
                _ = try await evaluate("delete window['\(key)'];null;")
                if let error = result["error"] as? String { throw NSError(domain: "WorkflowProbe", code: 1, userInfo: [NSLocalizedDescriptionKey: error]) }
                return result["value"]
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        _ = try? await evaluate("delete window['\(key)'];null;")
        throw NSError(domain: "WorkflowProbe", code: 2, userInfo: [NSLocalizedDescriptionKey: "iOS probe timeout: " + String(code.prefix(160))])
    }
    private func ready() async throws {
        for _ in 0..<150 {
            if (try? await js("return Boolean(window.__wfpdf && window.PDFLib && window.WFP?.DB && window.WFPNativeFiles);")) as? Bool == true { return }
            try await Task.sleep(nanoseconds: 200_000_000)
        }
        XCTFail("The shared PDF core did not initialize in WKWebView")
        throw NSError(domain: "WorkflowHostTests", code: 1)
    }
    func testTrustedOriginRejectsExternalAndAlternatePages() {
        for value in ["capacitor://localhost/", "capacitor://localhost/index.html"] {
            XCTAssertTrue(WorkflowMessageGate.trusted(URL(string: value)))
        }
        for value in ["https://localhost/", "capacitor://evil/", "capacitor://localhost/help.html", "capacitor://localhost:123/", "capacitor://user@localhost/"] {
            XCTAssertFalse(WorkflowMessageGate.trusted(URL(string: value)))
        }
    }
    func testDeviceKeychainRememberRecallForgetAndIsolation() throws {
        let service = "de.familyprojekt.workflowpdf.pro.tests." + UUID().uuidString
        let keychain = VaultKeychain(service: service), id = UUID().uuidString
        defer { try? keychain.forget(vaultID: id) }
        let key = SymmetricKey(size: .bits256)
        XCTAssertThrowsError(try keychain.recalled(vaultID: id))
        try keychain.remember(key, vaultID: id)
        let reopened = VaultKeychain(service: service)
        XCTAssertEqual(try reopened.recalled(vaultID: id).withUnsafeBytes { Data($0) }, key.withUnsafeBytes { Data($0) })
        XCTAssertThrowsError(try reopened.recalled(vaultID: UUID().uuidString))
        try reopened.forget(vaultID: id)
        XCTAssertThrowsError(try reopened.recalled(vaultID: id))
        try reopened.forget(vaultID: id)
    }
    func testRealNativeTransferAndVersion() async throws {
        try await ready()
        let result = try await js("""
            const api = Capacitor.Plugins.WorkflowFiles;
            const info = await api.appInfo();
            const {id} = await api.begin({name:'Müller.pdf',mime:'application/pdf'});
            let gapRejected = false;
            try { await api.append({id,offset:1,data:'AQID'}); } catch { gapRejected = true; }
            await api.append({id,offset:0,data:'AQID'});
            await api.finish({id,size:3});
            let finishedRejected = false;
            try { await api.append({id,offset:3,data:'BA=='}); } catch { finishedRejected = true; }
            await api.abort({id});
            return {version:info.version,platform:Capacitor.getPlatform(),gapRejected,finishedRejected};
            """) as? [String: Any]
        XCTAssertEqual(result?["version"] as? String, "1.0.3")
        XCTAssertEqual(result?["platform"] as? String, "ios")
        XCTAssertEqual(result?["gapRejected"] as? Bool, true)
        XCTAssertEqual(result?["finishedRejected"] as? Bool, true)
    }
    func testPDFFormOriginalAndDatabaseReload() async throws {
        try await ready()
        _ = try await js("""
            const pdf = await PDFLib.PDFDocument.create();
            pdf.addPage([595,842]); pdf.addPage([595,842]);
            const field=pdf.getForm().createTextField('Name');field.setText('Müller');
            field.addToPage(pdf.getPage(0),{x:50,y:650,width:220,height:25});
            const bytes=await pdf.save();
            window.__iosExpected=Array.from(bytes);
            const input=document.getElementById('inDatei'), data=new DataTransfer();
            data.items.add(new File([bytes],'iOS-Formular.pdf',{type:'application/pdf'}));
            input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));
            return true;
            """)
        for _ in 0..<150 {
            if (try? await js("return Boolean(__wfpdf.S.doc?.fields?.length);")) as? Bool == true { break }
            try await Task.sleep(nanoseconds: 200_000_000)
        }
        let before = try await js("""
            const doc=__wfpdf.S.doc;
            if (!doc) throw Error('PDF not imported');
            const bytes=Array.from(await WFP.DB.getFile(doc.id));
            return {id:doc.id,pages:doc.pages.length,value:doc.fields[0].value,original:JSON.stringify(bytes)===JSON.stringify(__iosExpected),status:doc.pruefung?.status||''};
            """) as? [String: Any]
        XCTAssertEqual(before?["pages"] as? Int, 2)
        XCTAssertEqual(before?["value"] as? String, "Müller")
        XCTAssertEqual(before?["original"] as? Bool, true)
        XCTAssertFalse(["sauber","clean"].contains(before?["status"] as? String ?? ""))
        let id = try XCTUnwrap(before?["id"] as? String)
        let bytes = try await js("return Array.from(await WFP.DB.getFile(__wfpdf.S.doc.id));") as? [Int]
        _ = try await js("window.__iosBeforeReload=true;return true;")
        try webView().reload()
        var newDocument = false
        for _ in 0..<150 {
            // reload() schedules navigation. Old globals may still be visible;
            // await a genuinely new document before starting any async probe.
            if (try? await evaluate("Boolean(!window.__iosBeforeReload && window.__wfpdf && window.WFP?.DB && window.PDFLib)")) as? Bool == true {
                newDocument = true
                break
            }
            try await Task.sleep(nanoseconds: 200_000_000)
        }
        XCTAssertTrue(newDocument, "A new local document must load before checking persisted bytes")
        guard newDocument else { throw NSError(domain: "WorkflowHostTests", code: 4) }
        let idJSON = String(data: try JSONSerialization.data(withJSONObject: [id]), encoding: .utf8)!
        let after = try await js("return Array.from(await WFP.DB.getFile(\(idJSON)[0]));") as? [Int]
        XCTAssertEqual(after, bytes)
    }
    func testCapabilitiesAreObservedOnActualWKWebView() async throws {
        try await ready()
        let result = try await js("""
            const model=await fetch('vendor/tesseract/lang/rus.traineddata');
            const bytes=await model.arrayBuffer();
            return {origin:location.origin,secure:isSecureContext,indexedDB:!!indexedDB,serviceWorker:!!navigator.serviceWorker,caches:typeof caches,worker:typeof Worker,wasm:typeof WebAssembly,modelBytes:bytes.byteLength,translator:typeof Translator,speech:typeof(window.SpeechRecognition||window.webkitSpeechRecognition)};
            """) as? [String: Any]
        XCTAssertEqual(result?["indexedDB"] as? Bool, true)
        XCTAssertEqual(result?["worker"] as? String, "function")
        XCTAssertGreaterThan(result?["modelBytes"] as? Int ?? 0, 100_000)
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: result ?? [:], options: .prettyPrinted), uniformTypeIdentifier: "public.json")
        attachment.name = "Actual WKWebView capabilities (not full offline or translation proof)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
