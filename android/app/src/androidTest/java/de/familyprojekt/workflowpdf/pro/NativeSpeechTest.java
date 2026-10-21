package de.familyprojekt.workflowpdf.pro;

import android.content.*;
import android.os.*;
import android.provider.Settings;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class NativeSpeechTest {
    private String eval(ActivityScenario<MainActivity> scenario,String script)throws Exception{
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();scenario.onActivity(a->a.getBridge().getWebView().evaluateJavascript(script,value->{result.set(value);latch.countDown();}));assertTrue(latch.await(10,TimeUnit.SECONDS));return result.get();
    }
    private void until(ActivityScenario<MainActivity> scenario,String script)throws Exception{
        long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(45);while(System.nanoTime()<end){if("true".equals(eval(scenario,script)))return;Thread.sleep(100);}fail("Timed out: "+script+" "+eval(scenario,"JSON.stringify(window.__speechTest)"));
    }
    private void provider(Context context,String component){
        android.app.UiAutomation automation=InstrumentationRegistry.getInstrumentation().getUiAutomation();automation.adoptShellPermissionIdentity("android.permission.WRITE_SECURE_SETTINGS");
        try{assertTrue(Settings.Secure.putString(context.getContentResolver(),"voice_recognition_service",component));}finally{automation.dropShellPermissionIdentity();}
    }
    @Test public void realRecognitionBinderFeedsOriginalBarAndEndsWithoutDuplicatingFinalWords()throws Exception{
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();String previous=Settings.Secure.getString(context.getContentResolver(),"voice_recognition_service");
        try{
            provider(context,new ComponentName(context,FixtureSpeechService.class).flattenToString());
            try(ParcelFileDescriptor fd=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("pm grant "+context.getPackageName()+" android.permission.RECORD_AUDIO")){new FileInputStream(fd.getFileDescriptor()).read(new byte[128]);}
            try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
                until(scenario,"Boolean(window.__wfpdf&&window.WFSprechen&&window.SpeechRecognition)");
                eval(scenario,"window.__speechTest={texts:[],errors:[]};const box=document.createElement('div'),field=document.createElement('textarea'),button=document.createElement('button');box.append(field,button);document.body.append(box);window.__voiceTest=WFSprechen.anhaengen({knopf:button,nach:box,feld:field,sprache:()=> 'de-DE',text:(text,final)=>__speechTest.texts.push({text,final}),meldung:error=>__speechTest.errors.push(error)});button.click();true");
                until(scenario,"__speechTest.texts.some(t=>t.final)||__speechTest.errors.length>0");
                assertEquals("Speech proof: "+eval(scenario,"JSON.stringify(__speechTest)"),"true",eval(scenario,"__speechTest.errors.length===0 && __speechTest.texts.at(-1).text==='kopieren' && __speechTest.texts.at(-1).final===true && !__voiceTest.laeuft() && __voiceTest.balken.hidden"));
            }
        }finally{provider(context,previous);}
    }
}
