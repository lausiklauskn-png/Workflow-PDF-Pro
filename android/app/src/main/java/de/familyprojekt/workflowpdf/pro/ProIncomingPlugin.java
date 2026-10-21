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
    private final ArrayDeque<Batch> queue=new ArrayDeque<>();
    private static final String DELIVERY="de.familyprojekt.workflowpdf.pro.INCOMING_DELIVERY";
    private static final class Batch {
        final String id;final Intent intent;IncomingFiles files;
        Batch(Intent intent){this.intent=new Intent(intent);id=intent.getStringExtra(DELIVERY);}
    }
    // BridgeActivity invokes onNewIntent for the launch intent after loading
    // plugins. Reading it in load as well would enqueue every cold start twice.
    @Override protected void handleOnNewIntent(Intent intent){accept(intent);}
    private void accept(Intent intent){
        if(intent==null||!Arrays.asList(Intent.ACTION_SEND,Intent.ACTION_SEND_MULTIPLE,Intent.ACTION_VIEW).contains(intent.getAction()))return;
        Intent delivered;
        try{delivered=IncomingFiles.sanitize(intent);delivered.putExtra(DELIVERY,UUID.randomUUID().toString());}
        catch(Exception malformed){
            // Malformed sender parcelables must produce a dismissible error,
            // never crash the exported Activity while its plugins are loading.
            delivered=new Intent(intent.getAction()).putExtra(DELIVERY,UUID.randomUUID().toString());
        }
        getActivity().setIntent(delivered);Batch batch=new Batch(delivered);
        worker.execute(()->{queue.add(batch);notifyListeners("available",new JSObject());});
    }
    @PluginMethod public void pending(PluginCall call){worker.execute(()->{
        try{
            Batch batch=queue.peek();if(batch==null){call.resolve(new JSObject().put("empty",true));return;}
            if(batch.files==null)batch.files=new IncomingFiles(getContext().getContentResolver(),batch.intent);
            batch.files.rewind();
            call.resolve(new JSObject().put("id",batch.id).put("files",batch.files.describe()));
        }catch(Exception error){call.resolve(new JSObject().put("id",queue.peek().id).put("problem",true));}
    });}
    @PluginMethod public void read(PluginCall call){worker.execute(()->{
        try{
            Batch batch=queue.peek();if(batch==null||!batch.id.equals(call.getString("batch"))||batch.files==null)throw new java.io.IOException();
            byte[] bytes=batch.files.read(call.getString("id"),ProFilesPlugin.integer(call.getData().opt("offset")));
            call.resolve(new JSObject().put("data",Base64.encodeToString(bytes,Base64.NO_WRAP)).put("done",batch.files.done()));
        }catch(Exception error){call.reject("INCOMING_READ_FAILED");}
    });}
    @PluginMethod public void acknowledge(PluginCall call){worker.execute(()->{
        Batch batch=queue.peek();
        if(batch==null||!batch.id.equals(call.getString("id"))){call.reject("INCOMING_INVALID_TRANSFER");return;}
        queue.remove();if(batch.files!=null)batch.files.close();
        // Avoid replaying the cold-start intent after an Activity recreation.
        getActivity().runOnUiThread(()->{
            if(getActivity().getIntent()!=null&&batch.id.equals(getActivity().getIntent().getStringExtra(DELIVERY)))getActivity().setIntent(new Intent(getContext(),MainActivity.class).setAction(Intent.ACTION_MAIN));
            call.resolve();
        });
    });}
    @Override protected void handleOnDestroy(){worker.execute(()->{for(Batch batch:queue)if(batch.files!=null)batch.files.close();queue.clear();});worker.shutdown();}
}
