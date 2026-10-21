package de.familyprojekt.workflowpdf.pro;

import android.content.*;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Actual Activity/WebView/Java lifecycle, synthetic app-private provider. */
@RunWith(AndroidJUnit4.class)
public final class NativeIncomingTest {
    private Context context;private Uri uri;
    @Before public void setup(){context=InstrumentationRegistry.getInstrumentation().getTargetContext();String authority=context.getPackageName()+".fixture.documents";context.getContentResolver().call(Uri.parse("content://"+authority),"fixture-reset",null,null);uri=DocumentsContract.buildDocumentUri(authority,"sourceA/one.txt");}
    private Intent send(){return new Intent(context,MainActivity.class).setAction(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_GRANT_READ_URI_PERMISSION);}
    private String eval(ActivityScenario<MainActivity> scenario,String js)throws Exception{
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();
        scenario.onActivity(a->a.getBridge().getWebView().evaluateJavascript(js,r->{value.set(r);latch.countDown();}));assertTrue(latch.await(10,TimeUnit.SECONDS));return value.get();
    }
    private void until(ActivityScenario<MainActivity> scenario,String js)throws Exception{
        long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(60);while(System.nanoTime()<end){if("true".equals(eval(scenario,js)))return;Thread.sleep(100);}fail("Timed out: "+js);
    }
    @Test public void coldStartQueuesOnceAndAcknowledgementSurvivesActivityRecreation()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(send())){
            until(scenario,"Boolean(window.WFPNativeIncoming && document.querySelector('#nativeIncoming button'))");
            eval(scenario,"window.__inResult=null;Capacitor.Plugins.WorkflowIncoming.pending().then(async b=>{const p=await Capacitor.Plugins.WorkflowIncoming.read({batch:b.id,id:b.files[0].id,offset:0});await Capacitor.Plugins.WorkflowIncoming.acknowledge({id:b.id});window.__inResult={part:p,after:await Capacitor.Plugins.WorkflowIncoming.pending()};});true");
            until(scenario,"Boolean(window.__inResult)");
            assertEquals("true",eval(scenario,"__inResult.after.empty===true && atob(__inResult.part.data).length===262144 && __inResult.part.done===false"));
            scenario.recreate();until(scenario,"Boolean(window.WFPNativeIncoming && window.__wfpdf)");
            eval(scenario,"window.__after=null;Capacitor.Plugins.WorkflowIncoming.pending().then(b=>window.__after=b);true");until(scenario,"Boolean(window.__after)");assertEquals("true",eval(scenario,"__after.empty===true"));
        }
    }
    @Test public void warmStartsWithSameActionRemainDistinctAndKeepNewestLaunchIntent()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            until(scenario,"Boolean(window.WFPNativeIncoming && window.__wfpdf)");
            eval(scenario,"window.__warmEvents=0;window.__listenerReady=false;Capacitor.Plugins.WorkflowIncoming.addListener('available',()=>window.__warmEvents++).then(()=>window.__listenerReady=true);true");
            until(scenario,"window.__listenerReady===true");
            scenario.onActivity(a->a.startActivity(send()));until(scenario,"window.__warmEvents===1");
            scenario.onActivity(a->a.startActivity(send()));until(scenario,"window.__warmEvents===2");
            until(scenario,"Boolean(document.querySelector('#nativeIncoming button'))");
            eval(scenario,"window.__warm=null;Capacitor.Plugins.WorkflowIncoming.pending().then(async a=>{await Capacitor.Plugins.WorkflowIncoming.acknowledge({id:a.id});const b=await Capacitor.Plugins.WorkflowIncoming.pending();window.__warm={a:a.id,b:b.id};});true");until(scenario,"Boolean(window.__warm)");
            assertEquals("true",eval(scenario,"typeof __warm.b==='string' && __warm.a!==__warm.b"));
            scenario.onActivity(a->assertEquals(Intent.ACTION_SEND,a.getIntent().getAction()));
            eval(scenario,"window.__cleared=false;Capacitor.Plugins.WorkflowIncoming.acknowledge({id:__warm.b}).then(()=>window.__cleared=true);true");until(scenario,"window.__cleared===true");
            scenario.onActivity(a->assertEquals(Intent.ACTION_MAIN,a.getIntent().getAction()));
        }
    }
    @Test public void realViewIntentStreamsPdfIntoUnchangedCoreWithOriginalAndFormValue()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            until(scenario,"Boolean(window.WFPNativeIncoming && window.__wfpdf && window.PDFLib)");
            eval(scenario,"window.__incomingPdf=null;(async()=>{const pdf=await PDFLib.PDFDocument.create();const page=pdf.addPage();const f=pdf.getForm().createTextField('Name');f.setText('Müller');f.addToPage(page,{x:30,y:600,width:150,height:25});const bytes=await pdf.save();let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);window.__incomingPdf=btoa(binary);})();true");
            until(scenario,"typeof window.__incomingPdf==='string'");
            String base64=(String)new org.json.JSONTokener(eval(scenario,"__incomingPdf")).nextValue();
            java.io.File file=new java.io.File(context.getCacheDir(),"fixture-documents/sourceA/Received Мüller.pdf");
            try(java.io.FileOutputStream out=new java.io.FileOutputStream(file)){out.write(android.util.Base64.decode(base64,android.util.Base64.NO_WRAP));}
            String authority=context.getPackageName()+".fixture.documents";
            Uri document=DocumentsContract.buildDocumentUri(authority,"sourceA/Received Мüller.pdf");
            Intent view=new Intent(context,MainActivity.class).setAction(Intent.ACTION_VIEW).setDataAndType(document,"application/pdf").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_GRANT_READ_URI_PERMISSION);
            scenario.onActivity(a->a.startActivity(view));
            until(scenario,"Boolean(document.querySelector('#nativeIncoming button'))");
            eval(scenario,"document.querySelector('#nativeIncoming button').click();true");
            until(scenario,"Boolean(__wfpdf.S.docs.find(d=>d.name==='Received Мüller'))");
            eval(scenario,"window.__coreReceipt=null;(async()=>{const d=(await WFP.DB.all('docs')).find(d=>d.name==='Received Мüller');let binary='';for(const byte of await WFP.DB.getFile(d.id))binary+=String.fromCharCode(byte);window.__coreReceipt={original:btoa(binary)===__incomingPdf,value:d.fields[0].value,unexamined:!d.pruefung};})();true");
            until(scenario,"Boolean(window.__coreReceipt)");
            assertEquals("true",eval(scenario,"__coreReceipt.original && __coreReceipt.value==='Müller' && __coreReceipt.unexamined"));
        }
    }
}
