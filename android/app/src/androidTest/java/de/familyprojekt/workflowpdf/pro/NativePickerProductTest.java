package de.familyprojekt.workflowpdf.pro;

import android.app.*;
import android.content.*;
import android.graphics.*;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real WebView chooser/capture callbacks. Android picker and camera activities
 * return deterministic synthetic files; no camera hardware is claimed. */
@RunWith(AndroidJUnit4.class)
public final class NativePickerProductTest {
    private final Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
    private final Context context=instrumentation.getTargetContext();
    private String eval(ActivityScenario<MainActivity> scenario,String js)throws Exception{
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();scenario.onActivity(a->a.getBridge().getWebView().evaluateJavascript(js,value->{result.set(value);latch.countDown();}));assertTrue(latch.await(10,TimeUnit.SECONDS));return result.get();
    }
    private void until(ActivityScenario<MainActivity> scenario,String js)throws Exception{
        long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(70);while(System.nanoTime()<end){if("true".equals(eval(scenario,js)))return;Thread.sleep(150);}fail("Timed out: "+js);
    }
    @Test public void actualSystemFileChooserReturnsOriginalPdfToUnchangedCore()throws Exception{
        String authority=context.getPackageName()+".fixture.documents";context.getContentResolver().call(Uri.parse("content://"+authority),"fixture-reset",null,null);AtomicInteger hits=new AtomicInteger();
        Instrumentation.ActivityMonitor monitor=new Instrumentation.ActivityMonitor(){
            @Override public Instrumentation.ActivityResult onStartActivity(Intent intent){
                if(!Intent.ACTION_GET_CONTENT.equals(intent.getAction())&&!Intent.ACTION_OPEN_DOCUMENT.equals(intent.getAction()))return null;
                hits.incrementAndGet();return new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(DocumentsContract.buildDocumentUri(authority,"sourceA/Picker product.pdf")).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
            }
        };
        instrumentation.addMonitor(monitor);
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            until(scenario,"Boolean(window.__wfpdf&&window.PDFLib)");
            eval(scenario,"window.__pickerPdf=null;(async()=>{const p=await PDFLib.PDFDocument.create();p.addPage();const b=await p.save();let text='';for(const byte of b)text+=String.fromCharCode(byte);window.__pickerPdf=btoa(text);})();true");until(scenario,"typeof window.__pickerPdf==='string'");
            String base64=(String)new JSONTokener(eval(scenario,"__pickerPdf")).nextValue();File file=new File(context.getCacheDir(),"fixture-documents/sourceA/Picker product.pdf");try(FileOutputStream out=new FileOutputStream(file)){out.write(android.util.Base64.decode(base64,android.util.Base64.NO_WRAP));}
            eval(scenario,"document.getElementById('inDatei').click();true");until(scenario,"Boolean(__wfpdf.S.docs.find(d=>d.name==='Picker product'))");assertEquals(1,hits.get());
            eval(scenario,"window.__pickerProof=null;(async()=>{const doc=(await WFP.DB.all('docs')).find(d=>d.name==='Picker product');let b='';for(const byte of await WFP.DB.getFile(doc.id))b+=String.fromCharCode(byte);window.__pickerProof=btoa(b)===__pickerPdf&&!doc.pruefung;})();true");until(scenario,"window.__pickerProof!==null");assertEquals("true",eval(scenario,"__pickerProof"));
        }finally{instrumentation.removeMonitor(monitor);}
    }
    @Test public void cameraCaptureCancellationAndSyntheticJpegUseRealNativeGrantAndScannerInput()throws Exception{
        try(ParcelFileDescriptor fd=instrumentation.getUiAutomation().executeShellCommand("pm grant "+context.getPackageName()+" android.permission.CAMERA")){new FileInputStream(fd.getFileDescriptor()).read(new byte[128]);}
        AtomicBoolean cancel=new AtomicBoolean(true);AtomicInteger hits=new AtomicInteger();AtomicReference<Exception> failure=new AtomicReference<>();
        Instrumentation.ActivityMonitor monitor=new Instrumentation.ActivityMonitor(){
            @Override public Instrumentation.ActivityResult onStartActivity(Intent intent){
                if(!MediaStore.ACTION_IMAGE_CAPTURE.equals(intent.getAction()))return null;hits.incrementAndGet();if(cancel.get())return new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null);
                try{
                    Uri output=intent.getParcelableExtra(MediaStore.EXTRA_OUTPUT);assertNotNull(output);assertTrue((intent.getFlags()&Intent.FLAG_GRANT_WRITE_URI_PERMISSION)!=0);assertEquals("content",output.getScheme());assertEquals(context.getPackageName()+".fileprovider",output.getAuthority());
                    Bitmap bitmap=Bitmap.createBitmap(1200,1600,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(bitmap);canvas.drawColor(Color.WHITE);Paint paint=new Paint();paint.setColor(Color.BLACK);paint.setTextSize(60);canvas.drawText("SYNTHETIC CAMERA",100,400,paint);try(OutputStream out=context.getContentResolver().openOutputStream(output)){assertTrue(bitmap.compress(Bitmap.CompressFormat.JPEG,95,out));}bitmap.recycle();
                    return new Instrumentation.ActivityResult(Activity.RESULT_OK,null);
                }catch(Exception error){failure.set(error);return new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null);}
            }
        };
        instrumentation.addMonitor(monitor);
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            until(scenario,"Boolean(window.__wfpdf&&window.WFP?.Scanner)");eval(scenario,"window.__cameraBefore=__wfpdf.S.docs.length;__wfpdf.dlg.scanStarten('bibliothek','kamera');true");
            long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(10);while(hits.get()==0&&System.nanoTime()<end)Thread.sleep(100);assertEquals(1,hits.get());
            assertEquals("true",eval(scenario,"WFP.Scanner.zustand().seiten.length===0&&__wfpdf.S.docs.length===__cameraBefore"));
            eval(scenario,"WFP.Scanner.schliessen();true");cancel.set(false);eval(scenario,"__wfpdf.dlg.scanStarten('bibliothek','kamera');true");
            until(scenario,"Boolean(WFP.Scanner.zustand()?.seiten[0]?.erkennung)");if(failure.get()!=null)throw failure.get();assertEquals(2,hits.get());
            assertEquals("true",eval(scenario,"WFP.Scanner.zustand().seiten.length===1&&WFP.Scanner.zustand().seiten[0].foto.width===1200&&__wfpdf.S.docs.length===__cameraBefore"));eval(scenario,"WFP.Scanner.schliessen();true");
        }finally{instrumentation.removeMonitor(monitor);}
    }
}
