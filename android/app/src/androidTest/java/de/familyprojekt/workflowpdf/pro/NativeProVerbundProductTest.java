package de.familyprojekt.workflowpdf.pro;

import android.content.Context;
import android.graphics.Paint;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import de.familyprojekt.tresor.*;
import java.io.*;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Actual packaged Workflow UI, ordinary PDF import/export, real SAF and Keystore.
 * The other end is a canonical Family actor, explicitly not a second installed app. */
@RunWith(AndroidJUnit4.class)
public final class NativeProVerbundProductTest {
    private String eval(ActivityScenario<MainActivity> scenario,String js)throws Exception {
        CountDownLatch done=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        scenario.onActivity(a->a.getBridge().getWebView().evaluateJavascript(js,value->{result.set(value);done.countDown();}));
        assertTrue(done.await(10,TimeUnit.SECONDS));return result.get();
    }
    private void until(ActivityScenario<MainActivity> scenario,String js)throws Exception {
        long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(90);
        while(System.nanoTime()<end){if("true".equals(eval(scenario,js)))return;Thread.sleep(150);}
        fail("Timed out: "+js+" "+eval(scenario,"JSON.stringify({error:window.__proError,status:document.querySelector('[data-pro-status]')?.textContent})"));
    }
    private void ready(ActivityScenario<MainActivity> scenario)throws Exception {
        until(scenario,"Boolean(window.__wfpdf&&window.WFPProVerbund&&!WFPNativeVault.gate.blocked)");
        eval(scenario,"document.documentElement.lang='de';true");
    }
    private JSONObject object(ActivityScenario<MainActivity> scenario,String js)throws Exception {
        return new JSONObject((String)new JSONTokener(eval(scenario,"JSON.stringify("+js+")")).nextValue());
    }
    @Test public void selectedOrdinaryImportAndShareSurviveRecreationAndWaitForRealRecipientMark()throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();String authority=context.getPackageName()+".fixture.documents";
        context.getContentResolver().call(Uri.parse("content://"+authority),"fixture-reset",null,null);
        context.getSharedPreferences("workflow-vault-locations-v1",0).edit().clear().commit();
        context.getSharedPreferences("workflow-tresorordner-v1",0).edit().clear().commit();
        Uri tree=DocumentsContract.buildTreeDocumentUri(authority,"vaultA");String password="Erfundene UI-Probe 2026";
        byte[] input;
        try(ByteArrayOutputStream output=new ByteArrayOutputStream()){
            PdfDocument pdf=new PdfDocument();PdfDocument.Page p=pdf.startPage(new PdfDocument.PageInfo.Builder(300,400,1).create());
            Paint paint=new Paint();paint.setTextSize(14);p.getCanvas().drawText("Erfundener Pro-Verbund",20,70,paint);pdf.finishPage(p);pdf.writeTo(output);pdf.close();input=output.toByteArray();
        }
        ProTresorordner setup=new ProTresorordner(context);
        try(TresorOrdner family=TresorOrdner.anlegen(new SafAblage(context.getContentResolver(),tree),"familienakte",password)){
            Uebergaben partner=new Uebergaben(family);
            Eintrag sent=partner.senden("workflow-pdf-pro","android-family-ui","family-document-ui","","Android Pro.pdf","application/pdf",new ByteArrayInputStream(input));
            DocumentVault own=new DocumentVault(context,"vault-ui-optional","vault-ui-optional-key");
            setup.pruefenVerbindung(tree);setup.baumSetzen(tree);setup.mitPasswort(password,false,true,own,true);setup.schliessen();assertFalse(own.configured());
            try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
                try{
                    ready(scenario);eval(scenario,"WFPProVerbund.dialog();true");
                    String item="document.querySelector('[data-pro-entry=\""+sent.id+"\"] input')";
                    until(scenario,"Boolean("+item+")");assertFalse(partner.bestaetigt("workflow-pdf-pro",sent.id));
                    eval(scenario,item+".click();document.querySelector('#nativeProVerbund [data-pro-action=receive]').click();true");
                    until(scenario,"document.querySelector('#nativeProVerbund [data-pro-status]')?.textContent==='Auswahl gespeichert und im Eingang bestätigt.'");
                    assertTrue(partner.bestaetigt("workflow-pdf-pro",sent.id));
                    eval(scenario,"window.__proProof=null;(async()=>{const row=(await WFPProTransferStore.snapshot()).find(r=>r.kind==='eingang'&&r.source.transfer==='android-family-ui');const d=await WFP.DB.get('docs',row.docId),o=await WFP.DB.get('files',row.docId+'~original');window.__proProof={id:d.id,hash:await WFPProTransferStore.hash(o.bytes),pages:d.pages.length,checked:!!d.pruefung,own:WFPNativeVault.aktiv()};})().catch(e=>window.__proError=String(e));true");
                    until(scenario,"Boolean(window.__proProof)");JSONObject received=object(scenario,"__proProof");assertEquals(sent.sha256,received.getString("hash"));assertEquals(1,received.getInt("pages"));assertFalse(received.getBoolean("checked"));assertTrue(received.isNull("own"));
                    eval(scenario,"document.querySelector('#nativeProVerbund [data-pro-action=close]').click();void __wfpdf.dlg.teilenDocs([__proProof.id]).catch(e=>window.__proError=String(e));true");
                    until(scenario,"Boolean(document.querySelector('#nativeProTarget [data-pro-action=familienakte]'))");
                    eval(scenario,"document.querySelector('#nativeProTarget [data-pro-action=familienakte]').click();true");
                    until(scenario,"!document.querySelector('#nativeProTarget')");
                    eval(scenario,"window.__proOut=null;WFPProTransfers.outbox().then(rows=>window.__proOut=rows.find(r=>r.vertrag.bezug==='android-family-ui'));true");until(scenario,"Boolean(window.__proOut)");
                    JSONObject outgoing=object(scenario,"__proOut");assertEquals("weitergegeben",outgoing.getString("stand"));assertEquals("family-document-ui",outgoing.getJSONObject("vertrag").getString("dokumentId"));
                    scenario.recreate();ready(scenario);
                    eval(scenario,"window.__proRetry=null;WFPProTransfers.retry("+JSONObject.quote(outgoing.getString("id"))+").then(r=>window.__proRetry=r,e=>window.__proError=String(e));true");until(scenario,"Boolean(window.__proRetry)");
                    JSONObject repeated=object(scenario,"__proRetry");assertEquals(outgoing.getString("entryId"),repeated.getString("entryId"));assertEquals("weitergegeben",repeated.getString("stand"));
                    List<Map<String,Object>> pending=partner.offen();assertEquals(1,pending.size());String back=(String)pending.get(0).get("entryId");
                    assertEquals(outgoing.getString("entryId"),back);byte[] returned=partner.lesen(back);assertTrue(returned.length>500);assertEquals('%',returned[0]);
                    assertEquals("android-family-ui",partner.beschreibung(back).get("bezug"));assertEquals("family-document-ui",partner.beschreibung(back).get("dokumentId"));
                    File saved=File.createTempFile("pro-ui-receiver-",".pdf",context.getCacheDir());
                    try{try(FileOutputStream out=new FileOutputStream(saved)){out.write(returned);out.getFD().sync();}assertArrayEquals(returned,Files.readAllBytes(saved.toPath()));partner.quittieren(back,ProVerbund.sha(returned));}finally{saved.delete();}
                    eval(scenario,"WFPProVerbund.dialog();true");until(scenario,"Boolean(document.querySelector('#nativeProVerbund [data-pro-action=confirm]'))");eval(scenario,"document.querySelector('#nativeProVerbund [data-pro-action=confirm]').click();true");
                    until(scenario,"document.querySelector('#nativeProVerbund [data-pro-status]')?.textContent==='In der Ziel-App gespeichert'");
                    eval(scenario,"window.__proFinal=null;(async()=>{const r=(await WFPProTransfers.outbox()).find(r=>r.id==="+JSONObject.quote(outgoing.getString("id"))+");window.__proFinal={stand:r.stand,payload:!!(await WFP.DB.get('files',r.payloadId)),docs:__wfpdf.S.docs.filter(d=>d.proEingang?.source.transfer==='android-family-ui').length};})();true");
                    until(scenario,"Boolean(window.__proFinal)");JSONObject last=object(scenario,"__proFinal");assertEquals("im-eingang",last.getString("stand"));assertFalse(last.getBoolean("payload"));assertEquals(1,last.getInt("docs"));
                }finally{
                    // Remove only this test's synthetic rows from the debug app.
                    eval(scenario,"window.__proCleared=false;(async()=>{const rows=await WFPProTransferStore.snapshot();const mine=rows.filter(r=>r.source?.transfer==='android-family-ui'||r.vertrag?.bezug==='android-family-ui');for(const r of mine){if(r.kind==='eingang'){await WFP.DB.del('docs',r.docId);await WFP.DB.del('files',r.docId);}else await WFP.DB.del('files',r.payloadId);}const q=indexedDB.open('WorkflowProTransfers1',1);const db=await new Promise(r=>q.onsuccess=()=>r(q.result));const tx=db.transaction('receipts','readwrite');for(const r of mine)tx.objectStore('receipts').delete('internal:'+r.id);tx.oncomplete=()=>{db.close();window.__proCleared=true;};})().catch(e=>window.__proError=String(e));true");until(scenario,"window.__proCleared===true");
                }
            }
        }finally{setup.sperren(true);context.getSharedPreferences("workflow-tresorordner-v1",0).edit().clear().commit();}
    }
}
