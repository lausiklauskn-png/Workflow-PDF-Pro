import XCTest
import WebKit
import UIKit
import CryptoKit
import WorkflowNativeCore
import Translation
import Speech
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
    private func js(_ code: String, seconds: Int = 15) async throws -> Any? {
        let key = "__iosProbe_" + UUID().uuidString.replacingOccurrences(of: "-", with: "")
        _ = try await evaluate("window['\(key)']=null;(async()=>{\(code)})().then(value=>window['\(key)']={done:true,value:value??null},error=>window['\(key)']={done:true,error:String(error)});null;")
        for _ in 0..<(seconds * 10) {
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
    func testLocalOCRWorkerAndWASMRecognizeThreeLanguages() async throws {
        try await ready()
        let result = try await js("""
            if (!window.Tesseract) await new Promise((resolve,reject)=>{
              const script=document.createElement('script');
              script.src='vendor/tesseract/tesseract.min.js';script.onload=resolve;script.onerror=reject;document.head.append(script);
            });
            const base=new URL('vendor/tesseract/',location.href).href;
            const output=[];
            for (const [language,text,word] of [['eng','WORKFLOW 12345','WORKFLOW'],['deu','DOKUMENT 12345','DOKUMENT'],['rus','ДОКУМЕНТ 12345','ДОКУМЕНТ']]) {
              const worker=await Tesseract.createWorker(language,1,{workerPath:base+'worker.min.js',corePath:base,langPath:base+'lang',gzip:false,cacheMethod:'none'});
              try {
                const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=240;
                const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);
                context.fillStyle='black';context.font='72px sans-serif';context.fillText(text,60,140);
                const {data}=await worker.recognize(canvas);
                if (!data.text.toUpperCase().includes(word)) throw Error(language+' OCR did not recognize synthetic word');
                output.push({language,recognizedWord:true,confidence:data.confidence});
              } finally {await worker.terminate();}
            }
            return output;
            """, seconds: 90) as? [[String: Any]]
        XCTAssertEqual(result?.count, 3)
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: result ?? [], options: .prettyPrinted), uniformTypeIdentifier: "public.json")
        attachment.name = "Local OCR Worker WASM recognition of synthetic DE EN RU text"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    func testNativeLanguageCapabilitiesWithoutSendingDocuments() async throws {
        var result: [String: Any] = ["translationSessionExecuted": false, "speechRecognitionExecuted": false]
        if #available(iOS 18.0, *) {
            let availability = LanguageAvailability()
            var pairs: [[String: String]] = []
            for source in ["de", "en", "ru"] {
                for target in ["de", "en", "ru"] where source != target {
                    let status = await availability.status(from: Locale.Language(identifier: source), to: Locale.Language(identifier: target))
                    let value: String
                    switch status {
                    case .installed: value = "installed"
                    case .supported: value = "supported-download-needed"
                    case .unsupported: value = "unsupported"
                    @unknown default: value = "unknown"
                    }
                    pairs.append(["from": source, "to": target, "status": value])
                }
            }
            result["appleTranslationPairs"] = pairs
        } else { result["appleTranslation"] = "requires-iOS-18" }
        result["speech"] = ["de-DE", "en-US", "ru-RU", "ar-SA"].map { language -> [String: Any] in
            let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language))
            return ["language": language, "available": recognizer?.isAvailable ?? false,
                    "supportsOnDevice": recognizer?.supportsOnDeviceRecognition ?? false]
        }
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: result, options: .prettyPrinted), uniformTypeIdentifier: "public.json")
        attachment.name = "Native language API availability only; no translation or speech recognition proof"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    func testVaultMigrationUsesRealNativeStorageAndMissingFolderBlocksJobs() async throws {
        try await ready()
        let controllers = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows).compactMap { $0.rootViewController as? WorkflowBridgeViewController }
        let plugin = try XCTUnwrap(controllers.first?.bridge?.plugin(withName: "WorkflowVault") as? WorkflowVaultPlugin)
        let originalStorage = WorkflowPlugin.io.sync { plugin.storage }
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("wfp-vault-acceptance-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        let selected = root.appendingPathComponent("Workflow PDF Pro")
        try FileManager.default.createDirectory(at: selected, withIntermediateDirectories: false)
        let locations = try VaultLocations(root: root.appendingPathComponent("metadata"), cache: root.appendingPathComponent("cache"))
        let id: String = try WorkflowPlugin.io.sync {
            let candidate = try locations.candidate(folder: selected)
            try candidate.vault.initialize(password: "Synthetic test password 123")
            let id = try locations.adopt(candidate)
            plugin.storage = locations
            return id
        }
        func restore() async {
            _ = try? await js("""
                if(window.__iosVaultBackup){
                  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('WorkflohPDF1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
                  const names=['folders','docs','files','texte','vektoren'];
                  await new Promise((resolve,reject)=>{const tx=db.transaction(names,'readwrite');for(const name of names){const store=tx.objectStore(name);store.clear();for(const row of __iosVaultBackup[name])store.put(row);}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
                  db.close();delete window.__iosVaultBackup;
                }
                return true;
                """)
            WorkflowPlugin.io.sync { locations.closeWorking(); plugin.storage = originalStorage }
            _ = try? await js("await WFPNativeVault.boot();return true;")
            try? FileManager.default.removeItem(at: root)
        }
        do {
            let idJSON = String(data: try JSONSerialization.data(withJSONObject: [id]), encoding: .utf8)!
            _ = try await js("""
                await WFP.DB.keys('files');
                const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('WorkflohPDF1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
                window.__iosVaultBackup={};
                for(const name of ['folders','docs','files','texte','vektoren']) __iosVaultBackup[name]=await new Promise((resolve,reject)=>{const r=db.transaction(name).objectStore(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
                db.close();
                await WFP.DB.putFile('ios-vault-document',new Uint8Array([7,8,9]));
                const state=await Capacitor.Plugins.WorkflowVault.state({location:\(idJSON)[0]});
                await WFPNativeVault.selectLocation(state);
                const buttons=document.querySelectorAll('.native-vault-dialog button');buttons[buttons.length-1].click();
                return true;
                """)
            var migrated = false
            for _ in 0..<150 {
                if (try? await js("const state=await Capacitor.Plugins.WorkflowVault.state();return state.location===\(idJSON)[0]&&!WFPNativeVault.gate.blocked;")) as? Bool == true { migrated = true; break }
                try await Task.sleep(nanoseconds: 200_000_000)
            }
            XCTAssertTrue(migrated, "Explicit migration must finish its native commit and local transaction")
            guard migrated else { throw NSError(domain: "WorkflowVaultAcceptance", code: 1) }
            let result = try await js("""
                const bytes=Array.from(await WFP.DB.getFile('ios-vault-document'));
                await WFP.DB.put('files',{id:'ue:ios-vault-document:de-ru',job:{page:2,complete:false}});
                const db=await new Promise(resolve=>{const r=indexedDB.open('WorkflohPDF1');r.onsuccess=()=>resolve(r.result);});
                const raw=await new Promise(resolve=>{const r=db.transaction('files').objectStore('files').get('ios-vault-document');r.onsuccess=()=>resolve(r.result);});db.close();
                return {bytes,reference:!!raw.__wfpVault,internalBytes:Object.hasOwn(raw,'bytes'),page:(await WFP.DB.get('files','ue:ios-vault-document:de-ru')).job.page};
                """) as? [String: Any]
            XCTAssertEqual(result?["bytes"] as? [Int], [7,8,9])
            XCTAssertEqual(result?["reference"] as? Bool, true)
            XCTAssertEqual(result?["internalBytes"] as? Bool, false)
            XCTAssertEqual(result?["page"] as? Int, 2)
            try FileManager.default.removeItem(at: selected)
            let blocked = try await js("""
                let readBlocked=false,writeBlocked=false;
                try{await WFP.DB.get('files','ue:ios-vault-document:de-ru');}catch{readBlocked=true;}
                try{await WFP.DB.put('files',{id:'ue:ios-vault-document:de-ru',job:{page:0}});}catch{writeBlocked=true;}
                return {readBlocked,writeBlocked};
                """) as? [String: Any]
            XCTAssertEqual(blocked?["readBlocked"] as? Bool, true)
            XCTAssertEqual(blocked?["writeBlocked"] as? Bool, true)
        } catch { await restore(); throw error }
        await restore()
    }
}
