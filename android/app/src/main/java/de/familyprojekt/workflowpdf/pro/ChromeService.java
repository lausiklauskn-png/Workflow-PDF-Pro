package de.familyprojekt.workflowpdf.pro;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

public final class ChromeService extends Service {
    private String sessionId;
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent==null){stopSelfResult(startId);return START_NOT_STICKY;}
        String id=intent.getStringExtra(ChromeRuntime.ID);
        if(ChromeRuntime.CANCEL.equals(intent.getAction())){
            if(ChromeRuntime.current!=null&&ChromeRuntime.current.service==this)ChromeRuntime.current.startId=startId;
            ChromeRuntime.stop(id,"CHROME_CANCELLED");
            if(ChromeRuntime.current==null)stopSelfResult(startId);
        }else{sessionId=id;ChromeRuntime.started(this,id,startId);}
        return START_NOT_STICKY;
    }
    @Override public void onTimeout(int startId,int fgsType){ChromeRuntime.stop(sessionId,"CHROME_TIME_LIMIT");stopSelfResult(startId);}
    @Override public void onTaskRemoved(Intent intent){ChromeRuntime.stop(sessionId,"CHROME_APP_CLOSED");}
    @Override public void onDestroy(){ChromeRuntime.stop(sessionId,"CHROME_SERVICE_STOPPED");super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
