package de.familyprojekt.workflowpdf.pro;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;

public class MainActivity extends BridgeActivity {
    private boolean runtimeNotice;
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
        registerPlugin(ProUpdatesPlugin.class);
        registerPlugin(ProScanDirektPlugin.class);
        registerPlugin(de.familyprojekt.hintergrund.ProHintergrundPlugin.class);
        super.onCreate(state);
        if(bridge==null){if(!runtimeNotice)showRuntimeNotice();return;}
        // Leitfaden § 1.8 (Klaus 2026-10-29, wie BookLedgerPro): die WebView übernimmt sonst Androids Systemschrift (textZoom) und startet
        // größer als die PWA. Die App startet bei 100 %; größer macht man sie mit „A··A“ im Kopf (nur die Schrift wächst).
        bridge.getWebView().getSettings().setTextZoom(100);
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
    @Override protected void load(){
        android.content.pm.PackageInfo provider=android.webkit.WebView.getCurrentWebViewPackage();
        int major=0;try{if(provider!=null)major=Integer.parseInt(provider.versionName.split("\\.")[0]);}catch(Exception malformed){/* Treat unknown provider as requiring an update. */}
        if(major<120){showRuntimeNotice();return;}
        super.load();
    }
    private void showRuntimeNotice(){
        runtimeNotice=true;
        String lang=java.util.Locale.getDefault().getLanguage();int n="en".equals(lang)?1:"ru".equals(lang)?2:"ar".equals(lang)?3:0;
        String[] body={
            "Bitte Android System WebView bzw. Chrome aktualisieren und die App danach neu starten. Die vollständige PDF- und Schutzfunktion benötigt eine aktuelle Systemkomponente (ab Version 120). Vorhandene Dokumente und Tresore bleiben erhalten.",
            "Update Android System WebView or Chrome, then restart the app. Complete PDF and security functionality needs a current system component (version 120 or later). Existing documents and vaults are retained.",
            "Обновите Android System WebView или Chrome и перезапустите приложение. Для PDF и защитных функций нужна актуальная версия компонента (120 или новее). Документы и хранилища сохраняются.",
            "حدّث Android System WebView أو Chrome ثم أعد تشغيل التطبيق. تحتاج وظائف PDF والحماية الكاملة إلى مكوّن نظام حديث (الإصدار 120 أو أحدث). تبقى المستندات والخزن محفوظة."
        };
        android.widget.LinearLayout layout=new android.widget.LinearLayout(this);layout.setOrientation(android.widget.LinearLayout.VERTICAL);int padding=(int)(24*getResources().getDisplayMetrics().density);layout.setPadding(padding,padding,padding,padding);
        android.widget.TextView title=new android.widget.TextView(this),text=new android.widget.TextView(this);title.setText("Workflow PDF Pro");title.setTextSize(24);text.setText(body[n]);text.setTextSize(17);
        android.widget.Button update=new android.widget.Button(this),retry=new android.widget.Button(this);update.setText(new String[]{"Systemkomponente aktualisieren","Update system component","Обновить системный компонент","تحديث مكوّن النظام"}[n]);retry.setText(new String[]{"Erneut prüfen","Check again","Проверить снова","التحقق مجدداً"}[n]);
        update.setOnClickListener(v->{
            android.content.pm.PackageInfo provider=android.webkit.WebView.getCurrentWebViewPackage();String name=provider==null?"com.google.android.webview":provider.packageName;
            try{startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse("market://details?id="+name)));}
            catch(Exception missing){try{startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse("https://play.google.com/store/apps/details?id="+name)));}catch(Exception unavailable){/* Instructions remain visible. */}}
        });retry.setOnClickListener(v->recreate());layout.addView(title);layout.addView(text);layout.addView(update);layout.addView(retry);setContentView(layout);
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
