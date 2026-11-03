package de.familyprojekt.workflowpdf.pro;

import android.app.ActivityManager;
import android.content.Context;
import android.graphics.Paint;
import android.graphics.pdf.PdfDocument;
import android.util.Base64;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.*;
import com.getcapacitor.*;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.*;
import org.json.JSONArray;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real OS chooser and the published, separately installed Family APK. No recipient fixture. */
@RunWith(AndroidJUnit4.class)
public final class NativeAppSwitchTest {
    private static final String FAMILY="de.familyprojekt.familienakte";
    private final android.app.Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
    private final UiDevice device=UiDevice.getInstance(instrumentation);
    private static final class Reply extends PluginCall {
        final CountDownLatch done=new CountDownLatch(1); JSObject value; String error;
        Reply(String method,JSObject data){super(null,"WorkflowFiles","task-test-"+System.nanoTime(),method,data);}
        @Override public void resolve(JSObject data){value=data;done.countDown();}
        @Override public void resolve(){resolve(new JSObject());}
        @Override public void reject(String message,String code,Exception cause,JSObject data){error=message;done.countDown();}
        JSObject await()throws Exception{assertTrue("Native reply: "+getMethodName(),done.await(10,TimeUnit.SECONDS));assertNull(error);assertNotNull(value);return value;}
    }
    private String eval(MainActivity activity,String js)throws Exception{
        CountDownLatch done=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();
        instrumentation.runOnMainSync(()->activity.getBridge().getWebView().evaluateJavascript(js,r->{value.set(r);done.countDown();}));
        assertTrue(done.await(10,TimeUnit.SECONDS));return value.get();
    }
    private int familyTask()throws Exception{
        String dump=device.executeShellCommand("dumpsys activity activities");
        Matcher match=Pattern.compile("ActivityRecord\\{[^\\n}]* "+FAMILY+"/[^\\n}]* t(\\d+)").matcher(dump);
        assertTrue("Family activity missing from real Android tasks",match.find());return Integer.parseInt(match.group(1));
    }
    @Test public void coldAndWarmFamilyShareUseSeparateReusableTaskAndPreserveSender()throws Exception{
        device.executeShellCommand("am force-stop "+FAMILY);
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            AtomicReference<MainActivity> reference=new AtomicReference<>();scenario.onActivity(reference::set);
            MainActivity activity=reference.get();int senderTask=activity.getTaskId();
            long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(90);
            while(!"true".equals(eval(activity,"Boolean(window.__wfpdf&&window.WFPNativeFiles)"))){assertTrue(System.nanoTime()<end);Thread.sleep(150);}
            assertEquals("true",eval(activity,"window.__appSwitchMarker={selection:'KUNDE-ERFUNDEN-013',page:1};true"));
            String senderUrl=eval(activity,"location.href");
            ProFilesPlugin files=(ProFilesPlugin)activity.getBridge().getPlugin("WorkflowFiles").getInstance();
            byte[] pdf;
            try(ByteArrayOutputStream output=new ByteArrayOutputStream()){
                PdfDocument doc=new PdfDocument();PdfDocument.Page p=doc.startPage(new PdfDocument.PageInfo.Builder(300,400,1).create());
                Paint paint=new Paint();paint.setTextSize(14);p.getCanvas().drawText("ERFUNDEN: KUNDE-013 / 12,34 EUR",12,50,paint);doc.finishPage(p);doc.writeTo(output);doc.close();pdf=output.toByteArray();
            }
            Reply begin=new Reply("begin",new JSObject().put("name","Appwechsel-Probe.pdf").put("mime","application/pdf"));files.begin(begin);String id=begin.await().getString("id");
            Reply append=new Reply("append",new JSObject().put("id",id).put("offset",0).put("data",Base64.encodeToString(pdf,Base64.NO_WRAP)));files.append(append);append.await();
            Reply finish=new Reply("finish",new JSObject().put("id",id).put("size",pdf.length));files.finish(finish);finish.await();
            int previousFamilyTask=-1;boolean everyLaunchReplied=true;
            for(int attempt=0;attempt<2;attempt++){
                Reply share=new Reply("share",new JSObject().put("ids",new JSONArray().put(id)).put("title","Appwechsel-Probe"));files.share(share);
                UiObject2 target=device.wait(Until.findObject(By.textContains("Familienakte")),20000);
                assertNotNull("Real chooser must offer the installed Family APK",target);
                boolean repliedBeforeSelection=share.done.await(4,TimeUnit.SECONDS);everyLaunchReplied &= repliedBeforeSelection;
                target.click();assertTrue("Recipient must be foreground",device.wait(Until.hasObject(By.pkg(FAMILY)),20000));
                int recipientTask=familyTask();
                android.util.Log.i("WFP-Appwechsel","attempt="+attempt+" senderTask="+senderTask+" recipientTask="+recipientTask+" launchReply="+repliedBeforeSelection);
                assertNotEquals("Recipient must have its own task",senderTask,recipientTask);
                if(attempt>0)assertEquals("Warm share reuses recipient task",previousFamilyTask,recipientTask);
                previousFamilyTask=recipientTask;
                // Taskbar selection, not a new launcher intent: the latter can hide a broken stack.
                ActivityManager manager=(ActivityManager)activity.getSystemService(Context.ACTIVITY_SERVICE);
                ActivityManager.AppTask sender=manager.getAppTasks().stream().filter(t->t.getTaskInfo().taskId==senderTask).findFirst().orElseThrow();
                instrumentation.runOnMainSync(sender::moveToFront);
                assertTrue("Original sender task must remain usable",device.wait(Until.hasObject(By.pkg(activity.getPackageName())),15000));
                assertEquals(senderUrl,eval(activity,"location.href"));
                assertEquals("true",eval(activity,"__appSwitchMarker.selection==='KUNDE-ERFUNDEN-013'&&__appSwitchMarker.page===1"));
                assertFalse(activity.isFinishing());assertFalse(activity.isDestroyed());
                JSObject reply=share.await();assertTrue(reply.getBoolean("opened"));assertFalse(reply.getBoolean("deliveryConfirmed"));
            }
            assertTrue("Share launch must release sender before choosing a recipient",everyLaunchReplied);
        }finally{device.executeShellCommand("am force-stop "+FAMILY);}
    }
}
