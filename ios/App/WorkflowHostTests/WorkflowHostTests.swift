import XCTest
import WebKit
import UIKit
@testable import App

@MainActor final class WorkflowHostTests: XCTestCase {
    private func webView() throws -> WKWebView {
        let controllers = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows).compactMap { $0.rootViewController as? WorkflowBridgeViewController }
        return try XCTUnwrap(controllers.first?.webView)
    }
    private func js(_ code: String) async throws -> Any? {
        try await webView().callAsyncJavaScript(code, arguments: [:], in: nil, contentWorld: .page)
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
        try webView().reload()
        try await ready()
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
