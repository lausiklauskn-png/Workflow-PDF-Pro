package de.familyprojekt.workflowpdf.pro;

import android.app.Activity;
import android.content.Intent;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name="WorkflowImport")
public final class ProImportPlugin extends Plugin {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicBoolean choosing=new AtomicBoolean();
    private FolderImport folder;
    @PluginMethod public void chooseFolder(PluginCall call){
        if(!choosing.compareAndSet(false,true)){call.reject("IMPORT_BUSY");return;}
        getActivity().runOnUiThread(()->{
            try{startActivityForResult(call,new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),"chosen");}
            catch(Exception error){choosing.set(false);call.reject("IMPORT_PICKER_UNAVAILABLE");}
        });
    }
    @ActivityCallback private void chosen(PluginCall call,ActivityResult result){
        if(call==null){choosing.set(false);return;}
        if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null||result.getData().getData()==null){choosing.set(false);call.resolve(new JSObject().put("cancelled",true));return;}
        worker.execute(()->{
            try{
                if(folder!=null)folder.close();folder=new FolderImport(getContext().getContentResolver());
                call.resolve(new JSObject().put("files",folder.inspect(result.getData().getData())));
            }catch(Exception error){if(folder!=null)folder.close();folder=null;choosing.set(false);call.reject("IMPORT_FOLDER_UNAVAILABLE");}
        });
    }
    @PluginMethod public void read(PluginCall call){worker.execute(()->{
        try{
            if(folder==null)throw new java.io.IOException();String id=call.getString("id");
            byte[] data=folder.read(id,ProFilesPlugin.integer(call.getData().opt("offset")));
            call.resolve(new JSObject().put("data",Base64.encodeToString(data,Base64.NO_WRAP)).put("done",folder.done(id)));
        }catch(Exception error){call.reject("IMPORT_READ_FAILED");}
    });}
    @PluginMethod public void release(PluginCall call){worker.execute(()->{if(folder!=null)folder.close();folder=null;choosing.set(false);call.resolve();});}
    @Override protected void handleOnDestroy(){worker.execute(()->{if(folder!=null)folder.close();});worker.shutdown();}
}
