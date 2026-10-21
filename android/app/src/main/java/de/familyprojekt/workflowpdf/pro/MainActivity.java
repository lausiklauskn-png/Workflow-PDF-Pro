package de.familyprojekt.workflowpdf.pro;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;

public class MainActivity extends BridgeActivity {
    private static final String RECEIPT_STATE="workflow.incoming.intent";
    private android.content.Intent incomingReceipt;
    private boolean restoreIncoming;
    @Override public void onCreate(Bundle state) {
        // Keep sanitized receipt state independent of Android's launch intent;
        // changing the latter disrupts Activity lifecycle/launch observers.
        if(state!=null&&state.containsKey(RECEIPT_STATE)){
            incomingReceipt=state.getParcelable(RECEIPT_STATE);
            restoreIncoming=incomingReceipt!=null;
        }
        registerPlugin(ProFilesPlugin.class);
        registerPlugin(ProImportPlugin.class);
        registerPlugin(ProIncomingPlugin.class);
        registerPlugin(ProVaultPlugin.class);
        registerPlugin(ProChromePlugin.class);
        registerPlugin(ProSpeechPlugin.class);
        registerPlugin(ProTranslatePlugin.class);
        super.onCreate(state);
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                android.net.Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && "localhost".equals(uri.getHost()) && uri.getPort() == -1)
                    return super.shouldOverrideUrlLoading(view, request);
                // A remote page must never replace the app or inherit its native bridge.
                if (request.isForMainFrame() && request.hasGesture() && java.util.Arrays.asList("http", "https", "mailto", "tel").contains(uri.getScheme())) {
                    try { startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, uri).addCategory(android.content.Intent.CATEGORY_BROWSABLE)); }
                    catch (Exception error) { android.widget.Toast.makeText(MainActivity.this, "Browser / App unavailable", android.widget.Toast.LENGTH_SHORT).show(); }
                }
                return true;
            }
        });
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (bridge == null) { moveTaskToBack(true); return; }
                bridge.getWebView().evaluateJavascript("window.WFPNativeNavigation?.back() === true", handled -> {
                    if ("true".equals(handled)) return;
                    if (bridge.getWebView().canGoBack()) bridge.getWebView().goBack();
                    else moveTaskToBack(true);
                });
            }
        });
    }
    @Override public void onSaveInstanceState(Bundle state){
        super.onSaveInstanceState(state);
        if(incomingReceipt!=null)state.putParcelable(RECEIPT_STATE,incomingReceipt);
    }
    @Override public void onResume(){
        super.onResume();
        ChromeRuntime.MAIN.post(()->{
            ChromeRuntime.Item item=ChromeRuntime.current;
            if(item!=null&&item.needsOpen)try{ChromeRuntime.open(this,item);}catch(Exception error){ChromeRuntime.stop(item.session.id,error.getMessage());}
        });
    }
    android.content.Intent incomingForLaunch(android.content.Intent delivered){
        if(restoreIncoming){restoreIncoming=false;return incomingReceipt;}return delivered;
    }
    void rememberIncoming(android.content.Intent receipt){incomingReceipt=receipt;}
    android.content.Intent currentIncoming(){return incomingReceipt;}
}
