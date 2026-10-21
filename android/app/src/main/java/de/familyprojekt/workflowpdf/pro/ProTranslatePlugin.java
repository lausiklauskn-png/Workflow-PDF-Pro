package de.familyprojekt.workflowpdf.pro;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.common.model.*;
import com.google.mlkit.nl.translate.*;
import java.util.*;

/** Model downloads use ML Kit; document strings are translated on the device.
 * Implements the host capability beneath the unchanged original browser path. */
@CapacitorPlugin(name="WorkflowTranslate")
public final class ProTranslatePlugin extends Plugin {
    private static boolean initialized;
    private final Map<String,Translator> clients=new HashMap<>();
    private boolean destroyed;
    private android.content.SharedPreferences choices(){return getContext().getSharedPreferences("workflow-local-model-choice",0);}
    private void initialize(){if(!initialized){com.google.mlkit.common.MlKit.initialize(getContext());initialized=true;}}
    private boolean valid(PluginCall call){
        String from=call.getString("from"),to=call.getString("to");List<String> supported=Arrays.asList("de","en","ru");
        return supported.contains(from)&&supported.contains(to)&&!Objects.equals(from,to);
    }
    @PluginMethod public void availability(PluginCall call){getActivity().runOnUiThread(()->{
        if(destroyed){call.reject("LOCAL_TRANSLATOR_CLOSED");return;}
        if(!valid(call)){call.resolve(new JSObject().put("status","unavailable"));return;}
        if(!choices().getBoolean("enabled",false)){call.resolve(new JSObject().put("status","downloadable"));return;}
        initialize();
        RemoteModelManager.getInstance().getDownloadedModels(TranslateRemoteModel.class).addOnSuccessListener(models->{
            Set<String> downloaded=new HashSet<>();for(TranslateRemoteModel model:models)downloaded.add(model.getLanguage());downloaded.add("en");
            call.resolve(new JSObject().put("status",downloaded.contains(call.getString("from"))&&downloaded.contains(call.getString("to"))?"available":"downloadable"));
        }).addOnFailureListener(error->call.reject("LOCAL_MODELS_UNAVAILABLE"));
    });}
    @PluginMethod public void activate(PluginCall call){getActivity().runOnUiThread(()->{
        if(destroyed){call.reject("LOCAL_TRANSLATOR_CLOSED");return;}
        if(!choices().edit().putBoolean("enabled",true).commit()){call.reject("LOCAL_CONSENT_FAILED");return;}
        initialize();call.resolve();
    });}
    @PluginMethod public void create(PluginCall call){getActivity().runOnUiThread(()->{
        if(destroyed){call.reject("LOCAL_TRANSLATOR_CLOSED");return;}
        if(!choices().getBoolean("enabled",false)){call.reject("LOCAL_CONSENT_REQUIRED");return;}
        initialize();
        if(!valid(call)){call.reject("LOCAL_LANGUAGE_PAIR_UNAVAILABLE");return;}
        Translator client=Translation.getClient(new TranslatorOptions.Builder().setSourceLanguage(call.getString("from")).setTargetLanguage(call.getString("to")).build());
        String id=UUID.randomUUID().toString();clients.put(id,client);
        client.downloadModelIfNeeded(new DownloadConditions.Builder().build()).addOnSuccessListener(unused->{
            if(clients.get(id)!=client){call.reject("LOCAL_TRANSLATOR_CLOSED");return;}call.resolve(new JSObject().put("id",id));
        }).addOnFailureListener(error->{clients.remove(id);client.close();call.reject("LOCAL_MODEL_DOWNLOAD_FAILED");});
    });}
    @PluginMethod public void translate(PluginCall call){getActivity().runOnUiThread(()->{
        Translator client=clients.get(call.getString("id"));String text=call.getString("text");
        if(client==null||text==null){call.reject("LOCAL_TRANSLATOR_CLOSED");return;}
        client.translate(text).addOnSuccessListener(result->{
            if(clients.get(call.getString("id"))!=client){call.reject("LOCAL_TRANSLATOR_CLOSED");return;}
            call.resolve(new JSObject().put("text",result));
        }).addOnFailureListener(error->call.reject("LOCAL_TRANSLATION_FAILED"));
    });}
    @PluginMethod public void destroy(PluginCall call){getActivity().runOnUiThread(()->{Translator client=clients.remove(call.getString("id"));if(client!=null)client.close();call.resolve();});}
    @Override protected void handleOnDestroy(){getActivity().runOnUiThread(()->{destroyed=true;for(Translator client:clients.values())client.close();clients.clear();});}
}
