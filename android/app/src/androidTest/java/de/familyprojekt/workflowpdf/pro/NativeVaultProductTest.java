package de.familyprojekt.workflowpdf.pro;

import android.content.Context;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real packaged core, SAF streams, Keystore/encryption and index switch.
 * Only the user-selected target/password setup uses a synthetic debug provider. */
@RunWith(AndroidJUnit4.class)
public final class NativeVaultProductTest {
    private String eval(ActivityScenario<MainActivity> scenario,String js)throws Exception{
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        scenario.onActivity(a->a.getBridge().getWebView().evaluateJavascript(js,value->{result.set(value);latch.countDown();}));
        assertTrue(latch.await(10,TimeUnit.SECONDS));return result.get();
    }
    private void until(ActivityScenario<MainActivity> scenario,String js)throws Exception{
        long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(90);
        while(System.nanoTime()<end){if("true".equals(eval(scenario,js)))return;Thread.sleep(150);}fail("Timed out: "+js);
    }
    @Test public void transferActualLibraryToEncryptedMainStorageRetainsPdfOriginalAndTranslationJobAfterRestart()throws Exception{
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        context.getContentResolver().call(Uri.parse("content://"+context.getPackageName()+".fixture.documents"),"fixture-reset",null,null);
        context.getSharedPreferences("workflow-vault-locations-v1",0).edit().clear().commit();
        VaultLocations places=new VaultLocations(context);DocumentVault candidate=places.candidate();
        Uri tree=DocumentsContract.buildTreeDocumentUri(context.getPackageName()+".fixture.documents","vaultA");
        candidate.initialize(candidate.inspect(tree),"Synthetic vault password 2026",true);String location=places.adopt(candidate);places.close();
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            try{
                until(scenario,"Boolean(window.WFPNativeVault && !WFPNativeVault.gate.blocked && window.__wfpdf && window.PDFLib)");
                eval(scenario,"window.__vaultSeed=null;(async()=>{const pdf=await PDFLib.PDFDocument.create();const page=pdf.addPage();const field=pdf.getForm().createTextField('Name');field.setText('Müller');field.addToPage(page,{x:30,y:600,width:150,height:25});const bytes=await pdf.save();const [doc]=await __wfpdf.importDateien([new File([bytes],'Native vault product.pdf',{type:'application/pdf'})],null,{still:true});await WFP.DB.put('files',{id:doc.id+'~original',name:'original.png',bytes:new Uint8Array([4,5,6])});await WFP.DB.put('files',{id:'ue:'+doc.id+':de-ru',job:{page:7,texte:['Имя']}});let b='';for(const byte of bytes)b+=String.fromCharCode(byte);window.__vaultSeed={id:doc.id,expected:btoa(b)};})();true");
                until(scenario,"Boolean(window.__vaultSeed)");
                JSONObject seed=new JSONObject((String)new JSONTokener(eval(scenario,"JSON.stringify(__vaultSeed)")).nextValue());
                eval(scenario,"window.__vaultOldPage=true;Capacitor.Plugins.WorkflowVault.state({location:"+JSONObject.quote(location)+"}).then(state=>WFPNativeVault.selectLocation(state));true");
                until(scenario,"Boolean(document.querySelector('.native-vault-dialog button'))");
                eval(scenario,"document.querySelector('.native-vault-dialog button:last-child').click();true");
                until(scenario,"Boolean(window.WFPNativeVault && !WFPNativeVault.gate.blocked && window.__wfpdf && !window.__vaultOldPage)");
                String id=JSONObject.quote(seed.getString("id")),expected=JSONObject.quote(seed.getString("expected"));
                eval(scenario,"window.__vaultProof=null;(async()=>{const id="+id+",doc=await WFP.DB.get('docs',id),original=await WFP.DB.get('files',id+'~original'),job=await WFP.DB.get('files','ue:'+id+':de-ru');let b='';for(const byte of await WFP.DB.getFile(id))b+=String.fromCharCode(byte);const q=indexedDB.open('WorkflohPDF1',3);const db=await new Promise(r=>q.onsuccess=()=>r(q.result));const raw=await new Promise(r=>{const request=db.transaction('files').objectStore('files').get(id);request.onsuccess=()=>r(request.result);});db.close();window.__vaultProof={bytes:btoa(b)==="+expected+",value:doc.fields[0].value,photo:Array.from(original.bytes).join(','),page:job.job.page,reference:!!raw.__wfpVault&&!raw.bytes};})().catch(error=>window.__vaultProof={error:String(error),blocked:WFPNativeVault.gate.blocked,fault:WFPNativeVault.gate.fault});true");
                until(scenario,"Boolean(window.__vaultProof)");assertEquals("Vault proof: "+eval(scenario,"JSON.stringify(__vaultProof)"),"true",eval(scenario,"__vaultProof.bytes && __vaultProof.value==='Müller' && __vaultProof.photo==='4,5,6' && __vaultProof.page===7 && __vaultProof.reference"));
                scenario.recreate();until(scenario,"Boolean(window.WFPNativeVault && !WFPNativeVault.gate.blocked && window.__wfpdf)");
                eval(scenario,"window.__jobProof=null;WFP.DB.get('files','ue:'+"+id+"+':de-ru').then(v=>window.__jobProof=v.job.page);true");until(scenario,"window.__jobProof!==null");assertEquals("7",eval(scenario,"__jobProof"));
            }finally{
                // Only the instrumentation debug application's synthetic stores.
                eval(scenario,"window.__vaultCleared=false;const q=indexedDB.open('WorkflohPDF1',3);q.onsuccess=()=>{const db=q.result;const tx=db.transaction(['folders','docs','files','texte','vektoren'],'readwrite');for(const store of ['folders','docs','files','texte','vektoren'])tx.objectStore(store).clear();tx.oncomplete=()=>{db.close();window.__vaultCleared=true;};};true");
                until(scenario,"window.__vaultCleared===true");
            }
        }finally{context.getSharedPreferences("workflow-vault-locations-v1",0).edit().remove("primary").remove("migration").commit();}
    }
}
