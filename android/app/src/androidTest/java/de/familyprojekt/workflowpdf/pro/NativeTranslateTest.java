package de.familyprojekt.workflowpdf.pro;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real ML Kit models and packaged original retry/splitting path, no translation
 * fixture. Only synthetic public phrases are used for the first model download. */
@RunWith(AndroidJUnit4.class)
public final class NativeTranslateTest {
    private String eval(ActivityScenario<MainActivity> scenario,String script)throws Exception{
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();scenario.onActivity(a->a.getBridge().getWebView().evaluateJavascript(script,value->{result.set(value);latch.countDown();}));assertTrue(latch.await(10,TimeUnit.SECONDS));return result.get();
    }
    private void until(ActivityScenario<MainActivity> scenario,String script,long seconds)throws Exception{
        long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(seconds);while(System.nanoTime()<end){if("true".equals(eval(scenario,script)))return;Thread.sleep(200);}fail("Timed out: "+script+" result: "+eval(scenario,"JSON.stringify(window.__localTranslation)"));
    }
    @Test public void sixNativePairsDownloadModelsTranslateActualTextAndReleaseClients()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            until(scenario,"Boolean(window.__wfpdf&&window.WFP&&window.Translator)",60);
            eval(scenario,"window.__localTranslation=null;(async()=>{try{const sample={de:'Guten Morgen. Dies ist ein einfacher Test.',en:'Good morning. This is a simple test.',ru:'Доброе утро. Это простой тест.'},out=[];for(const from of Object.keys(sample))for(const to of Object.keys(sample)){if(from===to)continue;const tr=await WFP.Uebersetzung.browserUebersetzer(from,to);try{const result=await tr([sample[from]]);out.push({from,to,text:result[0],state:await WFP.Uebersetzung.browserVerfuegbar(from,to)});}finally{tr.zu();}}window.__localTranslation={out};}catch(error){window.__localTranslation={error:String(error)};}})();true");
            until(scenario,"window.__localTranslation!==null||Boolean(document.querySelector('.native-translate-consent'))",60);
            eval(scenario,"document.querySelector('.native-translate-consent [data-accept]')?.click();true");
            until(scenario,"window.__localTranslation!==null",240);
            JSONObject result=new JSONObject((String)new JSONTokener(eval(scenario,"JSON.stringify(__localTranslation)")).nextValue());assertFalse(result.toString(),result.has("error"));JSONArray out=result.getJSONArray("out");assertEquals(6,out.length());
            for(int i=0;i<out.length();i++){
                JSONObject pair=out.getJSONObject(i);assertEquals("available",pair.getString("state"));String text=pair.getString("text").toLowerCase(java.util.Locale.ROOT);
                assertTrue(pair.toString(),text.length()>5);String expected=pair.getString("to").equals("ru")?"утро":pair.getString("to").equals("de")?"morgen":"morning";assertTrue(pair.toString(),text.contains(expected));
            }
        }
    }
}
