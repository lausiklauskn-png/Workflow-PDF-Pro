package de.familyprojekt.workflowpdf.pro;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;

/** „Auf Updates prüfen“ (Leitfaden § 6, Klaus 2026-10-28): liest die öffentlichen GitHub-Veröffentlichungen, kein Token.
 *  „Herunterladen“ öffnet die feste Seite der Veröffentlichung.
 *  „Direkt laden“ (Klaus 2026-11-13: Fähnchen und Versionsnummer sollen das Update gleich laden und installieren, wie Familienakte
 *  und BookLedgerPro): lädt die APK der geprüften Veröffentlichung von der festen Adresse, prüft Größe und – wenn GitHub sie nennt –
 *  SHA-256, dann muss die APK dasselbe Paket und dasselbe Signier-Zertifikat tragen wie die installierte App und einen höheren
 *  versionCode. Erst dann öffnet Android sein Installieren-Fenster; ohne Erlaubnis „Apps installieren“ zuerst diese Einstellung. */
@CapacitorPlugin(name = "WorkflowUpdates")
public final class ProUpdatesPlugin extends Plugin {
    private final PluginWorker worker = new PluginWorker();
    private final AtomicBoolean laeuft = new AtomicBoolean();
    private volatile String tag;
    private volatile JSONObject angebot;

    @PluginMethod public void check(PluginCall call) {
        if (!laeuft.compareAndSet(false, true)) { call.reject("UPDATE_BUSY", "UPDATE_BUSY"); return; }
        worker.submit(call, () -> {
            try {
                String installiert = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0).versionName;
                JSONObject r = UpdateRegel.auswerten(installiert, holen());
                tag = r.optString("tag", null);
                angebot = "available".equals(r.optString("status")) ? r : null;
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
    @SuppressWarnings("deprecation")
    private PackageInfo paket(String pfad) {
        PackageManager pm = getContext().getPackageManager();
        int f = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        try { return pfad == null ? pm.getPackageInfo(getContext().getPackageName(), f) : pm.getPackageArchiveInfo(pfad, f); }
        catch (PackageManager.NameNotFoundException e) { return null; }
    }
    @SuppressWarnings("deprecation")
    private static long code(PackageInfo p) { return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode; }
    @SuppressWarnings("deprecation")
    private static String zertifikat(PackageInfo p) throws Exception {
        Signature[] s = Build.VERSION.SDK_INT >= 28 && p.signingInfo != null ? p.signingInfo.getApkContentsSigners() : p.signatures;
        if (s == null || s.length != 1) throw new IOException("UPDATE_ZERTIFIKAT");
        return VaultCrypto.hex(MessageDigest.getInstance("SHA-256").digest(s[0].toByteArray()));
    }
    /** Folgt höchstens fünf Weiterleitungen, nur https und nur zu GitHub (github.com, *.githubusercontent.com). */
    private static HttpURLConnection apkOeffnen(String adresse) throws IOException {
        for (int i = 0; i < 6; i++) {
            URL u = new URL(adresse); String host = u.getHost().toLowerCase(java.util.Locale.ROOT);
            if (!"https".equals(u.getProtocol()) || !(host.equals("github.com") || host.endsWith(".githubusercontent.com"))) throw new IOException("UPDATE_UNGUELTIG");
            HttpURLConnection c = (HttpURLConnection) u.openConnection();
            c.setInstanceFollowRedirects(false); c.setConnectTimeout(15000); c.setReadTimeout(30000); c.setUseCaches(false);
            c.setRequestProperty("User-Agent", "Workflow-PDF-Pro"); c.setRequestProperty("Accept", "application/octet-stream");
            int code = c.getResponseCode();
            if (code == 200) return c;
            String weiter = c.getHeaderField("Location"); c.disconnect();
            if (code < 300 || code > 308 || weiter == null) throw new IOException("UPDATE_UNAVAILABLE");
            adresse = new URL(u, weiter).toString();
        }
        throw new IOException("UPDATE_UNAVAILABLE");
    }
    @PluginMethod public void install(PluginCall call) {
        JSONObject a = angebot;
        if (a == null || !a.has("apk")) { call.reject("UPDATE_NICHT_GEPRUEFT", "UPDATE_NICHT_GEPRUEFT"); return; }
        if (!laeuft.compareAndSet(false, true)) { call.reject("UPDATE_BUSY", "UPDATE_BUSY"); return; }
        worker.submit(call, () -> {
            File ordner = new File(getContext().getCacheDir(), "update");
            try {
                if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                    getActivity().startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                    call.resolve(new JSObject().put("erlaubnis", true));
                    return;
                }
                String name = a.getString("apk"), sha = a.optString("sha256", ""); long groesse = a.getLong("groesse");
                if (!ordner.isDirectory() && !ordner.mkdirs()) throw new IOException("UPDATE_UNAVAILABLE");
                File[] alt = ordner.listFiles(); if (alt != null) for (File f : alt) f.delete();
                File apk = new File(ordner, name), teil = new File(ordner, name + ".teil");
                MessageDigest h = MessageDigest.getInstance("SHA-256");
                long n = 0, gemeldet = 0;
                HttpURLConnection c = apkOeffnen(UpdateRegel.download(a.getString("tag"), name));
                try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(teil)) {
                    byte[] b = new byte[1 << 16]; int r;
                    while ((r = in.read(b)) != -1) {
                        n += r; if (n > groesse) throw new IOException("UPDATE_UNGUELTIG");
                        out.write(b, 0, r); h.update(b, 0, r);
                        if (n - gemeldet > (1 << 20)) { gemeldet = n; notifyListeners("stand", new JSObject().put("geladen", n).put("groesse", groesse)); }
                    }
                } finally { c.disconnect(); }
                if (n != groesse || (!sha.isEmpty() && !VaultCrypto.hex(h.digest()).equals(sha))) { teil.delete(); throw new IOException("UPDATE_BESCHAEDIGT"); }
                if (!teil.renameTo(apk)) throw new IOException("UPDATE_UNAVAILABLE");
                // Dasselbe Paket, dasselbe Zertifikat, höherer versionCode — sonst nichts installieren.
                PackageInfo ich = paket(null), neu = paket(apk.getPath());
                if (ich == null || neu == null || !ich.packageName.equals(neu.packageName) || code(neu) <= code(ich) || !zertifikat(ich).equals(zertifikat(neu))) { apk.delete(); throw new IOException("UPDATE_ZERTIFIKAT"); }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK));
                call.resolve(new JSObject().put("gestartet", true));
            } catch (Exception e) {
                File[] reste = ordner.listFiles(); if (reste != null) for (File f : reste) if (f.getName().endsWith(".teil")) f.delete();
                String m = e.getMessage(); String code = m != null && m.matches("UPDATE_[A-Z_]{2,40}") ? m : "UPDATE_UNAVAILABLE";
                call.reject(code, code);
            } finally { laeuft.set(false); }
        });
        if (worker.closed()) laeuft.set(false);
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
