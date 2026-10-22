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
    func testActualSameOriginFrameCannotDispatchNativeCalls() async throws {
        try await ready()
        let result = try await js("""
            const original=Capacitor.fromNative,seen=new Set();
            Capacitor.fromNative=result=>{if(result.callbackId?.startsWith('ios-frame-probe-'))seen.add(result.callbackId);return original(result);};
            const frame=document.createElement('iframe');frame.hidden=true;
            try {
              window.webkit.messageHandlers.bridge.postMessage({type:'message',pluginId:'WorkflowFiles',methodName:'appInfo',callbackId:'ios-frame-probe-control',options:{}});
              for(let i=0;i<100&&!seen.has('ios-frame-probe-control');i++)await new Promise(r=>setTimeout(r,10));
              await new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=reject;frame.src=location.href;document.body.append(frame);});
              const exposed=Boolean(frame.contentWindow.webkit?.messageHandlers?.bridge);
              if(exposed)frame.contentWindow.webkit.messageHandlers.bridge.postMessage({type:'message',pluginId:'WorkflowFiles',methodName:'appInfo',callbackId:'ios-frame-probe-attack',options:{}});
              await new Promise(r=>setTimeout(r,500));
              return {control:seen.has('ios-frame-probe-control'),exposed,attackReturned:seen.has('ios-frame-probe-attack')};
            } finally {frame.remove();Capacitor.fromNative=original;}
            """) as? [String: Any]
        XCTAssertEqual(result?["control"] as? Bool, true)
        XCTAssertEqual(result?["exposed"] as? Bool, true, "Probe must actually reach the subframe message handler")
        XCTAssertEqual(result?["attackReturned"] as? Bool, false)
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
    func testSharedIncomingContainerRoundTripAcrossNativeAndWebBridge() async throws {
        try await ready()
        let extensionURL = try XCTUnwrap(Bundle.main.builtInPlugInsURL?.appendingPathComponent("WorkflowShare.appex"))
        XCTAssertTrue(FileManager.default.fileExists(atPath: extensionURL.path), "The Share Extension must actually be embedded")
        let store = try SharedIncomingStore.live()
        XCTAssertNil(try WorkflowIntake.shared.pending(), "Synthetic CI inbox must start empty")
        let source = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".pdf")
        let expected = Data("%PDF synthetic shared intake".utf8)
        try expected.write(to: source)
        defer { try? FileManager.default.removeItem(at: source) }
        let batch = try store.access { try $0.receive([source]) }
        defer {
            try? store.access { inbox in
                if try inbox.pending()?.id == batch.id { try inbox.acknowledge(id: batch.id, discard: true) }
                else if try inbox.history().contains(where: { $0.id == batch.id }) { try inbox.discardArchived(id: batch.id) }
            }
        }
        let quoted = String(data: try JSONSerialization.data(withJSONObject: [batch.id, batch.files[0].id]), encoding: .utf8)!
        let result = try await js("""
            const [id,file]=\(quoted),api=Capacitor.Plugins.WorkflowIncoming;
            const invoke=async(method,options)=>{try{return await api[method](options);}catch(error){throw Error(method+': '+error.message);}};
            const pending=await invoke('pending');
            if(pending.id!==id)throw Error('Shared batch missing');
            const bytes=await invoke('read',{batch:id,id:file,offset:0});
            await invoke('acknowledge',{id,discard:false});
            const archived=(await invoke('history')).receipts.some(row=>row.id===id);
            await invoke('restore',{id});
            const restored=(await invoke('pending')).id===id;
            await invoke('acknowledge',{id,discard:true});
            return {data:bytes.data,done:bytes.done,archived,restored};
            """) as? [String: Any]
        XCTAssertEqual(result?["data"] as? String, expected.base64EncodedString())
        XCTAssertEqual(result?["done"] as? Bool, true)
        XCTAssertEqual(result?["archived"] as? Bool, true)
        XCTAssertEqual(result?["restored"] as? Bool, true)
        XCTAssertNil(try store.access { try $0.pending() })
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
    func testEncryptedBackupRoundTripPreservesOriginalAndNeverOverwritesExistingDocument() async throws {
        try await ready()
        let result = try await js("""
            const DB=WFP.DB,SI=WFP.Sicherung,id='ios-backup-'+crypto.randomUUID(),folder=id+'-folder';
            const pdf=await PDFLib.PDFDocument.create();pdf.addPage([595,842]);const bytes=await pdf.save();
            const original=new Uint8Array([255,216,1,2,3,255,217]),password='Synthetic backup password 123';
            try {
              await DB.put('folders',{id:folder,name:'Папка العربية'});
              await DB.putFile(id,bytes);
              await DB.put('docs',{id,name:'Erfundene Sicherungsprobe',folderId:folder,pages:[{w:595,h:842}],fields:[{id:'f',value:'Müller Москва العربية'}],pruefung:{status:'sauber'}});
              await DB.put('files',{id:id+'~original',name:'Фото.jpg',bytes:original});
              const saved=await SI.verschliessen(password,DB),serialized=JSON.stringify(saved.datei);
              await DB.del('docs',id);await DB.del('files',id);await DB.del('files',id+'~original');await DB.del('folders',folder);
              let wrongRejected=false;try{await SI.oeffnen('Wrong synthetic password 456',saved.datei);}catch(error){wrongRejected=error.message==='passwort';}
              if(await DB.get('docs',id))throw Error('Wrong password changed the database');
              const content=await SI.oeffnen(password,saved.datei),merged=await SI.zusammenfuehren(DB,content);
              const restored=await DB.get('docs',id),file=await DB.getFile(id),photo=await DB.get('files',id+'~original');
              await DB.put('docs',{...restored,name:'Keep my newer name'});
              await SI.zusammenfuehren(DB,content);
              return {wrongRejected,encrypted:!serialized.includes('Erfundene Sicherungsprobe')&&!serialized.includes('Müller'),added:merged.neu.some(row=>row.doc.id===id),
                bytes:JSON.stringify(Array.from(file))===JSON.stringify(Array.from(bytes)),original:JSON.stringify(Array.from(photo.bytes))===JSON.stringify(Array.from(original)),
                originalNotice:photo.name.includes(SI.ORIGINAL_VERMERK),unicode:restored.fields[0].value,untrustedFindingRemoved:!('pruefung'in restored),
                unchanged:(await DB.get('docs',id)).name==='Keep my newer name'};
            } finally {await DB.del('docs',id);await DB.del('files',id);await DB.del('files',id+'~original');await DB.del('folders',folder);}
            """, seconds: 60) as? [String: Any]
        for key in ["wrongRejected", "encrypted", "added", "bytes", "original", "originalNotice", "untrustedFindingRemoved", "unchanged"] {
            XCTAssertEqual(result?[key] as? Bool, true, key)
        }
        XCTAssertEqual(result?["unicode"] as? String, "Müller Москва العربية")
    }
    func testEmbeddedLatinAndCyrillicFontsRenderWithoutMissingLetters() async throws {
        try await ready()
        // Port the existing upstream schrift.mjs ink measurement to actual
        // WKWebView/pdf.js. Correct extracted text alone misses lost glyphs.
        let result = try await js("""
            const lines=['Anspruchsteller Schadenssache Rechtsanwaltsgesellschaft Fragebogen','Уважаемые дамы и господа пожалуйста заполните анкету полностью','Datum der Anmeldung Uhrzeit Kennzeichen Versicherungsnummer'];
            const pdf=await PDFLib.PDFDocument.create();pdf.addPage([595,842]);const blank=await pdf.save();
            const font=await WFP.Uebersetzung.schriftLaden('vendor/');
            const ink=async bytes=>{
              const pdf=await pdfjsLib.getDocument({data:bytes.slice(0)}).promise;
              try {
                const page=await pdf.getPage(1),viewport=page.getViewport({scale:2}),canvas=document.createElement('canvas');
                canvas.width=viewport.width;canvas.height=viewport.height;const context=canvas.getContext('2d');
                await page.render({canvasContext:context,viewport}).promise;
                const data=context.getImageData(0,0,canvas.width,canvas.height).data,bands=[];let band=null;
                const dark=(x,y)=>{const i=(y*canvas.width+x)*4;return data[i]+data[i+1]+data[i+2]<380;};
                for(let y=0;y<canvas.height;y++){
                  let has=false;for(let x=0;x<canvas.width;x++)if(dark(x,y)){has=true;break;}
                  if(has&&!band)band=[y,y];else if(has)band[1]=y;else if(band){bands.push(band);band=null;}
                }
                return bands.filter(b=>b[1]-b[0]>6).map(([a,b])=>{
                  let first=-1,last=-1,count=0;
                  for(let x=0;x<canvas.width;x++){let has=false;for(let y=a;y<=b;y++)if(dark(x,y)){has=true;break;}if(has){count++;if(first<0)first=x;last=x;}}
                  return count/(last-first+1);
                });
              } finally {await pdf.destroy();}
            };
            const translated=await WFP.Uebersetzung.pdfBauen(blank,[{b:lines.map((text,i)=>[40,40+i*60,520,40,14]),u:lines}],font,{});
            const doc={pages:[{t:[1,0,0,-1,0,842],w:595,h:842}],fields:lines.map((value,i)=>({id:'f'+i,name:'f'+i,type:'text',page:0,x:6,y:5+i*8,w:90,h:3.5,value,geprueft:true}))};
            const exported=await WFP.Export.exportieren(doc,blank,'fest',{schrift:font});
            return {translation:await ink(translated.bytes),export:await ink(exported.bytes)};
            """, seconds: 60) as? [String: Any]
        for key in ["translation", "export"] {
            let values = result?[key] as? [Double] ?? []
            XCTAssertEqual(values.count, 3, key)
            XCTAssertTrue(values.allSatisfy { $0 >= 0.55 }, "Visible ink must match the upstream glyph coverage threshold: \(key) \(values)")
        }
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: result ?? [:], options: .prettyPrinted), uniformTypeIdentifier: "public.json")
        attachment.name = "Visible Latin and Cyrillic glyph coverage from the unchanged export and PDF builder"
        attachment.lifetime = .keepAlways; add(attachment)
    }
    func testFourUILanguagesAndArabicDirectionAtPhoneAndTabletViewportSizes() async throws {
        try await ready()
        let view = try webView(), previousFrame = view.frame
        defer { view.frame = previousFrame }
        let initialLanguage = try await js("return WFP.Sprache.lang;") as? String ?? "de"
        let quoted = String(data: try JSONSerialization.data(withJSONObject: [initialLanguage]), encoding: .utf8)!
        do {
            var measurements: [[String: Any]] = []
            for size in [CGSize(width: 375, height: 700), CGSize(width: 1024, height: 768), CGSize(width: 768, height: 1024)] {
                view.frame = CGRect(origin: previousFrame.origin, size: size)
                for language in ["de", "en", "ru", "ar"] {
                    let result = try await js("""
                        WFP.Sprache.setzen('\(language)');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                        return {language:document.documentElement.lang,direction:document.documentElement.dir,width:innerWidth,height:innerHeight,
                          editor:typeof __wfpdf==='object',bodyDirection:getComputedStyle(document.body).direction};
                        """) as? [String: Any] ?? [:]
                    XCTAssertEqual(result["language"] as? String, language)
                    XCTAssertEqual(result["direction"] as? String, language == "ar" ? "rtl" : "ltr")
                    XCTAssertEqual(result["bodyDirection"] as? String, language == "ar" ? "rtl" : "ltr")
                    XCTAssertGreaterThan(result["width"] as? Int ?? 0, 0)
                    XCTAssertEqual(result["editor"] as? Bool, true)
                    measurements.append(result)
                }
            }
            let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: measurements, options: .prettyPrinted), uniformTypeIdentifier: "public.json")
            attachment.name = "Actual WKWebView language and viewport measurements; no hardware keyboard or rotation proof"
            attachment.lifetime = .keepAlways; add(attachment)
        } catch { _ = try? await js("WFP.Sprache.setzen(\(quoted)[0]);return true;"); throw error }
        _ = try await js("WFP.Sprache.setzen(\(quoted)[0]);return true;")
    }
    func testLocalOCRWorkerAndWASMRecognizeThreeLanguages() async throws {
        try await ready()
        let ruleID = "ios-offline-ocr-" + UUID().uuidString
        let rules: WKContentRuleList = try await withCheckedThrowingContinuation { continuation in
            WKContentRuleListStore.default().compileContentRuleList(forIdentifier: ruleID,
                encodedContentRuleList: """
                [{"trigger":{"url-filter":"^https?://"},"action":{"type":"block"}}]
                """) { rules, error in
                    if let error = error { continuation.resume(throwing: error) }
                    else if let rules = rules { continuation.resume(returning: rules) }
                    else { continuation.resume(throwing: NSError(domain: "WorkflowOfflineOCR", code: 1)) }
                }
        }
        let content = try webView().configuration.userContentController
        content.add(rules)
        defer {
            content.remove(rules)
            WKContentRuleListStore.default().removeContentRuleList(forIdentifier: ruleID) { _ in }
        }
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
        attachment.name = "Local OCR Worker WASM recognition of synthetic DE EN RU text with HTTP and HTTPS blocked"
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
    func testOptionalModelRuntimeModuleLoadsFromThePinnedSource() async throws {
        try await ready()
        let result = try await js("""
            const runtime=await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
            return {pipeline:typeof runtime.pipeline,cache:runtime.env.useBrowserCache,wasm:typeof runtime.env.backends.onnx.wasm};
            """, seconds: 60) as? [String: Any]
        XCTAssertEqual(result?["pipeline"] as? String, "function")
        XCTAssertEqual(result?["cache"] as? Bool, true)
        XCTAssertEqual(result?["wasm"] as? String, "object")
    }
    func testSpeechBridgeAvailabilityAndInvalidSessionDoNotStartRecording() async throws {
        try await ready()
        let result = try await js("""
            const api=Capacitor.Plugins.WorkflowSpeech;
            const availability=await api.available({language:'de-DE'});
            let rejected=false;
            try {await api.start({id:'invalid',language:'de-DE'});}catch(error){rejected=error.code==='SPEECH_INVALID_SESSION';}
            await api.stop({id:crypto.randomUUID(),abort:true});
            const parent=document.createElement('div'),button=document.createElement('button');parent.append(button);document.body.append(parent);
            try {
              WFSprechen.anhaengen({knopf:button,nach:parent});
              return {rejected,availableType:typeof availability.available,onDeviceType:typeof availability.supportsOnDevice,notice:button.title,recognizer:typeof window.SpeechRecognition};
            } finally {parent.nextElementSibling?.remove();parent.remove();}
            """) as? [String: Any]
        XCTAssertEqual(result?["rejected"] as? Bool, true)
        XCTAssertEqual(result?["availableType"] as? String, "boolean")
        XCTAssertEqual(result?["onDeviceType"] as? String, "boolean")
        XCTAssertEqual(result?["recognizer"] as? String, "function")
        XCTAssertTrue((result?["notice"] as? String)?.contains("Apple") == true)
        XCTAssertFalse((result?["notice"] as? String)?.contains("Android") == true)
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
