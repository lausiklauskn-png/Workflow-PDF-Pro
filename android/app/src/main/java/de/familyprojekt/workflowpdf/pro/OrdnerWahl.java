package de.familyprojekt.workflowpdf.pro;

import de.familyprojekt.tresor.Ablage;
import de.familyprojekt.tresor.Fach;
import de.familyprojekt.tresor.TresorOrdner;
import java.io.IOException;

/**
 * Was bedeutet der Ordner, den Klaus in Androids Ordnerwahl angetippt hat? (Klaus 2026-11-03, „Ja zum Plan“.)
 * Reines Java ohne Android: läuft in der JVM-Probe mit {@code DateiAblage}.
 *
 * Befund von der SD-Karte: wer statt des Hauptablageordners den Ordner „Workflow PDF Pro“ selbst wählt, darf weder
 * einen verschachtelten „Workflow PDF Pro/Workflow PDF Pro“ bekommen noch still einen neuen leeren Tresor. Android
 * erlaubt kein Hochgehen aus einem gewählten Ordner; was sich nicht prüfen lässt, wird gefragt oder klar abgelehnt.
 */
final class OrdnerWahl {
    static final String FACH_ORDNER = Fach.WORKFLOW_PDF.ordner;            // „Workflow PDF Pro“
    static final String ABLAGE_KOPF = TresorEinzug.TRESOR_KOPF;            // workflow-pdf-pro.tresor.json
    static final String VERWALTUNG = TresorOrdner.VERWALTUNG;              // „Tresorordner“

    private OrdnerWahl() { }

    /*
     * Ergebnis für die eigene Ablage. Die ersten drei öffnen oder legen ohne Frage an, die zwei „FRAGEN_…“ brauchen
     * eine Rückfrage, der Rest wird abgelehnt (nichts angelegt, nichts verändert).
     */
    static final String ABLAGE_HIER = "ABLAGE_HIER";                   // Kopf der Ablage liegt im gewählten Ordner
    static final String ABLAGE_DARIN = "ABLAGE_DARIN";                 // „Workflow PDF Pro“ mit Kopf liegt darin
    static final String TRESOR_NEUE_ABLAGE = "TRESOR_NEUE_ABLAGE";     // Tresorordner gewählt, eigenes Fach fehlt oder ist leer
    static final String FRAGEN_FACH_LEER = "FRAGEN_FACH_LEER";         // ein leerer Ordner „Workflow PDF Pro“: hier anlegen?
    static final String FRAGEN_NEU = "FRAGEN_NEU";                     // kein Tresor zu erkennen: neue Ablage darin anlegen?
    static final String NEIN_FACH_OHNE_KOPF = "FACH_OHNE_KOPF";        // „Workflow PDF Pro“ mit Inhalt, aber ohne Kopf
    static final String NEIN_VERWALTUNG = "VERWALTUNG";                // „Tresorordner/“ (nur Verwaltung, nie wählen)
    static final String NEIN_FREMDES_FACH = "FREMDES_FACH";            // Ordner einer anderen App oder ein Eingang-Fach

    static String ablage(Ablage a, String name) throws IOException {
        if (a.gibtEs(ABLAGE_KOPF)) return ABLAGE_HIER;
        if (VERWALTUNG.equals(name) || verwaltungInhalt(a)) return NEIN_VERWALTUNG;
        if (fremdesFach(name)) return NEIN_FREMDES_FACH;
        if (a.gibtEs(FACH_ORDNER + "/" + ABLAGE_KOPF)) return ABLAGE_DARIN;
        if (FACH_ORDNER.equals(name)) return a.liste("").isEmpty() ? FRAGEN_FACH_LEER : NEIN_FACH_OHNE_KOPF;
        if (a.istOrdner(FACH_ORDNER) && !a.liste(FACH_ORDNER).isEmpty()) return NEIN_FACH_OHNE_KOPF;
        if (TresorOrdner.vorhanden(a)) return TRESOR_NEUE_ABLAGE;
        return FRAGEN_NEU;
    }

    static boolean frage(String art) { return art.startsWith("FRAGEN_"); }
    static boolean abgelehnt(String art) {
        return NEIN_FACH_OHNE_KOPF.equals(art) || NEIN_VERWALTUNG.equals(art) || NEIN_FREMDES_FACH.equals(art);
    }

    /**
     * Darf die neue Ablage direkt im Ordner {@code wurzelName} liegen, oder kommt ein Unterordner „Workflow PDF Pro“
     * dazu? Nie verschachteln: ein Ordner „Workflow PDF Pro“ wird nur leer genommen, sonst abgelehnt.
     * @return true = Unterordner „Workflow PDF Pro“ anlegen; false = direkt hier.
     */
    static boolean unterordnerAnlegen(String wurzelName, boolean leer) throws IOException {
        if (!FACH_ORDNER.equals(wurzelName)) return true;
        if (!leer) throw new IOException("VAULT_ORDNER_" + NEIN_FACH_OHNE_KOPF);
        return false;
    }

    /*
     * Gemeinsamer Tresor (alle Pro-Apps): PASST nur, wenn tresorordner.json im gewählten Ordner liegt.
     */
    static final String TRESOR_PASST = "PASST";
    static final String TRESOR_APP_ORDNER = "APP_ORDNER";       // „Workflow PDF Pro“, „Private Brain“ … oder Eingang-Fach
    static final String TRESOR_VERWALTUNG = "VERWALTUNG";       // „Tresorordner/“
    static final String TRESOR_OHNE = "OHNE";                   // keine tresorordner.json

    static String tresor(Ablage a, String name) throws IOException {
        if (TresorOrdner.vorhanden(a)) return TRESOR_PASST;
        if (VERWALTUNG.equals(name) || verwaltungInhalt(a)) return TRESOR_VERWALTUNG;
        if (FACH_ORDNER.equals(name) || fremdesFach(name) || a.gibtEs(ABLAGE_KOPF)) return TRESOR_APP_ORDNER;
        return TRESOR_OHNE;
    }

    /** Name eines Fach-Ordners einer anderen App oder eines Übergabefachs. */
    static boolean fremdesFach(String name) {
        if (name == null) return false;
        for (Fach f : Fach.ALLE) if (f != Fach.WORKFLOW_PDF && f.ordner.equals(name)) return true;
        return false;
    }

    /** Sieht der Ordner aus wie „Tresorordner/“ (Passwort-Plätze, Fach-Schlüssel, Verzeichnis), egal wie er heißt? */
    private static boolean verwaltungInhalt(Ablage a) throws IOException {
        boolean schluessel = false;
        for (String n : a.liste("")) if (n.matches("(kennwort-|ersatz-|fach-)[A-Za-z0-9-]+\\.json")) { schluessel = true; break; }
        return schluessel && a.istOrdner("verzeichnis");
    }

    /**
     * Liegt ein Dokument (oder Ordner) innerhalb eines freigegebenen Ordners? Vergleich der Dokumentkennungen von
     * Androids Speicher-Anbieter „com.android.externalstorage.documents“ („<Speicher>:<Pfad>“, z. B.
     * „1234-ABCD:Privat Brain Pro Hauptablageordner/Workflow PDF Pro/x.pdf“). Andere Anbieter (Downloads, Drive …)
     * haben undurchsichtige Kennungen: dort gibt es kein Ergebnis (false) — das ist eine benannte Grenze.
     */
    static boolean liegtIn(String baumAnbieter, String baumKennung, String dokAnbieter, String dokKennung) {
        if (baumAnbieter == null || dokAnbieter == null || baumKennung == null || dokKennung == null) return false;
        if (!baumAnbieter.equals(dokAnbieter) || !EXTERN.equals(baumAnbieter)) return false;
        int b = baumKennung.indexOf(':'), d = dokKennung.indexOf(':');
        if (b < 0 || d < 0) return false;
        if (!baumKennung.substring(0, b).equalsIgnoreCase(dokKennung.substring(0, d))) return false;
        String bp = ohneSchraegstrich(baumKennung.substring(b + 1)), dp = ohneSchraegstrich(dokKennung.substring(d + 1));
        if (bp.isEmpty()) return true;                        // ganzer Speicher freigegeben
        return dp.equals(bp) || dp.startsWith(bp + "/");
    }
    /**
     * Die Ordner über einem Dokument bis einschließlich der Wurzel der Freigabe, nächster zuerst (nur Kennungen von
     * „com.android.externalstorage.documents“, „<Speicher>:<Pfad>“). Liegt das Dokument nicht darin: leer.
     */
    static java.util.List<String> oberordner(String wurzelKennung, String dokKennung) {
        java.util.List<String> aus = new java.util.ArrayList<>();
        if (!liegtIn(EXTERN, wurzelKennung, EXTERN, dokKennung)) return aus;
        int w = wurzelKennung.indexOf(':'), d = dokKennung.indexOf(':');
        String speicher = dokKennung.substring(0, d), wurzelPfad = ohneSchraegstrich(wurzelKennung.substring(w + 1));
        String pfad = ohneSchraegstrich(dokKennung.substring(d + 1));
        while (true) {
            int i = pfad.lastIndexOf('/');
            pfad = i < 0 ? "" : pfad.substring(0, i);
            if (pfad.length() < wurzelPfad.length()) break;
            aus.add(speicher + ":" + pfad);
            if (pfad.equals(wurzelPfad)) break;
        }
        return aus;
    }
    static final String EXTERN = "com.android.externalstorage.documents";
    private static String ohneSchraegstrich(String p) {
        String s = p;
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        while (s.startsWith("/")) s = s.substring(1);
        return s;
    }
}
