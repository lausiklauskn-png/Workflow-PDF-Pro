package de.familyprojekt.workflowpdf.pro;

import de.familyprojekt.tresor.Ablage;
import de.familyprojekt.tresor.Eintrag;
import de.familyprojekt.tresor.Fach;
import de.familyprojekt.tresor.Json;
import de.familyprojekt.tresor.TresorOrdner;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Einzug des Workflow-PDF-Tresors in den gemeinsamen Tresorordner (Schritt D1, Klaus 2026-10-27).
 * Reines Java ohne Android: läuft in der JVM-Probe mit {@code DateiAblage}.
 *
 * Der gewählte Ordner ist die Ebene ÜBER „Workflow PDF Pro“. Er passt nur, wenn darin genau der
 * entsperrte Tresor liegt (gleiche Kennung im Kopf) — auch als byte-gleiche Kopie (Probe an einer
 * Kopie der SD-Karte, Klaus 2026-10-27). Der Einzug liest und schreibt keine Datei in „Workflow PDF Pro/“;
 * er legt nur {@code tresorordner.json} und {@code Tresorordner/} daneben an.
 */
final class TresorEinzug {
    static final String APP = Fach.WORKFLOW_PDF_APP;
    static final String FACH = Fach.WORKFLOW_PDF.slug, EINGANG = Fach.EINGANG_WORKFLOW_PDF.slug;
    /** Kopfdatei des App-Tresors (DocumentVault.HEADER) unterhalb des Fach-Ordners. */
    static final String TRESOR_KOPF = "workflow-pdf-pro.tresor.json", TRESOR_FORMAT = "workflow-pdf-pro-vault";
    static final String KOPF_PFAD = Fach.WORKFLOW_PDF.ordner + "/" + TRESOR_KOPF;
    static final int MAX_EINTRAEGE = 20000;

    private TresorEinzug() { }

    /**
     * Prüft den gewählten Ordner gegen die Kennung des entsperrten App-Tresors.
     * PASST · IST_FACH (der Ordner „Workflow PDF Pro“ selbst wurde gewählt) · OHNE_TRESOR · FREMDER_TRESOR.
     */
    static String pruefen(Ablage a, String tresorId) throws IOException {
        if (a.gibtEs(TRESOR_KOPF)) return "IST_FACH";
        if (!a.gibtEs(KOPF_PFAD)) return "OHNE_TRESOR";
        Map<String, Object> kopf;
        try { kopf = Json.objekt(new String(a.lesen(KOPF_PFAD, 65536), StandardCharsets.UTF_8)); }
        catch (IOException e) { return "FREMDER_TRESOR"; }
        if (!TRESOR_FORMAT.equals(kopf.get("app"))) return "FREMDER_TRESOR";
        return tresorId != null && tresorId.equals(kopf.get("id")) ? "PASST" : "FREMDER_TRESOR";
    }

    /** Datenschlüssel des App-Tresors zusätzlich mit dem Hauptschlüssel verpacken; Eingangsfach anlegen. */
    static void einziehen(TresorOrdner t, byte[] datenSchluessel) throws IOException {
        t.fachEinziehen(FACH, datenSchluessel);
        t.fachAnlegen(EINGANG);
    }

    /** Ist der Tresor dieses Ordners schon eingezogen (Fach-Schlüssel vorhanden)? */
    static boolean eingezogen(TresorOrdner t) throws IOException { return t.fachBekannt(FACH); }

    /**
     * Zeilen aus der App (Bibliothek: Name, Datum, Größe, Seitentext-Auszug) in Einträge übersetzen.
     * Schreiber und Verschlüsselung setzt immer diese Seite: „app“ — die Dateien bleiben im
     * Workflow-eigenen Format, andere Apps zeigen nur die Zeile.
     */
    static List<Eintrag> eintraege(List<Map<String, Object>> zeilen) throws IOException {
        if (zeilen.size() > MAX_EINTRAEGE) throw new IOException("TRESOR_EINTRAG_UNGUELTIG");
        List<Eintrag> aus = new ArrayList<>();
        for (Map<String, Object> z : zeilen) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", z.get("id")); m.put("name", kurz(z.get("name"), Eintrag.NAME_MAX)); m.put("art", z.getOrDefault("art", "application/pdf"));
            m.put("datum", zahl(z.get("datum"))); m.put("groesse", zahl(z.get("groesse")));
            m.put("auszug", z.getOrDefault("auszug", "")); m.put("verweis", z.getOrDefault("verweis", "docs/" + z.get("id")));
            m.put("schreiber", APP); m.put("verschluesselung", "app"); m.put("sha256", z.getOrDefault("sha256", ""));
            aus.add(Eintrag.ausMap(m));
        }
        return aus;
    }

    /** Eigenes Inhaltsverzeichnis nur schreiben, wenn es sich geändert hat (sonst wachsen die Stände ohne Grund). */
    static boolean schreibenWennGeaendert(TresorOrdner t, List<Eintrag> neu) throws IOException {
        Map<String, Map<String, Object>> alt = new HashMap<>();
        for (Eintrag e : t.eigenesVerzeichnis(FACH)) alt.put(e.id, e.alsMap());
        boolean gleich = alt.size() == neu.size();
        for (Eintrag e : neu) if (gleich && !Objects.equals(alt.get(e.id), e.alsMap())) gleich = false;
        if (gleich) return false;
        t.verzeichnisSchreiben(FACH, neu);
        return true;
    }

    private static long zahl(Object o) {
        if (o instanceof Number) return Math.max(0, ((Number) o).longValue());
        try { return Math.max(0, Long.parseLong(String.valueOf(o))); } catch (NumberFormatException e) { return 0; }
    }
    private static String kurz(Object o, int max) {
        String s = o == null ? "" : String.valueOf(o).trim();
        if (s.isEmpty()) s = "Dokument";
        if (s.length() > max) { int ende = max; if (Character.isHighSurrogate(s.charAt(ende - 1))) ende--; s = s.substring(0, ende); }
        return s;
    }
}
