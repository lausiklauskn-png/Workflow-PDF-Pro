package de.familyprojekt.workflowpdf.pro;

import android.app.*;
import android.content.*;
import android.graphics.*;
import android.graphics.pdf.PdfDocument;
import android.os.*;
import android.print.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class NativeOutputTest {
    private final Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
    private final Context context=instrumentation.getTargetContext();
    @Test public void printSuppliesEveryOriginalPdfByteOffMainThreadAndCancelledWritesNeverClaimSuccess()throws Exception{
        File source=File.createTempFile("print-original-",".pdf",context.getCacheDir()),output=File.createTempFile("print-output-",".pdf",context.getCacheDir());
        try{
            PdfDocument pdf=new PdfDocument();for(int i=0;i<2;i++){PdfDocument.Page page=pdf.startPage(new PdfDocument.PageInfo.Builder(595,842,i+1).create());Paint paint=new Paint();paint.setTextSize(18);page.getCanvas().drawText("Synthetic print "+i,50,100,paint);pdf.finishPage(page);}try(FileOutputStream out=new FileOutputStream(source)){pdf.writeTo(out);}pdf.close();
            PdfPrintAdapter adapter=new PdfPrintAdapter(source,"Original.pdf");CountDownLatch layout=new CountDownLatch(1);AtomicInteger pages=new AtomicInteger();AtomicReference<String> error=new AtomicReference<>();AtomicBoolean background=new AtomicBoolean();
            adapter.layoutAsync(new PrintAttributes.Builder().build(),new PrintAttributes.Builder().build(),new CancellationSignal(),new PdfPrintAdapter.LayoutResult(){
                @Override public void finished(PrintDocumentInfo info,boolean changed){pages.set(info.getPageCount());background.set(Looper.myLooper()!=Looper.getMainLooper());layout.countDown();}
                @Override public void failed(CharSequence message){error.set(message.toString());layout.countDown();}
            public void cancelled(){error.set("cancelled");layout.countDown();}});assertTrue(layout.await(10,TimeUnit.SECONDS));assertNull(error.get());assertEquals(2,pages.get());assertTrue(background.get());
            CountDownLatch written=new CountDownLatch(1);AtomicInteger successes=new AtomicInteger();
            try(ParcelFileDescriptor destination=ParcelFileDescriptor.open(output,ParcelFileDescriptor.MODE_WRITE_ONLY|ParcelFileDescriptor.MODE_TRUNCATE)){
                adapter.writeAsync(destination,new CancellationSignal(),new PdfPrintAdapter.WriteResult(){
                    @Override public void finished(PageRange[] ranges){successes.incrementAndGet();written.countDown();}
                    @Override public void failed(CharSequence message){error.set(message.toString());written.countDown();}
                    public void cancelled(){error.set("cancelled");written.countDown();}
                });assertTrue(written.await(10,TimeUnit.SECONDS));assertNull(error.get());assertEquals(1,successes.get());
            }
            assertArrayEquals(ProFilesPlugin.hash(new FileInputStream(source)),ProFilesPlugin.hash(new FileInputStream(output)));
            CountDownLatch cancelled=new CountDownLatch(1);CancellationSignal stop=new CancellationSignal();stop.cancel();
            try(ParcelFileDescriptor destination=ParcelFileDescriptor.open(output,ParcelFileDescriptor.MODE_WRITE_ONLY)){
                adapter.writeAsync(destination,stop,new PdfPrintAdapter.WriteResult(){public void failed(CharSequence message){error.set(message.toString());cancelled.countDown();}@Override public void cancelled(){cancelled.countDown();}@Override public void finished(PageRange[] range){successes.incrementAndGet();cancelled.countDown();}});
                assertTrue(cancelled.await(10,TimeUnit.SECONDS));assertEquals(1,successes.get());
            }adapter.onFinish();
        }finally{source.delete();output.delete();}
    }
    private String eval(ActivityScenario<MainActivity> scenario,String js)throws Exception{
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();scenario.onActivity(a->a.getBridge().getWebView().evaluateJavascript(js,value->{result.set(value);latch.countDown();}));assertTrue(latch.await(10,TimeUnit.SECONDS));return result.get();
    }
    private void until(ActivityScenario<MainActivity> scenario,String js)throws Exception{
        long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(50);while(System.nanoTime()<end){if("true".equals(eval(scenario,js)))return;Thread.sleep(100);}fail("Timed out: "+js);
    }
    @Test public void cancelledAndroidChooserGetsOnlyOwnedReadGrantsAndNeverConfirmsDelivery()throws Exception{
        AtomicInteger hits=new AtomicInteger();AtomicBoolean grants=new AtomicBoolean();
        Instrumentation.ActivityMonitor monitor=new Instrumentation.ActivityMonitor(){
            @Override public Instrumentation.ActivityResult onStartActivity(Intent intent){
                if(!Intent.ACTION_CHOOSER.equals(intent.getAction()))return null;hits.incrementAndGet();Intent target=intent.getParcelableExtra(Intent.EXTRA_INTENT);
                grants.set(target!=null&&Intent.ACTION_SEND_MULTIPLE.equals(target.getAction())&&(target.getFlags()&Intent.FLAG_GRANT_READ_URI_PERMISSION)!=0&&target.getClipData()!=null&&target.getClipData().getItemCount()==2);
                if(grants.get())for(int i=0;i<target.getClipData().getItemCount();i++)grants.set(grants.get()&&(context.getPackageName()+".fileprovider").equals(target.getClipData().getItemAt(i).getUri().getAuthority()));
                return new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null);
            }
        };instrumentation.addMonitor(monitor);
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            until(scenario,"Boolean(window.__wfpdf&&window.WFPNativeFiles)");
            eval(scenario,"window.__shareProof=null;(async()=>{const ids=[];for(const text of ['one','two'])ids.push(await WFPNativeFiles.transfer(new Blob([text],{type:'text/plain'}),text+'.txt'));window.__shareProof=await Capacitor.Plugins.WorkflowFiles.share({ids,title:'Synthetic chooser'});})();true");
            until(scenario,"window.__shareProof!==null");assertEquals(1,hits.get());assertTrue(grants.get());assertEquals("true",eval(scenario,"__shareProof.opened===true && __shareProof.deliveryConfirmed===false"));
        }finally{instrumentation.removeMonitor(monitor);}
    }
}
