package de.familyprojekt.workflowpdf.pro;

import android.app.Activity;
import android.content.Context;
import android.content.UriPermission;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.appcompat.app.AlertDialog;
import java.util.Arrays;
import java.util.function.Consumer;

/**
 * Keine offenen Dateien in den Tresor (Klaus 2026-11-03, Plan Punkt 5). Befund SD-Karte: offene PDFs und
 * „….workfloh.json“ lagen im Fach „Workflow PDF Pro“ und direkt im Hauptablageordner.
 *
 * Erkannt wird ein Ziel aus Androids „Speichern unter“, das innerhalb eines Ordners liegt, für den diese App eine
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
                if (OrdnerWahl.liegtIn(baum.getAuthority(), DocumentsContract.getTreeDocumentId(baum), ziel.getAuthority(), dok)) return true;
            } catch (Exception weiter) { /* nächste Freigabe */ }
        }
        return false;
    }

    private static final String[][] W = {
        {"Das ist der Tresor", "This is the vault", "Это сейф", "هذه هي الخزنة"},
        {"Dieser Ordner ist der Tresor – dort liegen nur verschlüsselte Dateien. Eine offene Datei wäre dort für jeden lesbar, der die SD-Karte hat. Lieber z. B. „Downloads“ wählen.",
         "This folder is the vault – only encrypted files belong there. An open file there could be read by anyone who has the SD card. Better choose e.g. “Downloads”.",
         "Эта папка – сейф, там только зашифрованные файлы. Открытый файл там сможет прочитать любой, у кого есть SD-карта. Лучше выберите, например, «Загрузки».",
         "هذا المجلد هو الخزنة – لا يوجد فيه إلا ملفات مشفّرة. يمكن لأي شخص لديه بطاقة SD قراءة ملف مفتوح هناك. الأفضل اختيار «التنزيلات» مثلاً."},
        {"Abbrechen", "Cancel", "Отмена", "إلغاء"},
        {"Trotzdem speichern", "Save anyway", "Всё равно сохранить", "الحفظ على أي حال"}
    };

    /** Warnen; {@code weiter} bekommt true für „Trotzdem speichern“, false für Abbrechen. Läuft auf dem UI-Thread. */
    static void warnen(Activity activity, String language, Consumer<Boolean> weiter) {
        int i = Arrays.asList("de", "en", "ru", "ar").indexOf(language == null ? "de" : language);
        int l = i < 0 ? 0 : i;
        activity.runOnUiThread(() -> {
            if (activity.isFinishing() || activity.isDestroyed()) { weiter.accept(false); return; }
            boolean[] einmal = { false };
            Consumer<Boolean> fertig = wahl -> { if (!einmal[0]) { einmal[0] = true; weiter.accept(wahl); } };
            AlertDialog d = new AlertDialog.Builder(activity).setTitle(W[0][l]).setMessage(W[1][l])
                .setNegativeButton(W[2][l], (x, y) -> fertig.accept(false))
                .setPositiveButton(W[3][l], (x, y) -> fertig.accept(true)).create();
            d.setOnCancelListener(x -> fertig.accept(false));
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
