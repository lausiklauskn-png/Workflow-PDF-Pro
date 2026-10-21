package de.familyprojekt.workflowpdf.pro;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** The real packaged WebView and Java bridge. No claim about camera hardware or Google. */
@RunWith(AndroidJUnit4.class)
public final class NativeFoundationTest {
    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1); AtomicReference<String> value = new AtomicReference<>();
        scenario.onActivity(a -> a.getBridge().getWebView().evaluateJavascript(script, result -> { value.set(result); done.countDown(); }));
        assertTrue(done.await(10, TimeUnit.SECONDS)); return value.get();
    }
    private void await(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(60);
        while (System.nanoTime() < deadline) { if ("true".equals(evaluate(scenario, script))) return; Thread.sleep(200); }
        fail("Timed out: " + script);
    }
    @Test public void bundledCoreHasLocalOriginAndRealNativeFileBridge() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            await(scenario, "Boolean(window.__wfpdf && window.WFPNativeFiles && window.PDFLib)");
            assertEquals("\"https://localhost\"", evaluate(scenario, "location.origin"));
            assertEquals("\"Workflow PDF Pro\"", evaluate(scenario, "document.querySelector('.marke-name').textContent"));
            assertEquals("true", evaluate(scenario, "document.querySelector('#btnInstall').getBoundingClientRect().width === 0"));
            evaluate(scenario, "WFPNativeFiles.transfer(new Blob(['Native boundary'],{type:'text/plain'}),'Мüller.txt').then(id=>Capacitor.Plugins.WorkflowFiles.abort({id})).then(()=>window.__transferOK=true).catch(e=>window.__transferError=String(e));true");
            await(scenario, "window.__transferOK === true || Boolean(window.__transferError)");
            assertEquals("Native transfer error: " + evaluate(scenario, "window.__transferError"), "true", evaluate(scenario, "window.__transferOK === true"));
        }
    }
    @Test public void nativeSaveCancellationRetainsOriginalAndCanBeRetried() throws Exception {
        android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        android.content.IntentFilter picker = new android.content.IntentFilter(android.content.Intent.ACTION_CREATE_DOCUMENT);
        picker.addCategory(android.content.Intent.CATEGORY_OPENABLE);
        picker.addDataType("*/*");
        android.app.Instrumentation.ActivityMonitor monitor = new android.app.Instrumentation.ActivityMonitor(
            picker,
            new android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_CANCELED, null), true);
        instrumentation.addMonitor(monitor);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            await(scenario, "Boolean(window.WFPNativeFiles)");
            for (int attempt = 1; attempt <= 2; attempt++) {
                evaluate(scenario, "window.__saveResult=null;WFPNativeFiles.save(new Blob(['unchanged'],{type:'text/plain'}),'Dokument.txt').then(r=>window.__saveResult=r).catch(e=>window.__saveResult={error:String(e)});true");
                await(scenario, "window.__saveResult !== null");
                assertEquals("Native save result: " + evaluate(scenario, "JSON.stringify(window.__saveResult)"), "true", evaluate(scenario, "window.__saveResult.cancelled === true && !window.__saveResult.saved"));
                assertEquals(attempt, monitor.getHits());
            }
        } finally { instrumentation.removeMonitor(monitor); }
    }
    @Test public void nativeFolderPickerCancellationLeavesLibraryUnchanged() throws Exception {
        android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        android.content.IntentFilter filter = new android.content.IntentFilter(android.content.Intent.ACTION_OPEN_DOCUMENT_TREE);
        android.app.Instrumentation.ActivityMonitor monitor = new android.app.Instrumentation.ActivityMonitor(filter,
            new android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_CANCELED, null), true);
        instrumentation.addMonitor(monitor);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            await(scenario, "Boolean(window.__wfpdf && window.WFPNativeImport)");
            evaluate(scenario, "window.__folderBefore=__wfpdf.S.docs.length;WFPNativeImport.choose(document.getElementById('inOrdner')).then(()=>window.__folderCancelled=true);true");
            await(scenario, "window.__folderCancelled === true");
            assertEquals("true", evaluate(scenario, "__wfpdf.S.docs.length === __folderBefore && !document.getElementById('nativeImportStatus')"));
            assertEquals(1, monitor.getHits());
        } finally { instrumentation.removeMonitor(monitor); }
    }
    @Test public void selectedFolderPassesRealJavaChunksToOriginalInput() throws Exception {
        android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        android.content.Context context = instrumentation.getTargetContext();
        String authority = context.getPackageName() + ".fixture.documents";
        context.getContentResolver().call(android.net.Uri.parse("content://" + authority), "fixture-reset", null, null);
        android.content.Intent result = new android.content.Intent().setData(android.provider.DocumentsContract.buildTreeDocumentUri(authority,"sourceA"))
            .addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
        android.app.Instrumentation.ActivityMonitor monitor = new android.app.Instrumentation.ActivityMonitor(
            new android.content.IntentFilter(android.content.Intent.ACTION_OPEN_DOCUMENT_TREE),
            new android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_OK, result), true);
        instrumentation.addMonitor(monitor);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            await(scenario, "Boolean(window.__wfpdf && window.WFPNativeImport)");
            evaluate(scenario, "document.getElementById('inOrdner').onchange=async e=>{const f=e.target.files[0],b=new Uint8Array(await f.arrayBuffer());window.__folderBytes=b.length===300000&&b.every((x,i)=>x===i%251)&&f.webkitRelativePath==='sourceA/one.txt';};WFPNativeImport.choose(document.getElementById('inOrdner')).then(()=>window.__folderDone=true);true");
            await(scenario, "window.__folderDone === true");
            assertEquals("true", evaluate(scenario, "window.__folderBytes === true"));
            assertEquals(1, monitor.getHits());
        } finally { instrumentation.removeMonitor(monitor); }
    }
    @Test public void androidBackCancelsSafetyPromptBeforeSendingAndReturnsFromEditor() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            await(scenario, "Boolean(window.__wfpdf && window.PDFLib)");
            evaluate(scenario, "(async()=>{const p=await PDFLib.PDFDocument.create();p.addPage();await __wfpdf.importDateien([new File([await p.save()],'Back.pdf',{type:'application/pdf'})]);window.__backImported=true;})();true");
            await(scenario, "window.__backImported === true && document.querySelector('#sc-ed').classList.contains('on')");
            evaluate(scenario, "__wfpdf.kiReiniger('chrome').halt(__wfpdf.S.doc,[{grund:'unsichtbar',text:'hidden fixture',seite:1}]).then(ok=>window.__cleanAccepted=ok);true");
            await(scenario, "Boolean(document.querySelector('[data-ki-halt]'))");
            androidx.test.espresso.Espresso.pressBackUnconditionally();
            await(scenario, "window.__cleanAccepted === false && !document.querySelector('[data-ki-halt]')");
            assertEquals("true", evaluate(scenario, "!__wfpdf.S.doc.kiEntfernt"));
            androidx.test.espresso.Espresso.pressBackUnconditionally();
            await(scenario, "document.querySelector('#sc-bib').classList.contains('on')");
        }
    }
}
