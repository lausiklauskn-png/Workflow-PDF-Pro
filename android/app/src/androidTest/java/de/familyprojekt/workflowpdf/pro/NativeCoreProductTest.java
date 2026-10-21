package de.familyprojekt.workflowpdf.pro;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Product paths in the actual packaged WebView: real PDF, fonts, WASM and OCR. */
@RunWith(AndroidJUnit4.class)
public final class NativeCoreProductTest {
    private String eval(ActivityScenario<MainActivity> scenario,String js)throws Exception{
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();scenario.onActivity(a->a.getBridge().getWebView().evaluateJavascript(js,value->{result.set(value);latch.countDown();}));assertTrue(latch.await(10,TimeUnit.SECONDS));return result.get();
    }
    private void until(ActivityScenario<MainActivity> scenario,String js,long seconds)throws Exception{
        long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(seconds);while(System.nanoTime()<end){if("true".equals(eval(scenario,js)))return;Thread.sleep(200);}fail("Timed out: "+js+" "+eval(scenario,"JSON.stringify(window.__nativeCoreProof)"));
    }
    @Test public void realFormExportsUnicodeTemplateHtmlZipAndOriginalEncryptedBackupRemainUsable()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            until(scenario,"Boolean(window.__wfpdf&&window.PDFLib&&window.WFP?.Sicherung)",60);
            eval(scenario,"window.__nativeCoreProof=null;(async()=>{try{const pdf=await PDFLib.PDFDocument.create();const p=pdf.addPage([595,842]);pdf.addPage([595,842]).setRotation(PDFLib.degrees(90));const f=pdf.getForm().createTextField('Name');f.setText('Müller');f.addToPage(p,{x:50,y:650,width:200,height:25});const bytes=await pdf.save();const [doc]=await __wfpdf.importDateien([new File([bytes],'Native full form.pdf',{type:'application/pdf'})],null,{still:true});doc.fields[0].value='Иван Петров';doc.fields[0].geprueft=true;await WFP.DB.put('docs',doc);await WFP.DB.put('files',{id:doc.id+'~original',name:'original.png',bytes:new Uint8Array([1,4,9])});const font=await WFP.Uebersetzung.schriftLaden('vendor/');const outputs={};for(const mode of ['fest','ausfuellbar','vorlage']){const out=await WFP.Export.exportieren(doc,bytes,mode,{schrift:new Uint8Array(font),unicodeFelder:true});const check=await PDFLib.PDFDocument.load(out.bytes);outputs[mode]={pages:check.getPageCount(),rotation:check.getPage(1).getRotation().angle,fields:check.getForm().getFields().map(field=>{try{return field.getText();}catch{return null;}}),warnings:out.hinweise};}const html=await WFP.HtmlExport.htmlFormular(doc,bytes);const zip=WFP.Zip.zip([{name:'Форма.pdf',bytes:new Uint8Array(bytes)}]);const backup=await WFP.Sicherung.verschliessen('Native synthetic password 2026',WFP.DB);const restored=await WFP.Sicherung.oeffnen('Native synthetic password 2026',backup.datei);let wrong=false;try{await WFP.Sicherung.oeffnen('Wrong synthetic password',backup.datei);}catch{wrong=true;}window.__nativeCoreProof={outputs,html:html.includes('Иван Петров')&&html.includes('data:image/jpeg;base64,'),zip:zip[0]===80&&zip[1]===75,backup:restored.docs.some(d=>d.id===doc.id)&&restored.originale.get(doc.id).bytes.join(',')==='1,4,9',wrong,original:(await WFP.DB.getFile(doc.id)).every((n,i)=>n===bytes[i])};}catch(error){window.__nativeCoreProof={error:String(error)};}})();true");
            until(scenario,"window.__nativeCoreProof!==null",120);
            assertEquals("Native export proof: "+eval(scenario,"JSON.stringify(__nativeCoreProof)"),"true",eval(scenario,"!__nativeCoreProof.error&&__nativeCoreProof.original&&__nativeCoreProof.html&&__nativeCoreProof.zip&&__nativeCoreProof.backup&&__nativeCoreProof.wrong&&Object.values(__nativeCoreProof.outputs).every(o=>o.pages===2&&o.rotation===90)&&__nativeCoreProof.outputs.fest.fields.length===0&&__nativeCoreProof.outputs.ausfuellbar.fields.includes('Иван Петров')&&__nativeCoreProof.outputs.vorlage.fields.every(t=>!t)"));
        }
    }
    @Test public void packagedScannerLoadsRealLocalModelAndOcrThenCreatesSearchablePdf()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            until(scenario,"Boolean(window.__wfpdf&&window.WFP?.Scanner)",60);
            eval(scenario,"window.__nativeCoreProof=null;(async()=>{try{__wfpdf.dlg.scanStarten('bibliothek');const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1600;const x=canvas.getContext('2d');x.fillStyle='#454f59';x.fillRect(0,0,1200,1600);x.fillStyle='#fff';x.fillRect(100,100,1000,1400);x.fillStyle='#000';x.font='60px sans-serif';x.fillText('NATIVE OCR 12345',180,400);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));await WFP.Scanner.hinzu([new File([blob],'Synthetic OCR.png',{type:'image/png'})]);const state=WFP.Scanner.zustand(),s=state.seiten[0];const ml=s.erkennung.verfahren.ml,mlError=window.__wfpdfScan?.mlFehler;s.manuell=true;s.ecken=WFP.ScanBild.ganz(s.foto.width,s.foto.height);s.filter='original';state.format='blatt';state.sprache='eng';state.durchsuchbar=true;await WFP.Scanner.ocrSeite(s,110);const text=s.ocr.zeilen.map(z=>z.text).join(' '),bytes=await WFP.Scanner.pdfBauen();const pdf=await pdfjsLib.getDocument({data:bytes.slice()}).promise;const extracted=(await (await pdf.getPage(1)).getTextContent()).items.map(i=>i.str).join(' ');await pdf.destroy();WFP.Scanner.schliessen();window.__nativeCoreProof={ml,mlError,text,extracted,pdf:bytes[0]===37};}catch(error){window.__nativeCoreProof={error:String(error)};}})();true");
            until(scenario,"window.__nativeCoreProof!==null",150);
            assertEquals("Native scanner proof: "+eval(scenario,"JSON.stringify(__nativeCoreProof)"),"true",eval(scenario,"!__nativeCoreProof.error&&__nativeCoreProof.ml&&__nativeCoreProof.pdf&&/NATIVE.*OCR.*12345/i.test(__nativeCoreProof.text)&&/NATIVE.*OCR.*12345/i.test(__nativeCoreProof.extracted)"));
        }
    }
}
