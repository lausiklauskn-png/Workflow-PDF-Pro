package de.familyprojekt.workflowpdf.pro;

import android.app.Activity;
import android.content.Context;
import android.content.UriPermission;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.appcompat.app.AlertDialog;
import java.util.Arrays;

/**
 * Keine offenen Dateien in den Tresor (Klaus 2026-11-03, Plan Punkt 5). Befund SD-Karte: offene PDFs und
 * „….workfloh.json“ lagen im Fach „Workflow PDF Pro“ und direkt im Hauptablageordner.
 *
 * Seit 2026-11-04 gesperrt statt gefragt. Erkannt wird ein Ziel aus Androids „Speichern unter“, das innerhalb eines Ordners liegt, für den diese App eine
 * dauerhafte Schreibfreigabe hält. Solche Freigaben nimmt die App nur für die eigene Ablage und den gemeinsamen
 * Tresorordner (ProVaultPlugin). Vergleich über {@link OrdnerWahl#liegtIn}: nur Androids Speicher-Anbieter
 * (Gerät, SD-Karte) — ein Ziel über einen anderen Anbieter (Downloads-Ansicht, Drive …) wird nicht erkannt.
 */
final class TresorSchutz {
    private TresorSchutz() { }

    static boolean imTresor(Context context, Uri ziel) {
        if (ziel == null || !"content".equals(ziel.getScheme())) return false;
        String dok;
        try { dok = DocumentsContract.getDocumentId(ziel); } catch (Exception keine) { return false; }
        for (UriPermission p : context.getContentResolver().getPersistedUriPermissions()) {
            if (!p.isWritePermission()) continue;
            Uri baum = p.getUri();
            try {
                if (!DocumentsContract.isTreeUri(baum)) continue;
                String wurzel = DocumentsContract.getTreeDocumentId(baum);
                if (!OrdnerWahl.liegtIn(baum.getAuthority(), wurzel, ziel.getAuthority(), dok)) continue;
                // Seit 2026-11-04 darf die Freigabe der ganze Speicher sein (nur Speicher wählen, Klaus). Gesperrt ist
                // deshalb nicht alles darin, sondern nur, was in einem Tresor-Hauptordner oder einer App-Ablage liegt –
                // erkannt am Inhalt der Ordner über dem Ziel (tresorordner.json bzw. ….tresor.json), auch bei anderen Apps.
                for (String ordner : OrdnerWahl.oberordner(wurzel, dok))
                    if (geschuetzt(new de.familyprojekt.tresor.SafAblage(context.getContentResolver(), baum, ordner))) return true;
            } catch (Exception weiter) { /* nächste Freigabe */ }
        }
        return false;
    }

    /** Liegt hier ein Tresor-Hauptordner oder eine App-Ablage einer Pro-App? */
    static boolean geschuetzt(de.familyprojekt.tresor.Ablage a) throws java.io.IOException {
        if (de.familyprojekt.tresor.TresorOrdner.vorhanden(a)) return true;
        for (String n : a.liste("")) if (n.endsWith(".tresor.json")) return true;
        return false;
    }

    private static final String[][] W = {
        {"Nicht im Tresor speichern", "Not inside the vault", "Не в сейфе", "ليس داخل الخزنة"},
        {"Dieser Ordner gehört zum Tresor der Pro-Apps – dort liegen nur verschlüsselte Dateien, die die Apps selbst verwalten. Eine offene Datei wäre dort für jeden lesbar, der die SD-Karte hat. Bitte einen anderen Ordner wählen, z. B. „Downloads“.",
         "This folder belongs to the Pro apps’ vault – only encrypted files managed by the apps belong there. An open file there could be read by anyone who has the SD card. Please choose another folder, e.g. “Downloads”.",
         "Эта папка относится к сейфу Pro-приложений – там только зашифрованные файлы, которыми управляют приложения. Открытый файл там сможет прочитать любой, у кого есть SD-карта. Выберите другую папку, например «Загрузки».",
         "هذا المجلد جزء من خزنة تطبيقات Pro – لا يوجد فيه إلا ملفات مشفّرة تديرها التطبيقات. يمكن لأي شخص لديه بطاقة SD قراءة ملف مفتوح هناك. يرجى اختيار مجلد آخر، مثل «التنزيلات»."},
        {"Verstanden", "OK", "Понятно", "حسناً"}
    };

    /** Speichern in den Tresor ist gesperrt (Klaus 2026-11-04: „sperren statt fragen“). Nur ein Hinweis, kein „Trotzdem“. UI-Thread. */
    static void gesperrt(Activity activity, String language, Runnable danach) {
        int i = Arrays.asList("de", "en", "ru", "ar").indexOf(language == null ? "de" : language);
        int l = i < 0 ? 0 : i;
        activity.runOnUiThread(() -> {
            if (activity.isFinishing() || activity.isDestroyed()) { danach.run(); return; }
            boolean[] einmal = { false };
            Runnable fertig = () -> { if (!einmal[0]) { einmal[0] = true; danach.run(); } };
            AlertDialog d = new AlertDialog.Builder(activity).setTitle(W[0][l]).setMessage(W[1][l])
                .setPositiveButton(W[2][l], (x, y) -> fertig.run()).create();
            d.setOnDismissListener(x -> fertig.run());
            d.show();
        });
    }

    /**
     * Das von „Speichern unter“ eben angelegte Ziel wieder entfernen — nur, wenn es nachweislich leer ist (0 Byte).
     * Hat jemand eine vorhandene Datei zum Überschreiben gewählt, bleibt sie unangetastet.
     */
    static void leeresZielEntfernen(Context context, Uri ziel) {
        try (android.database.Cursor c = context.getContentResolver().query(ziel, new String[] { DocumentsContract.Document.COLUMN_SIZE }, null, null, null)) {
            if (c == null || !c.moveToFirst() || c.isNull(0) || c.getLong(0) != 0) return;
        } catch (Exception unbekannt) { return; }
        try { DocumentsContract.deleteDocument(context.getContentResolver(), ziel); } catch (Exception egal) { /* bleibt leer stehen */ }
    }
}
