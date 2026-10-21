package de.familyprojekt.workflowpdf.pro;

import android.app.*;
import android.content.*;
import android.os.Build;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class NativeChromeTest {
    private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    private void main(Runnable task){InstrumentationRegistry.getInstrumentation().runOnMainSync(task);}
    private void grant()throws Exception{
        if(Build.VERSION.SDK_INT>=33)try(android.os.ParcelFileDescriptor fd=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("pm grant "+context.getPackageName()+" android.permission.POST_NOTIFICATIONS")){new FileInputStream(fd.getFileDescriptor()).read(new byte[128]);}
    }
    private static final class Reply {int status;String headers,body;}
    private Reply request(ChromeSession session,String method,String path,JSONObject data,String token,String origin,String host)throws Exception{
        URI uri=URI.create(session.browserUrl());String own="http://"+uri.getAuthority();
        byte[] bytes=data==null?new byte[0]:data.toString().getBytes(StandardCharsets.UTF_8);
        try(Socket socket=new Socket("127.0.0.1",uri.getPort())){
            socket.setSoTimeout(5000);OutputStream out=socket.getOutputStream();
            String headers=method+" "+path+" HTTP/1.1\r\nHost: "+(host==null?uri.getAuthority():host)+"\r\n";
            if(token!=null)headers+="Authorization: Bearer "+token+"\r\n";
            if(origin!=null)headers+="Origin: "+(origin.equals("own")?own:origin)+"\r\n";
            if(data!=null)headers+="Content-Type: application/json\r\nContent-Length: "+bytes.length+"\r\n";
            out.write((headers+"\r\n").getBytes(StandardCharsets.US_ASCII));out.write(bytes);out.flush();
            ByteArrayOutputStream response=new ByteArrayOutputStream();byte[] block=new byte[8192];int count;
            while((count=socket.getInputStream().read(block))!=-1)response.write(block,0,count);
            String all=response.toString("UTF-8");int split=all.indexOf("\r\n\r\n");Reply reply=new Reply();reply.headers=all.substring(0,split);reply.body=all.substring(split+4);reply.status=Integer.parseInt(all.split(" ")[1]);return reply;
        }
    }
    private String key(ChromeSession session){return URI.create(session.browserUrl()).getFragment();}
    private JSONObject result(long id,String... texts)throws Exception{return new JSONObject().put("id",id).put("texte",new JSONArray(Arrays.asList(texts))).put("stat",new JSONObject().put("ohne",0).put("zeichen",20).put("anfragen",id));}
    @Test public void loopbackRejectsForeignOriginHostAndUnauthenticatedTextWithoutChangingWebViewCleartextPolicy()throws Exception{
        try(ChromeSession session=new ChromeSession(context,"de","ru","ar",reason->{})){
            CompletableFuture<JSONObject> pending=session.offer(new JSONArray().put("Vertraulich Мüller"));
            Reply anonymous=request(session,"GET","/batch",null,null,null,null);assertEquals(401,anonymous.status);assertFalse(anonymous.body.contains("Vertraulich"));
            assertEquals(403,request(session,"GET","/batch",null,key(session),"https://foreign.invalid",null).status);
            assertEquals(403,request(session,"GET","/",null,null,null,"foreign.invalid").status);
            assertEquals(403,request(session,"OPTIONS","/batch",null,null,null,null).status);
            Reply asset=request(session,"GET","/",null,null,null,null);assertEquals(200,asset.status);assertFalse(asset.body.contains("Vertraulich"));assertTrue(asset.headers.contains("Cache-Control: no-store"));assertTrue(asset.headers.contains("frame-ancestors 'none'"));
            Reply source=request(session,"GET","/uebersetzung.js",null,null,null,null);
            try(InputStream original=context.getAssets().open("public/assets/uebersetzung.js")){ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] block=new byte[8192];int n;while((n=original.read(block))!=-1)bytes.write(block,0,n);assertEquals(bytes.toString("UTF-8"),source.body);}
            assertFalse(android.security.NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted());
            session.stop("CHROME_CANCELLED");try{pending.get(1,TimeUnit.SECONDS);fail();}catch(ExecutionException expected){assertTrue(expected.getCause().getMessage().contains("CANCELLED"));}
        }
    }
    @Test public void unicodeParagraphsKeepOrderAndInvalidOrStaleResultsNeverCompleteThePage()throws Exception{
        try(ChromeSession session=new ChromeSession(context,"de","ru","ru",reason->{})){
            CompletableFuture<JSONObject> pending=session.offer(new JSONArray().put("Мüller").put("الاسم"));
            JSONObject packet=new JSONObject(request(session,"GET","/batch",null,key(session),null,null).body);long id=packet.getLong("id");assertEquals("ru",packet.getString("uiLang"));
            assertEquals(409,request(session,"POST","/result",result(id+1,"a","b"),key(session),"own",null).status);
            assertEquals(422,request(session,"POST","/result",result(id,"a"),key(session),"own",null).status);assertFalse(pending.isDone());
            assertEquals(403,request(session,"POST","/result",result(id,"a","b"),key(session),null,null).status);
            assertEquals(200,request(session,"POST","/result",result(id,"Имя","الاسم"),key(session),"own",null).status);
            assertEquals("Имя",pending.get(2,TimeUnit.SECONDS).getJSONArray("texte").getString(0));
            assertEquals(409,request(session,"POST","/result",result(id,"x","y"),key(session),"own",null).status);
            CompletableFuture<JSONObject> next=session.offer(new JSONArray().put("Seite 2"));
            assertEquals(409,request(session,"POST","/result",result(id,"old"),key(session),"own",null).status);assertFalse(next.isDone());
            assertEquals(200,request(session,"POST","/cancel",new JSONObject(),key(session),"own",null).status);
            try{next.get(2,TimeUnit.SECONDS);fail();}catch(ExecutionException expected){assertTrue(session.closed());}
        }
    }
    private ChromeRuntime.Item begin()throws Exception{
        AtomicReference<CompletableFuture<String>> ready=new AtomicReference<>();AtomicReference<Exception> failed=new AtomicReference<>();
        main(()->{try{ready.set(ChromeRuntime.begin(context,"de","ru","de"));}catch(Exception error){failed.set(error);}});
        if(failed.get()!=null)throw failed.get();ready.get().get(10,TimeUnit.SECONDS);AtomicReference<ChromeRuntime.Item> value=new AtomicReference<>();main(()->value.set(ChromeRuntime.current));return value.get();
    }
    private void stopped()throws Exception{
        long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(8);AtomicReference<Boolean> value=new AtomicReference<>(false);
        while(System.nanoTime()<end){main(()->value.set(ChromeRuntime.current==null));if(value.get())return;Thread.sleep(50);}fail("Service session still active");
    }
    private Notification notice()throws Exception{
        long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(8);
        while(System.nanoTime()<end){for(android.service.notification.StatusBarNotification notice:context.getSystemService(NotificationManager.class).getActiveNotifications())if(notice.getId()==9301)return notice.getNotification();Thread.sleep(50);}
        throw new AssertionError("Foreground notification not posted");
    }
    @Test public void visibleForegroundNotificationCancelsPendingPageAndNeverRestartsAutomatically()throws Exception{
        grant();try(ActivityScenario<MainActivity> activity=ActivityScenario.launch(MainActivity.class)){
            ChromeRuntime.Item item=begin();CompletableFuture<JSONObject> pending=item.session.offer(new JSONArray().put("Test"));
            Notification notice=notice();assertTrue((notice.flags&Notification.FLAG_FOREGROUND_SERVICE)!=0);assertEquals("Übersetzung läuft",notice.extras.getString(Notification.EXTRA_TITLE));assertFalse(notice.extras.toString().contains("Test"));
            notice.actions[0].actionIntent.send();stopped();assertTrue(pending.isCompletedExceptionally());
            Thread.sleep(300);assertEquals(0,context.getSystemService(NotificationManager.class).getActiveNotifications().length);
        }finally{main(()->{if(ChromeRuntime.current!=null)ChromeRuntime.stop(ChromeRuntime.current.session.id,"TEST_END");});}
    }
    @Test public void staleCancelCannotStopNewSessionAndSystemTimeoutRevokesCurrentTransport()throws Exception{
        grant();try(ActivityScenario<MainActivity> activity=ActivityScenario.launch(MainActivity.class)){
            ChromeRuntime.Item first=begin();Notification old=notice();
            ChromeRuntime.Item second=begin();assertNotEquals(first.session.id,second.session.id);old.actions[0].actionIntent.send();
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();assertFalse(second.session.closed());assertNotNull(notice());
            main(()->second.service.onTimeout(second.startId,1));stopped();assertTrue(second.session.closed());
        }finally{main(()->{if(ChromeRuntime.current!=null)ChromeRuntime.stop(ChromeRuntime.current.session.id,"TEST_END");});}
    }
}
