package de.familyprojekt.workflowpdf.pro;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.*;
import androidx.lifecycle.Lifecycle;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.util.*;

/** User-initiated Android recognition only. No audio file or background microphone. */
@CapacitorPlugin(name="WorkflowSpeech",permissions={@Permission(alias="microphone",strings={Manifest.permission.RECORD_AUDIO})})
public final class ProSpeechPlugin extends Plugin {
    private SpeechRecognizer recognizer;
    private String active;
    private final Set<String> cancelled=new LinkedHashSet<>();
    private void event(String id,String kind,String text,String error,boolean finalResult){
        JSObject data=new JSObject().put("id",id).put("kind",kind);
        if(text!=null)data.put("text",text).put("final",finalResult);if(error!=null)data.put("error",error);
        notifyListeners("speech",data);
    }
    private void finish(String id){
        if(!Objects.equals(active,id))return;
        SpeechRecognizer old=recognizer;recognizer=null;active=null;
        if(old!=null){old.cancel();old.destroy();}event(id,"end",null,null,false);
    }
    @PluginMethod public void available(PluginCall call){call.resolve(new JSObject().put("available",SpeechRecognizer.isRecognitionAvailable(getContext())));}
    @PluginMethod public void start(PluginCall call){getActivity().runOnUiThread(()->{
        String id=call.getString("id");
        try{UUID.fromString(id);}catch(Exception bad){call.reject("SPEECH_INVALID_SESSION");return;}
        if(getPermissionState("microphone")!=PermissionState.GRANTED){requestPermissionForAlias("microphone",call,"permissionResult");return;}startReady(call);
    });}
    @PermissionCallback private void permissionResult(PluginCall call){getActivity().runOnUiThread(()->{
        if(getPermissionState("microphone")!=PermissionState.GRANTED){call.reject("not-allowed");return;}
        if(getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)){startReady(call);return;}
        getActivity().getLifecycle().addObserver(new androidx.lifecycle.LifecycleEventObserver(){
            @Override public void onStateChanged(androidx.lifecycle.LifecycleOwner owner,Lifecycle.Event event){
                if(event==Lifecycle.Event.ON_RESUME){owner.getLifecycle().removeObserver(this);startReady(call);}
                else if(event==Lifecycle.Event.ON_DESTROY){owner.getLifecycle().removeObserver(this);call.reject("aborted");}
            }
        });
    });}
    private void startReady(PluginCall call){
        String id=call.getString("id");
        if(cancelled.remove(id)){call.reject("aborted");return;}
        if(!getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)){call.reject("aborted");return;}
        if(active!=null){call.reject("audio-capture");return;}
        if(!SpeechRecognizer.isRecognitionAvailable(getContext())){call.reject("service-not-allowed");return;}
        try{
            active=id;recognizer=SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(new RecognitionListener(){
                private boolean current(){return Objects.equals(active,id);}
                private void simple(String kind){if(current())event(id,kind,null,null,false);}
                @Override public void onReadyForSpeech(Bundle params){simple("start");}
                @Override public void onBeginningOfSpeech(){simple("speechstart");}
                @Override public void onRmsChanged(float rmsDb){}
                @Override public void onBufferReceived(byte[] buffer){}
                @Override public void onEndOfSpeech(){simple("speechend");}
                private void text(Bundle results,boolean end){
                    if(!current())return;ArrayList<String> values=results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if(values!=null&&!values.isEmpty())event(id,"result",values.get(0),null,end);
                    if(end)finish(id);
                }
                @Override public void onPartialResults(Bundle results){text(results,false);}
                @Override public void onResults(Bundle results){text(results,true);}
                @Override public void onError(int code){if(current()){event(id,"error",null,error(code),false);finish(id);}}
                @Override public void onEvent(int type,Bundle params){}
            });
            Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE,call.getString("language","de-DE")).putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true).putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);
            recognizer.startListening(intent);call.resolve(new JSObject().put("started",true));
        }catch(Exception failed){finish(id);call.reject("audio-capture");}
    }
    static String error(int code){
        switch(code){
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:return "not-allowed";
            case SpeechRecognizer.ERROR_NO_MATCH:case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:return "no-speech";
            case SpeechRecognizer.ERROR_NETWORK:case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:case SpeechRecognizer.ERROR_SERVER:return "network";
            case SpeechRecognizer.ERROR_AUDIO:case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:return "audio-capture";
            default:return "service-not-allowed";
        }
    }
    @PluginMethod public void stop(PluginCall call){getActivity().runOnUiThread(()->{
        String id=call.getString("id");
        if(Objects.equals(id,active)&&recognizer!=null){
            if(Boolean.TRUE.equals(call.getBoolean("abort",false)))finish(id);
            else{recognizer.stopListening();getActivity().getWindow().getDecorView().postDelayed(()->finish(id),2500);}
        }else if(id!=null){cancelled.add(id);if(cancelled.size()>32)cancelled.remove(cancelled.iterator().next());}
        call.resolve();
    });}
    @Override protected void handleOnPause(){getActivity().runOnUiThread(()->{if(active!=null)finish(active);});}
    @Override protected void handleOnDestroy(){getActivity().runOnUiThread(()->{if(active!=null)finish(active);cancelled.clear();});}
}
