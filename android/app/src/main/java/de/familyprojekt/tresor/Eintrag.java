package de.familyprojekt.tresor;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Eine Zeile im verschlüsselten Inhaltsverzeichnis eines Fachs — für alle Apps dasselbe Format.
 * {@code verschluesselung} „fpt1“: die Datei liegt im gemeinsamen Format und jede App kann sie öffnen.
 * „app“: die Datei gehört dem App-eigenen Format (z. B. Private Brains Dateien unter HMAC-Namen);
 * andere Apps zeigen nur Name, Art, Datum, Größe und Auszug.
 */
public final class Eintrag {
    public static final int AUSZUG_MAX = 1000, NAME_MAX = 255;
    public String id, name, art, verweis, schreiber, verschluesselung, sha256, auszug;
    public long datum, groesse;

    public Map<String, Object> alsMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id); m.put("name", name); m.put("art", art); m.put("datum", datum); m.put("groesse", groesse);
        m.put("auszug", auszug == null ? "" : auszug); m.put("verweis", verweis); m.put("schreiber", schreiber);
        m.put("verschluesselung", verschluesselung); m.put("sha256", sha256 == null ? "" : sha256);
        return m;
    }

    public static Eintrag ausMap(Map<String, Object> m) throws IOException {
        Eintrag e = new Eintrag();
        e.id = Json.text(m, "id"); e.name = Json.text(m, "name"); e.art = Json.text(m, "art");
        e.datum = Json.zahl(m, "datum"); e.groesse = Json.zahl(m, "groesse");
        e.auszug = Json.textOder(m, "auszug", ""); e.verweis = Json.text(m, "verweis");
        e.schreiber = Json.text(m, "schreiber"); e.verschluesselung = Json.text(m, "verschluesselung");
        e.sha256 = Json.textOder(m, "sha256", "");
        e.pruefen();
        return e;
    }

    void pruefen() throws IOException {
        if (id == null || !id.matches("[A-Za-z0-9._-]{1,80}")) throw new IOException("TRESOR_EINTRAG_UNGUELTIG");
        if (name == null || name.isEmpty() || name.length() > NAME_MAX) throw new IOException("TRESOR_EINTRAG_UNGUELTIG");
        if (art == null || art.length() > 200) throw new IOException("TRESOR_EINTRAG_UNGUELTIG");
        if (verweis == null || verweis.length() > 1000) throw new IOException("TRESOR_EINTRAG_UNGUELTIG");
        if (!"fpt1".equals(verschluesselung) && !"app".equals(verschluesselung)) throw new IOException("TRESOR_EINTRAG_UNGUELTIG");
        if (groesse < 0 || datum < 0) throw new IOException("TRESOR_EINTRAG_UNGUELTIG");
        if (sha256 != null && !sha256.isEmpty() && !sha256.matches("[a-f0-9]{64}")) throw new IOException("TRESOR_EINTRAG_UNGUELTIG");
        if (auszug != null && auszug.length() > AUSZUG_MAX) auszug = kuerzen(auszug);
        if ("fpt1".equals(verschluesselung)) DateiAblage.pruefen(verweis);
    }

    static String kuerzen(String text) {
        if (text == null) return "";
        String t = text.replaceAll("\\s+", " ").trim();
        if (t.length() <= AUSZUG_MAX) return t;
        int ende = AUSZUG_MAX;
        if (Character.isHighSurrogate(t.charAt(ende - 1))) ende--;
        return t.substring(0, ende);
    }
}
