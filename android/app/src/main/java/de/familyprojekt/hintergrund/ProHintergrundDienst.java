package de.familyprojekt.hintergrund;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import java.util.Locale;

/** Vordergrund-Dienst der gemeinsamen Hintergrundaufgabe (Quelle Private Brain Pro, byte-gleich kopiert).
 * Er rechnet nichts; er zeigt „läuft“, den Stand und „Abbrechen“ und hält damit den Prozess am Leben. */
public class ProHintergrundDienst extends Service {
    static final String KANAL = "pro-hintergrund", ABBRUCH = "pro.hintergrund.ABBRUCH";
    static final int NUMMER = 9417;
    static ProHintergrundDienst laufend;

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ABBRUCH.equals(intent.getAction())) { ProHintergrundPlugin.abbruchAlle("mitteilung"); return START_NOT_STICKY; }
        laufend = this;
        Notification n = mitteilung(this);
        if (Build.VERSION.SDK_INT >= 29) startForeground(NUMMER, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        else startForeground(NUMMER, n);
        if (ProHintergrundPlugin.AUFGABEN.isEmpty()) anhalten(); // Aufgabe war schon fertig, bevor der Dienst stand
        return START_NOT_STICKY;
    }

    static void erneuern(Context ctx) {
        if (laufend == null) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(NUMMER, mitteilung(ctx));
    }

    static void anhalten() {
        ProHintergrundDienst d = laufend; if (d == null) return;
        d.stopForeground(Service.STOP_FOREGROUND_REMOVE); d.stopSelf();
    }

    static boolean deutsch() { return "de".equals(Locale.getDefault().getLanguage()); }

    static Notification mitteilung(Context ctx) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel k = new NotificationChannel(KANAL, deutsch() ? "Arbeit im Hintergrund" : "Background work", NotificationManager.IMPORTANCE_LOW);
            k.setShowBadge(false);
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(k);
        }
        String titel = deutsch() ? "Läuft im Hintergrund" : "Running in the background", text = "";
        int i = 0, n = 0, zahl = ProHintergrundPlugin.AUFGABEN.size();
        for (String[] a : ProHintergrundPlugin.AUFGABEN.values()) { // die zuletzt begonnene Aufgabe zeigt sich
            titel = a[0].isEmpty() ? titel : a[0]; text = a[1];
            try { i = Integer.parseInt(a[2]); n = Integer.parseInt(a[3]); } catch (NumberFormatException kaputt) { i = 0; n = 0; }
        }
        if (zahl > 1) titel = titel + " (+" + (zahl - 1) + ")";
        Intent oeffnen = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (oeffnen != null) oeffnen.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent zurApp = oeffnen == null ? null : PendingIntent.getActivity(ctx, 0, oeffnen, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent halt = new Intent(ctx, ProHintergrundDienst.class).setAction(ABBRUCH).setData(Uri.parse("pro-hintergrund:abbruch"));
        PendingIntent abbrechen = PendingIntent.getService(ctx, 1, halt, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, KANAL)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle(titel).setContentText(text)
            .setOngoing(true).setOnlyAlertOnce(true).setSilent(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .addAction(0, deutsch() ? "Abbrechen" : "Cancel", abbrechen);
        if (n > 0) b.setProgress(n, Math.min(i, n), false); else b.setProgress(0, 0, true);
        if (zurApp != null) b.setContentIntent(zurApp);
        return b.build();
    }

    /** Android 15: dataSync darf höchstens 6 h am Tag laufen. Dann hält alles ordentlich an. */
    @Override public void onTimeout(int startId, int fgsType) { ProHintergrundPlugin.abbruchAlle("zeit"); anhalten(); }
    @Override public void onTimeout(int startId) { ProHintergrundPlugin.abbruchAlle("zeit"); anhalten(); }
    /** App aus der Liste gewischt: die WebView ist weg, also auch jede Aufgabe. */
    @Override public void onTaskRemoved(Intent rootIntent) { ProHintergrundPlugin.AUFGABEN.clear(); anhalten(); }
    @Override public void onDestroy() { if (laufend == this) laufend = null; super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
