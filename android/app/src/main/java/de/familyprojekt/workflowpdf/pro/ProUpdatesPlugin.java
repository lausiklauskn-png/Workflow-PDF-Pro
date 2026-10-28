package de.familyprojekt.workflowpdf.pro;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;

/** „Auf Updates prüfen“ (Leitfaden § 6, Klaus 2026-10-28): nur auf Tipp, liest die öffentlichen GitHub-Veröffentlichungen.
 *  Kein Token, keine Adresse aus dem Netz, kein Installieren — „Herunterladen“ öffnet die feste Seite der Veröffentlichung. */
@CapacitorPlugin(name = "WorkflowUpdates")
public final class ProUpdatesPlugin extends Plugin {
    private final PluginWorker worker = new PluginWorker();
    private final AtomicBoolean laeuft = new AtomicBoolean();
    private volatile String tag;

    @PluginMethod public void check(PluginCall call) {
        if (!laeuft.compareAndSet(false, true)) { call.reject("UPDATE_BUSY", "UPDATE_BUSY"); return; }
        worker.submit(call, () -> {
            try {
                String installiert = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0).versionName;
                JSONObject r = UpdateRegel.auswerten(installiert, holen());
                tag = r.optString("tag", null);
                call.resolve(JSObject.fromJSONObject(r));
            } catch (Exception error) {
                call.reject("UPDATE_UNAVAILABLE", "UPDATE_UNAVAILABLE");
            } finally { laeuft.set(false); }
        });
        if (worker.closed()) laeuft.set(false);
    }
    @PluginMethod public void openDownload(PluginCall call) {
        String t = tag;
        if (t == null) { call.reject("UPDATE_UNAVAILABLE", "UPDATE_UNAVAILABLE"); return; }
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(UpdateRegel.seite(t))).addCategory(Intent.CATEGORY_BROWSABLE));
            call.resolve();
        } catch (ActivityNotFoundException | IllegalArgumentException none) { call.reject("UPDATE_OPEN_FAILED", "UPDATE_OPEN_FAILED"); }
    }
    private JSONArray holen() throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL("https://api.github.com/repos/" + UpdateRegel.REPO + "/releases?per_page=30").openConnection();
        c.setConnectTimeout(15000); c.setReadTimeout(20000); c.setInstanceFollowRedirects(false);
        c.setRequestProperty("Accept", "application/vnd.github+json"); c.setRequestProperty("User-Agent", "Workflow-PDF-Pro");
        try {
            if (c.getResponseCode() != 200) throw new java.io.IOException("UPDATE_HTTP");
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] b = new byte[16384]; int n;
                while ((n = in.read(b)) != -1) { out.write(b, 0, n); if (out.size() > 4 * 1024 * 1024) throw new java.io.IOException("UPDATE_GROSS"); }
                return new JSONArray(new String(out.toByteArray(), StandardCharsets.UTF_8));
            }
        } finally { c.disconnect(); }
    }
    @Override protected void handleOnDestroy() { worker.close(() -> {}); }
}
