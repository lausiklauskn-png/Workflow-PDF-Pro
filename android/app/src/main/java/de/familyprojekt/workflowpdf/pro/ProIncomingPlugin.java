package de.familyprojekt.workflowpdf.pro;

import android.content.Intent;
import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.*;
import java.util.concurrent.*;

@CapacitorPlugin(name="WorkflowIncoming")
public final class ProIncomingPlugin extends Plugin {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private IncomingInbox inbox;
    private final ArrayDeque<Intent> unstaged=new ArrayDeque<>();
    private static final String DELIVERY="de.familyprojekt.workflowpdf.pro.INCOMING_DELIVERY";
    static final String ACKNOWLEDGED="de.familyprojekt.workflowpdf.pro.INCOMING_ACKNOWLEDGED";
    private IncomingInbox inbox()throws Exception{
        if(inbox==null)inbox=new IncomingInbox(getContext());return inbox;
    }
    private void flush()throws Exception{while(!unstaged.isEmpty()){Intent receipt=unstaged.peek();String id=receipt.getStringExtra(DELIVERY);inbox().add(id,receipt);try{inbox().stageReceipt(id);}catch(Exception unreadable){/* Durable receipt remains dismissible/retryable. */}unstaged.remove();}}
    @Override public void load(){worker.execute(()->{try{inbox();notifyListeners("available",new JSObject());}catch(Exception unavailable){/* pending reports the storage error. */}});}
    // BridgeActivity invokes onNewIntent for the launch intent after loading
    // plugins. Reading it in load as well would enqueue every cold start twice.
    @Override protected void handleOnNewIntent(Intent intent){accept(((MainActivity)getActivity()).incomingForLaunch(intent));}
    private void accept(Intent intent){
        if(intent==null||!Arrays.asList(Intent.ACTION_SEND,Intent.ACTION_SEND_MULTIPLE,Intent.ACTION_VIEW).contains(intent.getAction()))return;
        boolean restoring=intent==((MainActivity)getActivity()).currentIncoming();
        if(restoring&&intent.getBooleanExtra(ACKNOWLEDGED,false))return;
        String id=restoring?intent.getStringExtra(DELIVERY):UUID.randomUUID().toString();
        if(id==null)id=UUID.randomUUID().toString();
        Intent delivered;
        try{delivered=IncomingFiles.sanitize(intent);delivered.putExtra(DELIVERY,id);}
        catch(Exception malformed){
            // Malformed sender parcelables must produce a dismissible error,
            // never crash the exported Activity while its plugins are loading.
            delivered=new Intent(intent.getAction()).putExtra(DELIVERY,id);
        }
        ((MainActivity)getActivity()).rememberIncoming(delivered);
        Intent receipt=delivered;
        worker.execute(()->{unstaged.add(receipt);try{flush();}catch(Exception error){/* pending retries and reports an explicit failure. */}notifyListeners("available",new JSObject());});
    }
    @PluginMethod public void pending(PluginCall call){worker.execute(()->{
        try{
            flush();call.resolve(new JSObject(inbox().pending().toString()));
        }catch(Exception error){call.reject("INCOMING_STORAGE_UNAVAILABLE");}
    });}
    @PluginMethod public void read(PluginCall call){worker.execute(()->{
        try{
            byte[] bytes=inbox().read(call.getString("batch"),call.getString("id"),ProFilesPlugin.integer(call.getData().opt("offset")));
            call.resolve(new JSObject().put("data",Base64.encodeToString(bytes,Base64.NO_WRAP)).put("done",inbox().done()));
        }catch(Exception error){call.reject("INCOMING_READ_FAILED");}
    });}
    @PluginMethod public void acknowledge(PluginCall call){worker.execute(()->{
        String id=call.getString("id");
        try{inbox().acknowledge(id,Boolean.TRUE.equals(call.getBoolean("discard",false)));}
        catch(Exception error){call.reject("INCOMING_INVALID_TRANSFER");return;}
        // Avoid replaying the cold-start intent after an Activity recreation.
        getActivity().runOnUiThread(()->{
            Intent current=((MainActivity)getActivity()).currentIncoming();
            if(current!=null&&id.equals(current.getStringExtra(DELIVERY)))current.putExtra(ACKNOWLEDGED,true);
            call.resolve();
        });
    });}
    @PluginMethod public void history(PluginCall call){worker.execute(()->{try{call.resolve(new JSObject().put("receipts",inbox().history()));}catch(Exception error){call.reject("INCOMING_STORAGE_UNAVAILABLE");}});}
    @PluginMethod public void restore(PluginCall call){worker.execute(()->{try{inbox().restore(call.getString("id"));notifyListeners("available",new JSObject());call.resolve();}catch(Exception error){call.reject("INCOMING_OPERATION_FAILED");}});}
    @PluginMethod public void discardArchived(PluginCall call){worker.execute(()->{try{inbox().discardArchived(call.getString("id"));call.resolve();}catch(Exception error){call.reject("INCOMING_OPERATION_FAILED");}});}
    @Override protected void handleOnDestroy(){worker.execute(()->{if(inbox!=null)inbox.close();});worker.shutdown();}
}
