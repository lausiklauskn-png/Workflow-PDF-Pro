package de.familyprojekt.tresor;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.channels.Channels;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * „Ort ändern“ für den gemeinsamen Tresorordner (Klaus 2026-10-31, Antwort 3: kopieren → prüfen → umschalten;
 * der alte Ort bleibt, bis der Nutzer ihn selbst löscht). Reines Java: Android ({@code SafAblage}) und
 * Windows/JVM ({@code DateiAblage}) gehen denselben Weg.
 *
 * Regeln:
 * - Der alte Ort wird nur gelesen. Einzige Ausnahme danach: {@link #vermerken} legt dort die kleine Datei
 *   {@code Tresorordner/umgezogen.json} an (neue Datei, nie überschrieben), damit die anderen Pro-Apps sehen,
 *   dass sie den neuen Ort wählen sollen. Eine Datei in einem Fach wird nie angefasst.
 * - Am neuen Ort wird nie etwas überschrieben. Liegt dort schon eine Datei mit gleichem Pfad, muss sie
 *   byte-gleich sein (Fortsetzen nach Abbruch), sonst Abbruch {@code TRESOR_UMZUG_KONFLIKT}.
 * - Der Kopf {@code tresorordner.json} kommt zuletzt: ein halber Umzug ist kein gültiger Tresorordner.
 * - Jede kopierte Datei wird am neuen Ort neu gelesen und per SHA-256 mit dem alten verglichen.
 */
public final class Umzug {
    public static final String VERMERK = TresorOrdner.VERWALTUNG + "/umgezogen.json";
    public static final String VERMERK_FORMAT = "familyprojekt-tresorordner-umzug";
    static final int MAX_DATEIEN = 200_000;

    private Umzug() { }

    /** Ergebnis: Zahl der Dateien, davon neu kopiert, Bytes, Kennung des Tresorordners. */
    public static final class Bericht {
        public final int dateien, kopiert; public final long bytes; public final String id;
        Bericht(int dateien, int kopiert, long bytes, String id) { this.dateien = dateien; this.kopiert = kopiert; this.bytes = bytes; this.id = id; }
    }

    /** Wird nach jeder Datei gerufen; {@code true} heißt abbrechen (vor der nächsten Datei). */
    public interface Stand { boolean weiter(int fertig, int gesamt); }

    /** Alle Dateien unter dem alten Ort, Kopf zuletzt. */
    static List<String> dateien(Ablage a) throws IOException {
        List<String> aus = new ArrayList<>();
        sammeln(a, "", aus);
        aus.remove(TresorOrdner.KOPF);
        aus.add(TresorOrdner.KOPF);
        return aus;
    }
    private static void sammeln(Ablage a, String ordner, List<String> aus) throws IOException {
        for (String n : a.liste(ordner)) {
            String p = ordner.isEmpty() ? n : ordner + "/" + n;
            if (a.istOrdner(p)) sammeln(a, p, aus);
            else { aus.add(p); if (aus.size() > MAX_DATEIEN) throw TresorOrdner.fehler("TRESOR_UMZUG_ZU_GROSS"); }
        }
    }

    private static String sha(Ablage a, String p) throws IOException {
        Ablage.Kanal k = a.kanal(p);
        try (InputStream in = Channels.newInputStream(k.kanal)) { return TresorOrdner.sha256(in); }
        finally { k.besitzer.close(); }
    }

    /** Kopiert und prüft. Der alte Ort bleibt unverändert; umgeschaltet wird vom Aufrufer erst nach Erfolg. */
    public static Bericht kopieren(Ablage alt, Ablage neu, Stand stand) throws IOException {
        if (!TresorOrdner.vorhanden(alt)) throw TresorOrdner.fehler("TRESOR_UMZUG_KEIN_TRESOR");
        String id = TresorOrdner.kennung(alt);
        if (alt.gibtEs(VERMERK)) throw TresorOrdner.fehler("TRESOR_UMZUG_SCHON_UMGEZOGEN");
        if (neu.gibtEs(TresorOrdner.KOPF) && !id.equals(TresorOrdner.kennung(neu))) throw TresorOrdner.fehler("TRESOR_UMZUG_FREMDER_TRESOR");
        List<String> liste = dateien(alt);
        int kopiert = 0; long bytes = 0;
        for (int i = 0; i < liste.size(); i++) {
            if (stand != null && stand.weiter(i, liste.size())) throw TresorOrdner.fehler("TRESOR_UMZUG_ABGEBROCHEN");
            String p = liste.get(i);
            String soll = sha(alt, p);
            if (neu.gibtEs(p)) {
                if (neu.istOrdner(p) || !soll.equals(sha(neu, p))) throw TresorOrdner.fehler("TRESOR_UMZUG_KONFLIKT");
            } else {
                int s = p.lastIndexOf('/');
                if (s > 0) neu.ordner(p.substring(0, s));
                Ablage.Kanal k = alt.kanal(p);
                try (InputStream in = Channels.newInputStream(k.kanal); OutputStream out = neu.neu(p)) {
                    byte[] puffer = new byte[64 * 1024]; int n;
                    while ((n = in.read(puffer)) != -1) out.write(puffer, 0, n);
                } finally { k.besitzer.close(); }
                if (!soll.equals(sha(neu, p))) throw TresorOrdner.fehler("TRESOR_UMZUG_UNBESTAETIGT");
                kopiert++;
            }
            bytes += alt.groesse(p);
        }
        if (stand != null) stand.weiter(liste.size(), liste.size());
        if (!id.equals(TresorOrdner.kennung(neu))) throw TresorOrdner.fehler("TRESOR_UMZUG_UNBESTAETIGT");
        return new Bericht(liste.size(), kopiert, bytes, id);
    }

    /** Am alten Ort vermerken, wohin umgezogen wurde (nur Anzeigename, kein Pfad mit Gerätedaten nötig). */
    public static void vermerken(Ablage alt, String id, String neuerName, long zeit) throws IOException {
        if (alt.gibtEs(VERMERK)) return;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("format", VERMERK_FORMAT); m.put("version", 1L); m.put("id", id);
        m.put("nach", neuerName == null ? "" : neuerName); m.put("zeit", zeit);
        alt.ordner(TresorOrdner.VERWALTUNG);
        try (OutputStream out = alt.neu(VERMERK)) { out.write(Json.schreiben(m).getBytes(StandardCharsets.UTF_8)); }
    }

    /** Vermerk lesen: {@code null}, wenn hier nicht umgezogen wurde. */
    public static Map<String, Object> vermerk(Ablage a) throws IOException {
        if (!a.gibtEs(VERMERK)) return null;
        Map<String, Object> m = Json.objekt(new String(a.lesen(VERMERK, 4096), StandardCharsets.UTF_8));
        return VERMERK_FORMAT.equals(m.get("format")) ? m : null;
    }
}
