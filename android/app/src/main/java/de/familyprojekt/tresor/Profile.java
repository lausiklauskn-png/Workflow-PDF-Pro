package de.familyprojekt.tresor;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Profile für die Maske (Pseudonymisieren, Klaus 2026-11-14) im gemeinsamen Fach „profile“.
 * Jede Pro-App legt ihre eigene Profil-Datei ab ({@code Maske-Profile/<app>/<uuid>.fpt}), alle Apps lesen alle.
 * Der Inhalt ist für das Paket undurchsichtig (JSON der App, Vertrag {@link #VERTRAG}), höchstens {@link #MAX_BYTES}.
 * Gelöscht wird nichts: eine neue Fassung kommt als neue Datei dazu, das eigene Verzeichnis nennt danach nur sie;
 * je App gilt die neueste. Eine beschädigte Datei einer App hält die anderen nicht auf.
 */
public final class Profile {
    public static final int MAX_BYTES = 1024 * 1024;
    public static final String VERTRAG = "familyprojekt-maske-profil/1";
    public static final String NAME = "maske-profil.json";
    public static final String ART = "application/json";

    /** Neueste Profil-Datei einer App. {@code fehler} ist gesetzt, wenn sie nicht gelesen werden konnte (dann ohne Daten). */
    public static final class Stand {
        public final String schreiber, sha256, fehler;
        public final long datum;
        private final byte[] daten;
        Stand(String schreiber, long datum, String sha256, byte[] daten, String fehler) {
            this.schreiber = schreiber; this.datum = datum; this.sha256 = sha256; this.daten = daten; this.fehler = fehler;
        }
        public byte[] daten() { return daten == null ? null : daten.clone(); }
    }

    private final TresorOrdner tresor;
    public Profile(TresorOrdner tresor) { this.tresor = tresor; }

    private static String fach() { return Fach.PROFILE.slug; }

    private static boolean istProfil(Eintrag e) {
        return VERTRAG.equals(e.auszug) && NAME.equals(e.name) && "fpt1".equals(e.verschluesselung) && e.groesse > 0 && e.groesse <= MAX_BYTES;
    }

    /** Eigene Profil-Datei als neue Fassung ablegen. Gleicher Inhalt wie die eigene neueste → nichts Neues. */
    public synchronized Eintrag schreiben(byte[] daten, long datum) throws IOException {
        if (daten == null || daten.length == 0 || daten.length > MAX_BYTES) throw new IOException("TRESOR_PROFIL_GROESSE");
        if (datum < 0) throw new IOException("TRESOR_PROFIL_DATUM");
        String summe = sha(daten);
        Eintrag neueste = null;
        if (tresor.fachBekannt(fach())) for (Eintrag e : tresor.eigenesVerzeichnis(fach())) if (istProfil(e) && (neueste == null || e.datum >= neueste.datum)) neueste = e;
        if (neueste != null && summe.equals(neueste.sha256) && neueste.groesse == daten.length) return neueste;
        long d = neueste == null ? datum : Math.max(datum, neueste.datum + 1);
        Eintrag e = tresor.ablegen(fach(), tresor.app(), NAME, ART, d, new ByteArrayInputStream(daten), VERTRAG);
        // Das eigene Verzeichnis nennt danach nur die neue Fassung; die alte Datei bleibt liegen (in keinem Fach wird gelöscht).
        List<Eintrag> nur = new ArrayList<>();
        for (Eintrag x : tresor.eigenesVerzeichnis(fach())) if (x.id.equals(e.id) || !istProfil(x)) nur.add(x);
        tresor.verzeichnisSchreiben(fach(), nur);
        return e;
    }

    /** Neueste Profil-Datei je App, eigene zuerst. Leer, solange das Fach fehlt. */
    public synchronized List<Stand> lesen() throws IOException {
        if (!tresor.fachBekannt(fach())) return Collections.emptyList();
        Map<String, Eintrag> je = new LinkedHashMap<>();
        for (Eintrag e : tresor.verzeichnis(fach())) {
            if (!istProfil(e)) continue;
            Eintrag da = je.get(e.schreiber);
            if (da == null || e.datum > da.datum) je.put(e.schreiber, e);
        }
        List<Stand> aus = new ArrayList<>();
        List<String> reihe = new ArrayList<>(je.keySet());
        reihe.remove(tresor.app());
        if (je.containsKey(tresor.app())) reihe.add(0, tresor.app());
        for (String schreiber : reihe) {
            Eintrag e = je.get(schreiber);
            try {
                byte[] b;
                try (InputStream in = tresor.oeffnen(fach(), e)) { b = begrenzt(in); }
                if (b.length != e.groesse || !sha(b).equals(e.sha256)) throw new IOException("TRESOR_PROFIL_PRUEFSUMME");
                aus.add(new Stand(schreiber, e.datum, e.sha256, b, null));
            } catch (IOException kaputt) {
                aus.add(new Stand(schreiber, e.datum, e.sha256, null, kaputt.getMessage() == null ? "TRESOR_BESCHAEDIGT" : kaputt.getMessage()));
            }
        }
        return aus;
    }

    private static byte[] begrenzt(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] puffer = new byte[16 * 1024]; int n;
        while ((n = in.read(puffer)) != -1) { if (n > MAX_BYTES - out.size()) throw new IOException("TRESOR_PROFIL_GROESSE"); out.write(puffer, 0, n); }
        return out.toByteArray();
    }

    private static String sha(byte[] b) throws IOException {
        try { return VaultCrypto.hex(MessageDigest.getInstance("SHA-256").digest(b)); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IOException(e); }
    }
}
