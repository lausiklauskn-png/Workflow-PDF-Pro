package de.familyprojekt.hintergrund;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.LinkedHashMap;
import java.util.Map;

/** Gemeinsamer Baustein aller Pro-Apps (Leitfaden § 3, Quelle Private Brain Pro, byte-gleich kopiert).
 * Solange eine lange Aufgabe läuft (Sichern, Prüfen, Einordnen, Beschreiben), hält ein Vordergrund-Dienst mit
 * Mitteilung den App-Prozess am Leben, und die WebView behält ihre Priorität, auch wenn die App nicht zu sehen ist.
 * Gerechnet wird weiter in der WebView; der Dienst trägt keine Daten, nur Titel und Stand der Aufgaben. */
@CapacitorPlugin(name = "ProHintergrund", permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "mitteilung") })
public class ProHintergrundPlugin extends Plugin {
    static final Handler MAIN = new Handler(Looper.getMainLooper());
    /** Laufende Aufgaben in Startreihenfolge: Kennung → {titel, text, i, n}. Nur auf dem Hauptfaden ändern. */
    static final Map<String, String[]> AUFGABEN = new LinkedHashMap<>();
    static ProHintergrundPlugin aktuell;
    static final String VORLIEBEN = "pro_hintergrund", GEFRAGT = "mitteilung_gefragt";

    @Override public void load() { aktuell = this; }

    @PluginMethod public void beginnen(PluginCall call) {
        String id = call.getString("id"), titel = call.getString("titel", ""), text = call.getString("text", "");
        if (id == null || id.isEmpty()) { call.reject("id fehlt", "INVALID_INPUT"); return; }
        Context ctx = getContext().getApplicationContext();
        MAIN.post(() -> {
            AUFGABEN.put(id, new String[] { titel, text, "0", "0" });
            boolean geschuetzt = true;
            try { ContextCompat.startForegroundService(ctx, new Intent(ctx, ProHintergrundDienst.class)); }
            catch (RuntimeException verweigert) { geschuetzt = false; } // z. B. Start aus dem Hintergrund (Android 12+): Aufgabe läuft trotzdem
            vorrang(true);
            JSObject r = new JSObject(); r.put("geschuetzt", geschuetzt); call.resolve(r);
        });
    }

    @PluginMethod public void stand(PluginCall call) {
        String id = call.getString("id");
        String text = call.getString("text", "");
        int i = call.getInt("i", 0), n = call.getInt("n", 0);
        MAIN.post(() -> {
            String[] a = AUFGABEN.get(id);
            if (a != null) { a[1] = text; a[2] = String.valueOf(i); a[3] = String.valueOf(n); ProHintergrundDienst.erneuern(getContext()); }
            call.resolve();
        });
    }

    @PluginMethod public void ende(PluginCall call) {
        String id = call.getString("id");
        MAIN.post(() -> { AUFGABEN.remove(id); nachEnde(getContext()); call.resolve(); });
    }

    @PluginMethod public void zustand(PluginCall call) {
        boolean erlaubt = Build.VERSION.SDK_INT < 33 || getPermissionState("mitteilung") == PermissionState.GRANTED;
        MAIN.post(() -> { JSObject r = new JSObject(); r.put("aktiv", AUFGABEN.size()); r.put("mitteilung", erlaubt); call.resolve(r); });
    }

    /** Die Seite wurde neu geladen: was vorher lief, läuft nicht mehr (kein Ende kommt je). */
    @PluginMethod public void aufraeumen(PluginCall call) {
        MAIN.post(() -> { AUFGABEN.clear(); nachEnde(getContext()); call.resolve(); });
    }

    /** Einmal je Installation fragen; „nein“ ist eine gültige Antwort (der Dienst läuft auch ohne sichtbare Mitteilung). */
    @PluginMethod public void erlauben(PluginCall call) {
        boolean gefragt = getContext().getSharedPreferences(VORLIEBEN, Context.MODE_PRIVATE).getBoolean(GEFRAGT, false);
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("mitteilung") == PermissionState.GRANTED || gefragt || unterProbe()) { erlaubtAntwort(call); return; }
        getContext().getSharedPreferences(VORLIEBEN, Context.MODE_PRIVATE).edit().putBoolean(GEFRAGT, true).apply();
        requestPermissionForAlias("mitteilung", call, "nachFrage");
    }
    /** Gerätetests (Instrumentierung) laufen im App-Prozess: dort kein Systemfenster, das die Probe verdecken würde. */
    static boolean unterProbe() {
        try { Class.forName("androidx.test.platform.app.InstrumentationRegistry"); return true; } catch (ClassNotFoundException nein) { return false; }
    }
    @PermissionCallback private void nachFrage(PluginCall call) { erlaubtAntwort(call); }
    private void erlaubtAntwort(PluginCall call) {
        JSObject r = new JSObject();
        r.put("mitteilung", Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED);
        call.resolve(r);
    }

    static void nachEnde(Context ctx) {
        // Nie stopService: stünde der Dienst noch vor startForeground, beendete Android die App. Er hält selbst an,
        // sobald er läuft und keine Aufgabe mehr da ist (onStartCommand prüft es ebenso).
        if (AUFGABEN.isEmpty()) { ProHintergrundDienst.anhalten(); if (aktuell != null) aktuell.vorrang(false); }
        else ProHintergrundDienst.erneuern(ctx);
    }

    /** Abbrechen aus der Mitteilung: jede laufende Aufgabe bekommt „abbruch“; die Seite hält an und meldet „ende“. */
    static void abbruchAlle(String grund) {
        MAIN.post(() -> {
            if (aktuell == null) return;
            for (String id : AUFGABEN.keySet()) { JSObject e = new JSObject(); e.put("id", id); e.put("grund", grund); aktuell.notifyListeners("abbruch", e); }
        });
    }

    /** WebView nicht abwerten, solange etwas läuft (sonst kann Android den Darstellungsprozess im Hintergrund beenden). */
    void vorrang(boolean hoch) {
        if (Build.VERSION.SDK_INT < 26 || getBridge() == null) return;
        WebView w = getBridge().getWebView(); if (w == null) return;
        w.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, !hoch);
    }

    @Override protected void handleOnDestroy() { if (aktuell == this) aktuell = null; }
}
