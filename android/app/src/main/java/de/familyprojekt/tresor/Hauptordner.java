package de.familyprojekt.tresor;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Wo liegt der Tresor? (Klaus 2026-11-04: „Er soll nur die SD-Karte oder den Hauptspeicher zuweisen … die App soll
 * die Ordner selbst anlegen, benennen und den Pfad suchen. Es soll nie wieder passieren, dass ich eine Datei in
 * einen falschen Ordner ablege.“)
 *
 * Der Nutzer wählt nur einen Speicherort (SD-Karte, Gerätespeicher, USB-Stick, Laufwerk – oder irgendeinen Ordner
 * darauf). Diese Regel sucht darin den Tresor-Hauptordner oder sagt, wo er angelegt würde. Erkannt wird der Tresor
 * an seinem Inhalt ({@code tresorordner.json}), nie an seinem Namen: den Namen wählt jeder beim Anlegen selbst
 * (Vorschlag {@link #VORSCHLAG}); ein älterer Tresor mit anderem Namen wird ebenso gefunden.
 *
 * Reines Java ohne Gerät; dieselbe Regel in allen Pro-Apps (Paket byte-gleich). Sie liest nur, sie legt nichts an.
 */
public final class Hauptordner {
    /** Vorgeschlagener Name eines neuen Tresor-Hauptordners (Klaus 2026-11-04). */
    public static final String VORSCHLAG = "Family-Projekt";
    public static final int NAME_MAX = 80;

    /** Tresor gefunden: {@link Ergebnis#pfad} ist "" (der gewählte Ordner selbst) oder ein Ordner darin. */
    public static final String GEFUNDEN = "GEFUNDEN";
    /** Kein Tresor da, der gewählte Ordner ist leer: der Tresor kann genau hier entstehen. */
    public static final String ANLEGEN_HIER = "ANLEGEN_HIER";
    /** Kein Tresor da, der gewählte Ordner hat Inhalt: ein neuer Hauptordner (Name wählbar) entsteht darin. */
    public static final String ANLEGEN_DARIN = "ANLEGEN_DARIN";
    /** Ein Ordner innerhalb eines Tresors wurde gewählt (Fach, Eingang, „Tresorordner“): nichts tun, Speicher wählen. */
    public static final String UNTERORDNER = "UNTERORDNER";
    /** Mehrere Tresore liegen nebeneinander: nicht raten, den gewünschten Tresor-Ordner direkt wählen. */
    public static final String MEHRERE = "MEHRERE";

    public static final class Ergebnis {
        public final String art;
        /** Relativer Pfad des Tresor-Hauptordners zum gewählten Ordner ("" = er selbst); bei ANLEGEN_DARIN leer. */
        public final String pfad;
        /** Bei MEHRERE die gefundenen Ordnernamen, sonst leer. */
        public final List<String> kandidaten;
        Ergebnis(String art, String pfad, List<String> kandidaten) { this.art = art; this.pfad = pfad; this.kandidaten = kandidaten; }
        public boolean gefunden() { return GEFUNDEN.equals(art); }
        public boolean anlegen() { return ANLEGEN_HIER.equals(art) || ANLEGEN_DARIN.equals(art); }
    }

    private Hauptordner() { }

    /**
     * @param a     der gewählte Ordner
     * @param name  sein Anzeigename (darf leer sein, z. B. bei einem ganzen Laufwerk)
     */
    public static Ergebnis suchen(Ablage a, String name) throws IOException {
        if (TresorOrdner.vorhanden(a)) return new Ergebnis(GEFUNDEN, "", new ArrayList<>());
        if (imTresor(a, name)) return new Ergebnis(UNTERORDNER, "", new ArrayList<>());
        List<String> treffer = new ArrayList<>();
        for (String kind : a.liste("")) {
            if (!a.istOrdner(kind)) continue;
            if (a.gibtEs(kind + "/" + TresorOrdner.KOPF)) treffer.add(kind);
        }
        if (treffer.size() == 1) return new Ergebnis(GEFUNDEN, treffer.get(0), new ArrayList<>());
        if (treffer.size() > 1) return new Ergebnis(MEHRERE, "", treffer);
        return new Ergebnis(a.liste("").isEmpty() ? ANLEGEN_HIER : ANLEGEN_DARIN, "", new ArrayList<>());
    }

    /** Liegt der gewählte Ordner erkennbar innerhalb eines Tresors (ein Fach, ein Eingang, die Verwaltung)? */
    static boolean imTresor(Ablage a, String name) throws IOException {
        String n = name == null ? "" : name.trim();
        if (TresorOrdner.VERWALTUNG.equalsIgnoreCase(n)) return true;
        for (Fach f : Fach.ALLE) if (f.ordner.equalsIgnoreCase(n)) return true;
        // Am Inhalt: Verwaltungsdateien (auch umbenannt, auch ohne Inhaltsverzeichnis) oder der Kopf einer App-Ablage („….tresor.json“).
        // Passwort- und Ersatzplätze liegen nur in der Verwaltung; das Inhaltsverzeichnis entsteht erst beim ersten Ablegen.
        for (String k : a.liste("")) {
            if (k.matches("(kennwort-|ersatz-|fach-)[A-Za-z0-9-]+\\.json")) return true;
            if (k.endsWith(".tresor.json")) return true;
        }
        return false;
    }

    /**
     * Prüft einen vom Nutzer getippten Namen für einen neuen Hauptordner und gibt ihn bereinigt zurück.
     * Leer → {@link #VORSCHLAG}. Abgelehnt ({@code TRESOR_NAME_UNGUELTIG}): Schrägstriche und andere auf Windows,
     * Android oder SD-Karten (FAT/exFAT) verbotene Zeichen, „.“/„..“, mehr als {@link #NAME_MAX} Zeichen und die
     * Namen der Fächer bzw. der Verwaltung (sonst hielte man den Hauptordner später für ein Fach).
     */
    public static String name(String eingabe) throws IOException {
        String n = eingabe == null ? "" : java.text.Normalizer.normalize(eingabe, java.text.Normalizer.Form.NFC).trim();
        if (n.isEmpty()) return VORSCHLAG;
        if (n.length() > NAME_MAX || n.equals(".") || n.equals("..") || n.endsWith(".")) throw new IOException("TRESOR_NAME_UNGUELTIG");
        for (int i = 0; i < n.length(); i++) {
            char c = n.charAt(i);
            if (c < 32 || "/\\:*?\"<>|".indexOf(c) >= 0) throw new IOException("TRESOR_NAME_UNGUELTIG");
        }
        String klein = n.toLowerCase(Locale.ROOT);
        if (klein.equals(TresorOrdner.VERWALTUNG.toLowerCase(Locale.ROOT))) throw new IOException("TRESOR_NAME_UNGUELTIG");
        for (Fach f : Fach.ALLE) if (klein.equals(f.ordner.toLowerCase(Locale.ROOT))) throw new IOException("TRESOR_NAME_UNGUELTIG");
        return n;
    }

    /**
     * Die Ablage des Tresor-Hauptordners für ein Ergebnis. Bei ANLEGEN_DARIN entsteht der Ordner {@code neuerName}
     * (vorher {@link #name} prüfen); gibt es ihn schon mit Inhalt, wird abgelehnt ({@code TRESOR_NAME_BELEGT}) –
     * nie in einen fremden Ordner hinein. Für GEFUNDEN/ANLEGEN_HIER wird nichts angelegt.
     */
    public static Ablage ablage(Ablage gewaehlt, Ergebnis e, String neuerName) throws IOException {
        if (GEFUNDEN.equals(e.art)) return e.pfad.isEmpty() ? gewaehlt : new UnterAblage(gewaehlt, e.pfad);
        if (ANLEGEN_HIER.equals(e.art)) return gewaehlt;
        if (ANLEGEN_DARIN.equals(e.art)) {
            String n = name(neuerName);
            if (gewaehlt.gibtEs(n) && (!gewaehlt.istOrdner(n) || !gewaehlt.liste(n).isEmpty())) throw new IOException("TRESOR_NAME_BELEGT");
            gewaehlt.ordner(n);
            return new UnterAblage(gewaehlt, n);
        }
        throw new IOException("TRESOR_ORDNER_" + e.art);
    }
}
