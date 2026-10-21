package de.familyprojekt.workflowpdf.pro;

import android.Manifest;
import android.os.Build;
import androidx.lifecycle.Lifecycle;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.function.BiConsumer;
import org.json.JSONArray;

@CapacitorPlugin(name="WorkflowChrome",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public final class ProChromePlugin extends Plugin {
    private BiConsumer<String,String> events;
    @Override public void load(){
        events=(id,reason)->notifyListeners("stopped",new JSObject().put("id",id).put("reason",reason));
        ChromeRuntime.MAIN.post(()->ChromeRuntime.listener=events);
    }
    @PluginMethod public void begin(PluginCall call){getActivity().runOnUiThread(()->{
        if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED){requestPermissionForAlias("notifications",call,"permissionResult");return;}
        start(call);
    });}
    @PermissionCallback private void permissionResult(PluginCall call){getActivity().runOnUiThread(()->{
        if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED){call.reject("CHROME_NOTIFICATION_REQUIRED");return;}
        if(getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)){start(call);return;}
        getActivity().getLifecycle().addObserver(new androidx.lifecycle.LifecycleEventObserver(){
            @Override public void onStateChanged(androidx.lifecycle.LifecycleOwner owner,Lifecycle.Event event){
                if(event==Lifecycle.Event.ON_RESUME){owner.getLifecycle().removeObserver(this);start(call);}
                else if(event==Lifecycle.Event.ON_DESTROY){owner.getLifecycle().removeObserver(this);call.reject("CHROME_START_IN_APP");}
            }
        });
    });}
    private void start(PluginCall call){
        try{
            if(!getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED))throw new java.io.IOException("CHROME_START_IN_APP");
            ChromeRuntime.begin(getContext(),call.getString("von"),call.getString("nach"),call.getString("language","de"))
                .whenComplete((id,error)->{if(error!=null)call.reject("CHROME_FOREGROUND_UNAVAILABLE");else call.resolve(new JSObject().put("id",id));});
        }catch(Exception error){call.reject(error.getMessage());}
    }
    @PluginMethod public void translate(PluginCall call){getActivity().runOnUiThread(()->{
        ChromeRuntime.Item item=null;
        try{
            item=ChromeRuntime.require(call.getString("id"));JSONArray texts=call.getArray("texte");
            if(texts==null)throw new java.io.IOException("CHROME_INVALID_TEXT");
            item.session.offer(texts).whenComplete((result,error)->{
                if(error!=null)call.reject(error.getMessage());else try{call.resolve(new JSObject(result.toString()));}catch(Exception bad){call.reject("CHROME_RESULT_INVALID");}
            });
            ChromeRuntime.open(getActivity(),item);
        }catch(Exception error){if(item!=null)ChromeRuntime.stop(item.session.id,error.getMessage());call.reject(error.getMessage());}
    });}
    @PluginMethod public void close(PluginCall call){ChromeRuntime.MAIN.post(()->{ChromeRuntime.stop(call.getString("id"),"CHROME_CANCELLED");call.resolve();});}
    @Override protected void handleOnDestroy(){ChromeRuntime.MAIN.post(()->{if(ChromeRuntime.listener==events)ChromeRuntime.listener=null;});}
}
