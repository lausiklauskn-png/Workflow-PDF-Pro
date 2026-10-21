package de.familyprojekt.workflowpdf.pro;

import android.content.Intent;
import android.os.*;
import android.speech.*;
import java.util.*;

/** Debug-only speech service: synthetic words, never opens a microphone. */
public final class FixtureSpeechService extends RecognitionService {
    private Callback current;
    private final Handler main=new Handler(Looper.getMainLooper());
    private Bundle words(String text){Bundle result=new Bundle();result.putStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION,new ArrayList<>(Arrays.asList(text)));return result;}
    @Override protected void onStartListening(Intent intent,Callback listener){
        current=listener;
        try{listener.readyForSpeech(Bundle.EMPTY);listener.beginningOfSpeech();listener.partialResults(words("kopieren"));}
        catch(RemoteException closed){current=null;return;}
        main.postDelayed(()->{if(current!=listener)return;try{listener.partialResults(words("kopieren"));listener.results(words("kopieren"));current=null;}catch(RemoteException ignored){}},400);
    }
    @Override protected void onStopListening(Callback listener){if(current==listener)try{listener.results(words("kopieren"));current=null;}catch(RemoteException ignored){}}
    @Override protected void onCancel(Callback listener){current=null;}
}
