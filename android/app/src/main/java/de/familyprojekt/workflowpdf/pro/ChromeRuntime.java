package de.familyprojekt.workflowpdf.pro;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.*;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.io.IOException;
import java.util.concurrent.CompletableFuture;
import java.util.function.BiConsumer;

/** All ownership changes run on the main looper; a stale notification cannot
 * cancel a newer session. Payloads live only in ChromeSession memory. */
final class ChromeRuntime {
    static final Handler MAIN=new Handler(Looper.getMainLooper());
    static final String CHANNEL="workflow-translation",CANCEL="workflow.chrome.CANCEL",ID="session";
    static Item current;
    static BiConsumer<String,String> listener;
    static final class Item {
        final ChromeSession session;
        final CompletableFuture<String> ready=new CompletableFuture<>();
        ChromeService service;int startId;boolean opened,ended;
        Item(ChromeSession session){this.session=session;}
    }
    static void channel(Context context){
        if(Build.VERSION.SDK_INT<26)return;
        NotificationChannel channel=new NotificationChannel(CHANNEL,"Workflow PDF Pro · Chrome",NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Lokale Übersetzungsverbindung / Local translation connection");
        channel.setShowBadge(false);channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
    static boolean visible(Context context){
        channel(context);
        if(Build.VERSION.SDK_INT<26)return NotificationManagerCompat.from(context).areNotificationsEnabled();
        NotificationChannel channel=context.getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL);
        return NotificationManagerCompat.from(context).areNotificationsEnabled()&&channel!=null&&channel.getImportance()!=NotificationManager.IMPORTANCE_NONE;
    }
    static CompletableFuture<String> begin(Context context,String from,String to,String language)throws Exception{
        if(!visible(context))throw new IOException("CHROME_NOTIFICATION_REQUIRED");
        if(current!=null)stop(current.session.id,"CHROME_REPLACED");
        ChromeSession session=new ChromeSession(context,from,to,language,(reason)->{});
        Item item=new Item(session);current=item;
        // Callback retains the exact session, so a delayed old close is harmless.
        session.onStopped=(reason)->MAIN.post(()->ended(item,reason));
        try{ContextCompat.startForegroundService(context,new Intent(context,ChromeService.class).putExtra(ID,session.id));}
        catch(RuntimeException error){session.stop("CHROME_FOREGROUND_UNAVAILABLE");ended(item,"CHROME_FOREGROUND_UNAVAILABLE");throw error;}
        return item.ready;
    }
    static void ended(Item item,String reason){
        if(item.ended)return;item.ended=true;
        item.ready.completeExceptionally(new IOException(reason));
        if(current==item){current=null;if(listener!=null)listener.accept(item.session.id,reason);}
        if(item.service!=null){item.service.stopForeground(Service.STOP_FOREGROUND_REMOVE);item.service.stopSelfResult(item.startId);}
    }
    static Item require(String id)throws IOException{
        if(current==null||!current.session.id.equals(id)||current.session.closed())throw new IOException("CHROME_CANCELLED");return current;
    }
    static void stop(String id,String reason){
        if(current!=null&&current.session.id.equals(id)){Item item=current;item.session.stop(reason);ended(item,reason);}
    }
    static void started(ChromeService service,String id,int startId){
        Item item=current;
        if(item==null||!item.session.id.equals(id)||item.session.closed()){service.stopSelfResult(startId);return;}
        try{
            if(!visible(service))throw new IOException("CHROME_NOTIFICATION_REQUIRED");
            service.startForeground(9301,notification(service,item));item.service=service;item.startId=startId;item.ready.complete(id);
        }catch(Exception error){stop(id,"CHROME_FOREGROUND_UNAVAILABLE");service.stopSelfResult(startId);}
    }
    static Notification notification(Context context,Item item){
        String language=item.session.language,title="Übersetzung läuft",text="Lokale Verbindung zu Chrome aktiv. Zum Abbrechen tippen.",cancel="Abbrechen";
        if("en".equals(language)){title="Translation in progress";text="Local connection to Chrome active. Tap to cancel.";cancel="Cancel";}
        if("ru".equals(language)){title="Идёт перевод";text="Локальное соединение с Chrome активно.";cancel="Отменить";}
        if("ar".equals(language)){title="الترجمة قيد التشغيل";text="الاتصال المحلي بمتصفح Chrome نشط.";cancel="إلغاء";}
        Intent cancelIntent=new Intent(context,ChromeService.class).setAction(CANCEL).setData(Uri.parse("workflow-chrome:"+item.session.id)).putExtra(ID,item.session.id);
        PendingIntent cancelPending=PendingIntent.getService(context,0,cancelIntent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Intent open=new Intent(context,MainActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent app=PendingIntent.getActivity(context,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(context,CHANNEL).setSmallIcon(de.familyprojekt.workflowpdf.pro.R.drawable.ic_translation)
            .setContentTitle(title).setContentText(text).setOngoing(true).setOnlyAlertOnce(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setContentIntent(app).addAction(0,cancel,cancelPending).build();
    }
    static void open(Activity activity,Item item)throws Exception{
        if(item.opened)return;
        Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse(item.session.browserUrl())).addCategory(Intent.CATEGORY_BROWSABLE);
        String[] packages={"com.android.chrome","com.chrome.beta","com.chrome.dev","com.chrome.canary"};
        for(String name:packages){intent.setPackage(name);if(intent.resolveActivity(activity.getPackageManager())!=null){activity.startActivity(intent);item.opened=true;return;}}
        throw new IOException("CHROME_NOT_INSTALLED");
    }
}
