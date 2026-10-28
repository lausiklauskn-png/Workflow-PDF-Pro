package de.familyprojekt.workflowpdf.pro;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Nimmt den Intent {@link ScanDirekt#AKTION} an (Kaltstart und laufende App) und meldet ihn der Seite
 * (native/native-scan-direkt.js): „scan“-Ereignis, danach holt {@link #offen} die Anfrage genau einmal ab.
 */
@CapacitorPlugin(name = "WorkflowScanDirekt")
public final class ProScanDirektPlugin extends Plugin {
    private String offenVon;   // null = keine Anfrage
    // BridgeActivity reicht den Start-Intent nach dem Laden der Plugins an handleOnNewIntent weiter (wie ProIncomingPlugin).
    @Override protected void handleOnNewIntent(Intent intent) {
        if (intent == null || !ScanDirekt.istScan(intent.getAction())) return;
        synchronized (this) { offenVon = ScanDirekt.von(intent.getStringExtra(ScanDirekt.EXTRA_VON)); }
        notifyListeners("scan", new JSObject());
    }
    @PluginMethod public void offen(PluginCall call) {
        String von;
        synchronized (this) { von = offenVon; offenVon = null; }
        call.resolve(new JSObject().put("scan", von != null).put("von", von == null ? "" : von));
    }
}
