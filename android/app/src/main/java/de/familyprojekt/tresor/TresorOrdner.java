package de.familyprojekt.tresor;

import java.io.ByteArrayInputStream;
import java.io.Closeable;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Der gemeinsame Tresorordner aller Pro-Apps (Format „familyprojekt-tresorordner“, Version 1).
 *
 * <pre>
 * &lt;gewählter Ordner&gt;/
 *   tresorordner.json                    Kopf: Kennung, Prüfwert des Hauptschlüssels (kein Schlüssel)
 *   Tresorordner/kennwort-&lt;uuid&gt;.json      Hauptschlüssel, mit dem Passwort verpackt (PBKDF2 600 000, AES-GCM)
 *   Tresorordner/ersatz-&lt;satz&gt;.json        Hauptschlüssel, mit dem Ersatzschlüssel (5 Teile, 3 genügen) verpackt
 *   Tresorordner/fach-&lt;fach&gt;.json          Fach-Schlüssel, mit dem Hauptschlüssel verpackt
 *   Tresorordner/verzeichnis/&lt;fach&gt;/&lt;app&gt;/v-&lt;rev&gt;-&lt;uuid&gt;.fpt   Inhaltsverzeichnis, PBV1 mit dem Fach-Schlüssel
 *   Tresorordner/marken/&lt;app&gt;/&lt;fach&gt;--&lt;eintrag&gt;.json             „übernommen“-Marken
 *   Private Brain/ · Workflow PDF Pro/ · BookLedgerPro/ · Eingang-BookLedgerPro/ · Eingang-WorkflowPDF/
 *   Private Brain V3/ · Familienakte/ · Eingang-Familienakte/ (seit 2026-10-31)
 * </pre>
 *
 * Vorhandene App-Tresore ziehen ein, indem nur ihr Datenschlüssel zusätzlich mit dem Hauptschlüssel
 * verpackt wird ({@link #fachEinziehen}); keine Datei im Fach wird angefasst. Ein falsches Passwort
 * ändert nichts. Gelöscht werden nur eigene Verwaltungsdateien unter {@code Tresorordner/} (alte
 * Passwort- und Ersatzplätze, ältere eigene Verzeichnis-Stände) und eine in dieser Sitzung selbst
 * angelegte, beim Prüfen durchgefallene Datei — nie etwas in einem Fach.
 */
public final class TresorOrdner implements Closeable {
    public static final String FORMAT = "familyprojekt-tresorordner", KOPF = "tresorordner.json", VERWALTUNG = "Tresorordner";
    public static final int VERSION = 1, MIN_PASSWORT = 10, BEHALTENE_STAENDE = 3;
    static final int KLEIN = 65536, VERZEICHNIS_MAX = 64 * 1024 * 1024;
    private static final String UUID_MUSTER = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";

    private final Ablage ablage;
    private final String app, id;
    private byte[] haupt;
    private final Map<String, byte[]> fachSchluessel = new HashMap<>();
    private final Set<String> selbstAngelegt = new HashSet<>();

    private TresorOrdner(Ablage ablage, String app, String id, byte[] haupt) {
        this.ablage = ablage; this.app = app; this.id = id; this.haupt = haupt;
    }

    // ---------- Hilfen ----------
    static IOException fehler(String code) { return new IOException(code); }
    private static byte[] utf8(String s) { return s.getBytes(StandardCharsets.UTF_8); }
    static byte[] unhex(String hex) throws IOException {
        if (hex == null || hex.length() % 2 != 0 || !hex.matches("[a-f0-9]*")) throw fehler("TRESOR_BESCHAEDIGT");
        byte[] out = new byte[hex.length() / 2];
        for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(hex.substring(2 * i, 2 * i + 2), 16);
        return out;
    }
    private static String aad(String id, String art, String teil) { return FORMAT + "|" + id + "|" + art + "|" + teil; }
    private static Map<String, Object> grund(String id) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("format", FORMAT); m.put("v", (long) VERSION); m.put("id", id);
        return m;
    }
    private static void grundPruefen(Map<String, Object> m, String id) throws IOException {
        if (!FORMAT.equals(m.get("format")) || Json.zahlOder(m, "v", -1) != VERSION) throw fehler("TRESOR_BESCHAEDIGT");
        if (id != null && !id.equals(m.get("id"))) throw fehler("TRESOR_BESCHAEDIGT");
    }
    private static Map<String, Object> jsonLesen(Ablage a, String pfad) throws IOException {
        return Json.objekt(new String(a.lesen(pfad, KLEIN), StandardCharsets.UTF_8));
    }
    private static int passwortLaenge(CharSequence passwort) {
        String n = Normalizer.normalize(passwort, Normalizer.Form.NFC);
        return n.codePointCount(0, n.length());
    }
    private static byte[] pruefwert(byte[] haupt, String id) throws IOException {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(haupt, "HmacSHA256"));
            return mac.doFinal(utf8(aad(id, "pruefung", "1")));
        } catch (GeneralSecurityException e) { throw fehler("TRESOR_NICHT_VERFUEGBAR"); }
    }
    private void offen() throws IOException { if (haupt == null) throw fehler("TRESOR_GESPERRT"); }

    /** Schreibt eine neue kleine Datei und liest sie zur Probe zurück. */
    private void neuSchreiben(String pfad, byte[] daten) throws IOException {
        try (OutputStream out = ablage.neu(pfad)) { selbstAngelegt.add(pfad); out.write(daten); }
        catch (IOException e) { eigeneNeueLoeschen(pfad); throw e; }
        if (!Arrays.equals(daten, ablage.lesen(pfad, Math.max(KLEIN, daten.length + 1)))) { eigeneNeueLoeschen(pfad); throw fehler("TRESOR_BESCHAEDIGT"); }
    }
    /** Nur was diese Sitzung selbst neu angelegt hat (z. B. eine beim Prüfen durchgefallene Datei). */
    private void eigeneNeueLoeschen(String pfad) {
        if (!selbstAngelegt.remove(pfad)) return;
        try { ablage.loeschen(pfad); } catch (IOException ignoriert) { }
    }
    /** Nur eigene Verwaltungsdateien: alte Plätze und ältere eigene Verzeichnis-Stände. */
    private void verwaltungLoeschen(String pfad) throws IOException {
        boolean platz = pfad.matches(VERWALTUNG + "/(kennwort-" + UUID_MUSTER + "|ersatz-[a-f0-9]{8})\\.json");
        boolean eigenerStand = pfad.matches(VERWALTUNG + "/verzeichnis/[a-z-]+/" + java.util.regex.Pattern.quote(app) + "/v-[0-9]{20}-" + UUID_MUSTER + "\\.fpt");
        if (!platz && !eigenerStand) throw fehler("TRESOR_LOESCHEN_VERBOTEN");
        ablage.loeschen(pfad);
    }

    // ---------- Anlegen und Öffnen ----------
    public static boolean vorhanden(Ablage a) throws IOException { return a.gibtEs(KOPF); }

    /** Kennung aus dem Kopf, ohne Passwort (zeigt nur, dass es ein Tresorordner ist). */
    public static String kennung(Ablage a) throws IOException {
        Map<String, Object> kopf = jsonLesen(a, KOPF);
        grundPruefen(kopf, null);
        String id = Json.text(kopf, "id");
        if (!id.matches(UUID_MUSTER)) throw fehler("TRESOR_BESCHAEDIGT");
        return id;
    }

    /** Neuer Tresorordner im gewählten Ordner. Vorhandene Fächer (z. B. „Private Brain/“) bleiben unberührt. */
    public static TresorOrdner anlegen(Ablage a, String app, CharSequence passwort) throws IOException {
        Fach.appPruefen(app);
        if (passwortLaenge(passwort) < MIN_PASSWORT) throw fehler("TRESOR_PASSWORT_KURZ");
        if (vorhanden(a)) throw fehler("TRESOR_DA");
        String id = UUID.randomUUID().toString();
        TresorOrdner t = new TresorOrdner(a, app, id, VaultCrypto.random(VaultCrypto.KEY));
        boolean fertig = false;
        try {
            a.ordner(VERWALTUNG);
            t.passwortPlatzSchreiben(passwort);
            Map<String, Object> kopf = grund(id);
            kopf.put("angelegt", System.currentTimeMillis());
            kopf.put("pruefung", VaultCrypto.hex(pruefwert(t.haupt, id)));
            // Der Kopf kommt zuletzt: erst mit ihm gilt der Ordner als Tresorordner.
            t.neuSchreiben(KOPF, utf8(Json.schreiben(kopf)));
            fertig = true;
            return t;
        } finally {
            if (!fertig) { for (String p : new ArrayList<>(t.selbstAngelegt)) t.eigeneNeueLoeschen(p); t.close(); }
        }
    }

    /** Mit dem Passwort öffnen. Ein falsches Passwort schreibt nichts. */
    public static TresorOrdner oeffnen(Ablage a, String app, CharSequence passwort) throws IOException {
        Fach.appPruefen(app);
        String id = kennung(a);
        byte[] erwartet = unhex(Json.text(jsonLesen(a, KOPF), "pruefung"));
        for (String name : a.liste(VERWALTUNG)) {
            if (!name.matches("kennwort-" + UUID_MUSTER + "\\.json")) continue;
            Map<String, Object> platz = jsonLesen(a, VERWALTUNG + "/" + name);
            byte[] haupt = passwortAuspacken(platz, id, passwort);
            if (haupt == null) continue;
            if (!MessageDigest.isEqual(pruefwert(haupt, id), erwartet)) { Arrays.fill(haupt, (byte) 0); throw fehler("TRESOR_BESCHAEDIGT"); }
            return new TresorOrdner(a, app, id, haupt);
        }
        throw fehler("TRESOR_PASSWORT_FALSCH");
    }

    /** Mit einem auf dem Gerät gemerkten Hauptschlüssel öffnen (Keystore/DPAPI liegt in der App). */
    public static TresorOrdner mitHauptschluessel(Ablage a, String app, byte[] haupt) throws IOException {
        Fach.appPruefen(app);
        String id = kennung(a);
        if (haupt == null || haupt.length != VaultCrypto.KEY) throw fehler("TRESOR_GESPERRT");
        byte[] erwartet = unhex(Json.text(jsonLesen(a, KOPF), "pruefung"));
        if (!MessageDigest.isEqual(pruefwert(haupt, id), erwartet)) throw fehler("TRESOR_GESPERRT");
        return new TresorOrdner(a, app, id, haupt.clone());
    }

    private static byte[] passwortAuspacken(Map<String, Object> platz, String id, CharSequence passwort) throws IOException {
        grundPruefen(platz, id);
        long runden = Json.zahl(platz, "runden");
        String nr = Json.text(platz, "platz");
        if (runden < VaultCrypto.MIN_ITERATIONS || runden > VaultCrypto.MAX_ITERATIONS || !"PBKDF2-HMAC-SHA256".equals(platz.get("kdf"))) throw fehler("TRESOR_BESCHAEDIGT");
        byte[] salz = unhex(Json.text(platz, "salz")), verpackt = unhex(Json.text(platz, "schluessel"));
        if (salz.length != 16 || verpackt.length != VaultCrypto.NONCE + VaultCrypto.KEY + VaultCrypto.TAG) throw fehler("TRESOR_BESCHAEDIGT");
        byte[] pw = VaultCrypto.passwordBytes(passwort), kek = null;
        try {
            kek = VaultCrypto.pbkdf2(pw, salz, (int) runden);
            return VaultCrypto.open(kek, verpackt, utf8(aad(id, "kennwort", nr + "|" + runden)));
        } catch (GeneralSecurityException falsch) {
            return null;
        } finally { Arrays.fill(pw, (byte) 0); if (kek != null) Arrays.fill(kek, (byte) 0); }
    }

    private String passwortPlatzSchreiben(CharSequence passwort) throws IOException {
        String nr = UUID.randomUUID().toString(), pfad = VERWALTUNG + "/kennwort-" + nr + ".json";
        byte[] salz = VaultCrypto.random(16), pw = VaultCrypto.passwordBytes(passwort), kek = null;
        try {
            kek = VaultCrypto.pbkdf2(pw, salz, VaultCrypto.ITERATIONS);
            Map<String, Object> platz = grund(id);
            platz.put("platz", nr); platz.put("kdf", "PBKDF2-HMAC-SHA256"); platz.put("runden", (long) VaultCrypto.ITERATIONS);
            platz.put("salz", VaultCrypto.hex(salz));
            platz.put("schluessel", VaultCrypto.hex(VaultCrypto.seal(kek, haupt, utf8(aad(id, "kennwort", nr + "|" + VaultCrypto.ITERATIONS)))));
            platz.put("angelegt", System.currentTimeMillis());
            neuSchreiben(pfad, utf8(Json.schreiben(platz)));
        } catch (GeneralSecurityException e) { throw fehler("TRESOR_NICHT_VERFUEGBAR"); }
        finally { Arrays.fill(pw, (byte) 0); if (kek != null) Arrays.fill(kek, (byte) 0); }
        // Zur Probe mit dem Passwort öffnen, bevor irgendetwas davon abhängt.
        byte[] zurueck = passwortAuspacken(jsonLesen(ablage, pfad), id, passwort);
        boolean gleich = zurueck != null && MessageDigest.isEqual(zurueck, haupt);
        if (zurueck != null) Arrays.fill(zurueck, (byte) 0);
        if (!gleich) { eigeneNeueLoeschen(pfad); throw fehler("TRESOR_BESCHAEDIGT"); }
        return pfad;
    }

    /** Neues Passwort: neuer Platz, geprüft; danach verschwinden die alten Passwort-Plätze. */
    public void passwortAendern(CharSequence neues) throws IOException {
        offen();
        if (passwortLaenge(neues) < MIN_PASSWORT) throw fehler("TRESOR_PASSWORT_KURZ");
        String behalten = passwortPlatzSchreiben(neues);
        for (String name : ablage.liste(VERWALTUNG)) {
            String pfad = VERWALTUNG + "/" + name;
            if (name.matches("kennwort-" + UUID_MUSTER + "\\.json") && !pfad.equals(behalten)) verwaltungLoeschen(pfad);
        }
    }

    // ---------- Ersatzschlüssel ----------
    /** Neuer Ersatzschlüssel (n Teile, k genügen). Ein neuer Satz ersetzt den alten erst, wenn er geprüft ist. */
    public List<String> ersatzErstellen(int n, int k) throws IOException {
        offen();
        byte[] geheim = VaultCrypto.random(Ersatzschluessel.SECRET), satz = VaultCrypto.random(4);
        String satzHex = VaultCrypto.hex(satz), pfad = VERWALTUNG + "/ersatz-" + satzHex + ".json";
        List<Ersatzschluessel.Share> teile = null;
        try {
            teile = Ersatzschluessel.split(geheim, satz, n, k);
            Map<String, Object> datei = grund(id);
            datei.put("satz", satzHex); datei.put("n", (long) n); datei.put("k", (long) k); datei.put("angelegt", System.currentTimeMillis());
            datei.put("schluessel", VaultCrypto.hex(VaultCrypto.seal(geheim, haupt, utf8(aad(id, "ersatz", satzHex)))));
            neuSchreiben(pfad, utf8(Json.schreiben(datei)));
            byte[] wieder = Ersatzschluessel.combine(teile.subList(0, k));
            boolean gleich = MessageDigest.isEqual(wieder, geheim);
            Arrays.fill(wieder, (byte) 0);
            byte[] hs = ersatzAuspacken(jsonLesen(ablage, pfad), id, satzHex, geheim);
            gleich &= MessageDigest.isEqual(hs, haupt);
            Arrays.fill(hs, (byte) 0);
            if (!gleich) { eigeneNeueLoeschen(pfad); throw fehler("TRESOR_BESCHAEDIGT"); }
            for (String name : ablage.liste(VERWALTUNG))
                if (name.matches("ersatz-[a-f0-9]{8}\\.json") && !name.equals("ersatz-" + satzHex + ".json")) verwaltungLoeschen(VERWALTUNG + "/" + name);
            List<String> aus = new ArrayList<>();
            for (Ersatzschluessel.Share t : teile) aus.add(Ersatzschluessel.encode(t));
            return aus;
        } catch (GeneralSecurityException e) { throw fehler("TRESOR_NICHT_VERFUEGBAR"); }
        finally {
            Arrays.fill(geheim, (byte) 0);
            if (teile != null) for (Ersatzschluessel.Share t : teile) Arrays.fill(t.data, (byte) 0);
        }
    }

    private static byte[] ersatzAuspacken(Map<String, Object> datei, String id, String satzHex, byte[] geheim) throws IOException {
        grundPruefen(datei, id);
        if (!satzHex.equals(datei.get("satz"))) throw fehler("TRESOR_ERSATZ_UNBEKANNT");
        try { return VaultCrypto.open(geheim, unhex(Json.text(datei, "schluessel")), utf8(aad(id, "ersatz", satzHex))); }
        catch (GeneralSecurityException e) { throw fehler("TRESOR_ERSATZ_FALSCH"); }
    }

    /** Stand des Ersatzschlüssels (ohne Geheimnis). */
    public Map<String, Object> ersatzInfo() throws IOException {
        offen();
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("vorhanden", false);
        for (String name : ablage.liste(VERWALTUNG)) {
            if (!name.matches("ersatz-[a-f0-9]{8}\\.json")) continue;
            Map<String, Object> d = jsonLesen(ablage, VERWALTUNG + "/" + name);
            if (!id.equals(d.get("id"))) continue;
            info.put("vorhanden", true); info.put("satz", d.get("satz")); info.put("n", d.get("n")); info.put("k", d.get("k")); info.put("angelegt", d.get("angelegt"));
        }
        return info;
    }

    /** Passwort vergessen: mit genug Teilen öffnen und ein neues Passwort setzen (alte Passwort-Plätze gehen). */
    public static TresorOrdner wiederherstellen(Ablage a, String app, List<String> texte, CharSequence neuesPasswort) throws IOException {
        Fach.appPruefen(app);
        if (passwortLaenge(neuesPasswort) < MIN_PASSWORT) throw fehler("TRESOR_PASSWORT_KURZ");
        String id = kennung(a);
        List<Ersatzschluessel.Share> teile = new ArrayList<>();
        for (String t : texte) if (t != null && !t.trim().isEmpty()) teile.add(Ersatzschluessel.decode(t));
        byte[] geheim = Ersatzschluessel.combine(teile);
        try {
            String satzHex = VaultCrypto.hex(teile.get(0).set), pfad = VERWALTUNG + "/ersatz-" + satzHex + ".json";
            if (!a.gibtEs(pfad)) throw fehler("TRESOR_ERSATZ_UNBEKANNT");
            byte[] haupt = ersatzAuspacken(jsonLesen(a, pfad), id, satzHex, geheim);
            if (!MessageDigest.isEqual(pruefwert(haupt, id), unhex(Json.text(jsonLesen(a, KOPF), "pruefung")))) { Arrays.fill(haupt, (byte) 0); throw fehler("TRESOR_BESCHAEDIGT"); }
            TresorOrdner t = new TresorOrdner(a, app, id, haupt);
            try { t.passwortAendern(neuesPasswort); }
            catch (IOException e) { t.close(); throw e; }
            return t;
        } finally {
            Arrays.fill(geheim, (byte) 0);
            for (Ersatzschluessel.Share s : teile) Arrays.fill(s.data, (byte) 0);
        }
    }

    // ---------- Fächer ----------
    private static String fachPfad(Fach f) { return VERWALTUNG + "/fach-" + f.slug + ".json"; }

    public boolean fachBekannt(String slug) throws IOException { return ablage.gibtEs(fachPfad(Fach.nachSlug(slug))); }

    /**
     * Vorhandenen App-Tresor einziehen: nur dessen Datenschlüssel wird zusätzlich mit dem
     * Hauptschlüssel verpackt. Keine Datei im Fach wird gelesen, geschrieben oder gelöscht.
     */
    public void fachEinziehen(String slug, byte[] vorhandenerSchluessel) throws IOException {
        offen();
        Fach f = Fach.nachSlug(slug);
        if (f.istUebergabe() || !f.besitzer.equals(app)) throw fehler("TRESOR_FACH_FREMD");
        if (vorhandenerSchluessel == null || vorhandenerSchluessel.length != VaultCrypto.KEY) throw fehler("TRESOR_SCHLUESSEL_UNGUELTIG");
        if (ablage.gibtEs(fachPfad(f))) {
            byte[] da = fachSchluessel(slug);
            boolean gleich = MessageDigest.isEqual(da, vorhandenerSchluessel);
            Arrays.fill(da, (byte) 0);
            if (!gleich) throw fehler("TRESOR_FACH_BELEGT");
            return;
        }
        fachSchluesselSchreiben(f, vorhandenerSchluessel);
    }

    /** Fach mit neuem Schlüssel anlegen, falls es noch keinen hat (eigenes Fach oder Übergabefach). */
    public void fachAnlegen(String slug) throws IOException {
        offen();
        Fach f = Fach.nachSlug(slug);
        if (!f.darfSchreiben(app)) throw fehler("TRESOR_FACH_FREMD");
        ablage.ordner(f.ordner);
        if (ablage.gibtEs(fachPfad(f))) return;
        byte[] neu = VaultCrypto.random(VaultCrypto.KEY);
        try { fachSchluesselSchreiben(f, neu); }
        catch (IOException e) {
            // Eine andere App kann das Fach gleichzeitig angelegt haben: deren Schlüssel gilt.
            if (!"TRESOR_DATEI_DA".equals(e.getMessage())) throw e;
        } finally { Arrays.fill(neu, (byte) 0); }
    }

    private void fachSchluesselSchreiben(Fach f, byte[] schluessel) throws IOException {
        Map<String, Object> d = grund(id);
        d.put("fach", f.slug); d.put("ordner", f.ordner); d.put("eingezogenVon", app); d.put("angelegt", System.currentTimeMillis());
        try { d.put("schluessel", VaultCrypto.hex(VaultCrypto.seal(haupt, schluessel, utf8(aad(id, "fach", f.slug))))); }
        catch (GeneralSecurityException e) { throw fehler("TRESOR_NICHT_VERFUEGBAR"); }
        neuSchreiben(fachPfad(f), utf8(Json.schreiben(d)));
        fachSchluessel.remove(f.slug);
        byte[] zurueck = fachSchluessel(f.slug);
        boolean gleich = MessageDigest.isEqual(zurueck, schluessel);
        Arrays.fill(zurueck, (byte) 0);
        if (!gleich) { fachSchluessel.remove(f.slug); eigeneNeueLoeschen(fachPfad(f)); throw fehler("TRESOR_BESCHAEDIGT"); }
    }

    /** Fach-Schlüssel (Kopie) — lesen dürfen alle Apps jedes Fach. */
    public byte[] fachSchluessel(String slug) throws IOException {
        offen();
        Fach f = Fach.nachSlug(slug);
        byte[] da = fachSchluessel.get(f.slug);
        if (da != null) return da.clone();
        if (!ablage.gibtEs(fachPfad(f))) throw fehler("TRESOR_FACH_FEHLT");
        Map<String, Object> d = jsonLesen(ablage, fachPfad(f));
        grundPruefen(d, id);
        if (!f.slug.equals(d.get("fach"))) throw fehler("TRESOR_BESCHAEDIGT");
        byte[] k;
        try { k = VaultCrypto.open(haupt, unhex(Json.text(d, "schluessel")), utf8(aad(id, "fach", f.slug))); }
        catch (GeneralSecurityException e) { throw fehler("TRESOR_BESCHAEDIGT"); }
        if (k.length != VaultCrypto.KEY) throw fehler("TRESOR_BESCHAEDIGT");
        fachSchluessel.put(f.slug, k);
        return k.clone();
    }

    // ---------- Dateien im gemeinsamen Format ----------
    private static String dateiLogisch(String id, Fach f, String nr) { return aad(id, "datei", f.slug + "|" + nr); }

    /**
     * Datei verschlüsselt ins Fach legen ({@code <Fach>/<unterordner>/<uuid>.fpt}) und ins eigene
     * Inhaltsverzeichnis eintragen. Die Datei wird vor dem Eintrag vollständig zurückgelesen.
     */
    public Eintrag ablegen(String slug, String unterordner, String name, String art, long datum, InputStream daten, String auszug) throws IOException {
        offen();
        Fach f = Fach.nachSlug(slug);
        if (!f.darfSchreiben(app)) throw fehler("TRESOR_FACH_FREMD");
        fachAnlegen(slug);
        String ordner = f.ordner + (unterordner == null || unterordner.isEmpty() ? "" : "/" + DateiAblage.pruefen(unterordner));
        String nr = UUID.randomUUID().toString(), pfad = ordner + "/" + nr + ".fpt";
        ablage.ordner(ordner);
        byte[] k = fachSchluessel(slug);
        VaultCrypto.Writer w;
        boolean gut = false;
        try {
            w = schreiber(pfad, k, dateiLogisch(id, f, nr), Long.MAX_VALUE);
            try (InputStream in = daten) {
                byte[] puffer = new byte[64 * 1024]; int n;
                while ((n = in.read(puffer)) != -1) if (n > 0) w.write(puffer, 0, n);
            } finally { w.close(); }
            try (InputStream probe = leserOeffnen(pfad, k, dateiLogisch(id, f, nr))) {
                if (!w.digestHex().equals(sha256(probe))) throw fehler("TRESOR_BESCHAEDIGT");
            }
            Eintrag e = new Eintrag();
            e.id = nr; e.name = name == null || name.isEmpty() ? nr : (name.length() > Eintrag.NAME_MAX ? name.substring(0, Eintrag.NAME_MAX) : name);
            e.art = art == null ? "application/octet-stream" : art; e.datum = datum; e.groesse = w.size();
            e.auszug = Eintrag.kuerzen(auszug); e.verweis = pfad.substring(f.ordner.length() + 1); e.schreiber = app;
            e.verschluesselung = "fpt1"; e.sha256 = w.digestHex();
            e.pruefen();
            List<Eintrag> eigene = new ArrayList<>(eigenesVerzeichnis(slug));
            eigene.add(e);
            verzeichnisSchreiben(slug, eigene);
            gut = true;
            return e;
        } finally {
            Arrays.fill(k, (byte) 0);
            if (!gut) eigeneNeueLoeschen(pfad);
            else selbstAngelegt.remove(pfad);
        }
    }

    /** Datei eines Eintrags im gemeinsamen Format lesen (jedes Fach, nur lesend). */
    public InputStream oeffnen(String slug, Eintrag e) throws IOException {
        offen();
        Fach f = Fach.nachSlug(slug);
        if (!"fpt1".equals(e.verschluesselung)) throw fehler("TRESOR_NUR_IN_DER_APP");
        e.pruefen();
        String datei = e.verweis.substring(e.verweis.lastIndexOf('/') + 1);
        if (!datei.matches(UUID_MUSTER + "\\.fpt") || !datei.equals(e.id + ".fpt")) throw fehler("TRESOR_EINTRAG_UNGUELTIG");
        byte[] k = fachSchluessel(slug);
        try { return leserOeffnen(f.ordner + "/" + e.verweis, k, dateiLogisch(id, f, e.id)); }
        finally { Arrays.fill(k, (byte) 0); }
    }

    private VaultCrypto.Writer schreiber(String pfad, byte[] schluessel, String logisch, long grenze) throws IOException {
        OutputStream out = ablage.neu(pfad);
        selbstAngelegt.add(pfad);
        try { return new VaultCrypto.Writer(out, schluessel, logisch, grenze); }
        catch (IOException e) { out.close(); throw e; }
    }

    private InputStream leserOeffnen(String pfad, byte[] schluessel, String logisch) throws IOException {
        Ablage.Kanal kanal = ablage.kanal(pfad);
        final VaultCrypto.Reader r;
        try { r = new VaultCrypto.Reader(kanal.kanal, kanal.besitzer, schluessel, logisch); }
        catch (IOException e) { try { kanal.kanal.close(); } finally { if (kanal.besitzer != null) kanal.besitzer.close(); } throw e.getMessage() != null && e.getMessage().startsWith("VAULT_") ? fehler("TRESOR_BESCHAEDIGT") : e; }
        return new FilterInputStream(r.stream()) {
            @Override public int read() throws IOException { try { return super.read(); } catch (VaultCrypto.Failure x) { throw fehler("TRESOR_BESCHAEDIGT"); } }
            @Override public int read(byte[] b, int o, int l) throws IOException { try { return super.read(b, o, l); } catch (VaultCrypto.Failure x) { throw fehler("TRESOR_BESCHAEDIGT"); } }
            @Override public void close() throws IOException { r.close(); }
        };
    }

    static String sha256(InputStream in) throws IOException {
        try {
            MessageDigest d = MessageDigest.getInstance("SHA-256");
            byte[] puffer = new byte[64 * 1024]; int n;
            while ((n = in.read(puffer)) != -1) d.update(puffer, 0, n);
            return VaultCrypto.hex(d.digest());
        } catch (GeneralSecurityException e) { throw fehler("TRESOR_NICHT_VERFUEGBAR"); }
    }

    // ---------- Inhaltsverzeichnis ----------
    private static String verzeichnisOrdner(Fach f, String schreiber) { return VERWALTUNG + "/verzeichnis/" + f.slug + "/" + schreiber; }
    private static String verzeichnisLogisch(String id, Fach f, String schreiber, long rev) { return aad(id, "verzeichnis", f.slug + "|" + schreiber + "|" + rev); }

    private List<String> staende(Fach f, String schreiber) throws IOException {
        List<String> namen = new ArrayList<>();
        for (String n : ablage.liste(verzeichnisOrdner(f, schreiber))) if (n.matches("v-[0-9]{20}-" + UUID_MUSTER + "\\.fpt")) namen.add(n);
        Collections.sort(namen, Collections.reverseOrder());
        return namen;
    }

    /** Neuester Stand eines Schreibers; ein beschädigter neuester Stand wird gemeldet, nicht still übergangen. */
    private Stand standLesen(Fach f, String schreiber) throws IOException {
        List<String> namen = staende(f, schreiber);
        Stand s = new Stand();
        if (namen.isEmpty()) return s;
        String name = namen.get(0);
        long rev = Long.parseLong(name.substring(2, 22));
        byte[] k = fachSchluessel(f.slug);
        byte[] roh;
        try (InputStream in = leserOeffnen(verzeichnisOrdner(f, schreiber) + "/" + name, k, verzeichnisLogisch(id, f, schreiber, rev))) {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            byte[] puffer = new byte[8192]; int n;
            while ((n = in.read(puffer)) != -1) { if (out.size() + n > VERZEICHNIS_MAX) throw fehler("TRESOR_BESCHAEDIGT"); out.write(puffer, 0, n); }
            roh = out.toByteArray();
        } finally { Arrays.fill(k, (byte) 0); }
        Map<String, Object> d = Json.objekt(new String(roh, StandardCharsets.UTF_8));
        grundPruefen(d, id);
        if (!f.slug.equals(d.get("fach")) || !schreiber.equals(d.get("schreiber")) || Json.zahl(d, "revision") != rev) throw fehler("TRESOR_BESCHAEDIGT");
        Object liste = d.get("eintraege");
        if (!(liste instanceof List)) throw fehler("TRESOR_BESCHAEDIGT");
        for (Object o : (List<?>) liste) {
            if (!(o instanceof Map)) throw fehler("TRESOR_BESCHAEDIGT");
            @SuppressWarnings("unchecked") Eintrag e = Eintrag.ausMap((Map<String, Object>) o);
            if (!schreiber.equals(e.schreiber)) throw fehler("TRESOR_BESCHAEDIGT");
            s.eintraege.add(e);
        }
        s.revision = rev;
        return s;
    }
    private static final class Stand { long revision; final List<Eintrag> eintraege = new ArrayList<>(); }

    /** Was diese App selbst in das Fach eingetragen hat. */
    public List<Eintrag> eigenesVerzeichnis(String slug) throws IOException {
        offen();
        Fach f = Fach.nachSlug(slug);
        if (!fachBekannt(slug)) return new ArrayList<>();
        return standLesen(f, app).eintraege;
    }

    /** Ganzes Inhaltsverzeichnis eines Fachs: die Stände aller Schreiber zusammen (lesen dürfen alle). */
    public List<Eintrag> verzeichnis(String slug) throws IOException {
        offen();
        Fach f = Fach.nachSlug(slug);
        List<Eintrag> alle = new ArrayList<>();
        if (!fachBekannt(slug)) return alle;
        for (String schreiber : Fach.APPS) if (ablage.istOrdner(verzeichnisOrdner(f, schreiber))) alle.addAll(standLesen(f, schreiber).eintraege);
        return alle;
    }

    /**
     * Eigenes Inhaltsverzeichnis für ein Fach ersetzen (z. B. Private Brain aus seinem Katalog).
     * Neuer Stand wird geschrieben und zurückgelesen; die ältesten eigenen Stände über drei verschwinden.
     */
    public void verzeichnisSchreiben(String slug, List<Eintrag> eintraege) throws IOException {
        offen();
        Fach f = Fach.nachSlug(slug);
        if (!f.darfSchreiben(app)) throw fehler("TRESOR_FACH_FREMD");
        if (!fachBekannt(slug)) throw fehler("TRESOR_FACH_FEHLT");
        List<Object> liste = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (Eintrag e : eintraege) {
            if (!app.equals(e.schreiber)) throw fehler("TRESOR_EINTRAG_UNGUELTIG");
            e.pruefen();
            if (!ids.add(e.id)) throw fehler("TRESOR_EINTRAG_DOPPELT");
            liste.add(e.alsMap());
        }
        long rev = Math.addExact(standLesen(f, app).revision, 1);
        Map<String, Object> d = grund(id);
        d.put("fach", f.slug); d.put("schreiber", app); d.put("revision", rev); d.put("geschrieben", System.currentTimeMillis()); d.put("eintraege", liste);
        byte[] roh = utf8(Json.schreiben(d));
        String ordner = verzeichnisOrdner(f, app), pfad = ordner + "/v-" + String.format(Locale.ROOT, "%020d", rev) + "-" + UUID.randomUUID() + ".fpt";
        ablage.ordner(ordner);
        byte[] k = fachSchluessel(slug);
        boolean gut = false;
        try {
            VaultCrypto.Writer w = schreiber(pfad, k, verzeichnisLogisch(id, f, app, rev), VERZEICHNIS_MAX);
            try { w.write(roh); } finally { w.close(); }
            try (InputStream probe = leserOeffnen(pfad, k, verzeichnisLogisch(id, f, app, rev))) {
                if (!VaultCrypto.hex(sha(roh)).equals(sha256(probe))) throw fehler("TRESOR_BESCHAEDIGT");
            }
            gut = true;
        } finally {
            Arrays.fill(k, (byte) 0);
            if (!gut) eigeneNeueLoeschen(pfad); else selbstAngelegt.remove(pfad);
        }
        List<String> namen = staende(f, app);
        for (int i = BEHALTENE_STAENDE; i < namen.size(); i++) {
            try { verwaltungLoeschen(ordner + "/" + namen.get(i)); } catch (IOException bleibt) { /* ältere Stände bleiben dann liegen */ }
        }
    }

    private static byte[] sha(byte[] daten) throws IOException {
        try { return MessageDigest.getInstance("SHA-256").digest(daten); }
        catch (GeneralSecurityException e) { throw fehler("TRESOR_NICHT_VERFUEGBAR"); }
    }

    // ---------- „übernommen“-Marken ----------
    private String markenOrdner() { return VERWALTUNG + "/marken/" + app; }

    /** Marke „übernommen“ für einen Eintrag eines Fachs — die Datei im Fach bleibt, wie sie ist. */
    public void markeSetzen(String slug, String eintragId) throws IOException {
        offen();
        Fach f = Fach.nachSlug(slug);
        if (eintragId == null || !eintragId.matches("[A-Za-z0-9._-]{1,80}")) throw fehler("TRESOR_EINTRAG_UNGUELTIG");
        String pfad = markenOrdner() + "/" + f.slug + "--" + eintragId + ".json";
        if (ablage.gibtEs(pfad)) return;
        ablage.ordner(markenOrdner());
        Map<String, Object> m = grund(id);
        m.put("fach", f.slug); m.put("eintrag", eintragId); m.put("app", app); m.put("am", System.currentTimeMillis());
        try { neuSchreiben(pfad, utf8(Json.schreiben(m))); selbstAngelegt.remove(pfad); }
        catch (IOException e) { if (!"TRESOR_DATEI_DA".equals(e.getMessage())) throw e; }
    }

    /** Eintrags-Kennungen, die diese App in einem Fach als übernommen markiert hat. */
    public Set<String> marken(String slug) throws IOException {
        offen();
        Fach f = Fach.nachSlug(slug);
        Set<String> aus = new HashSet<>();
        String vorsilbe = f.slug + "--";
        for (String n : ablage.liste(markenOrdner()))
            if (n.startsWith(vorsilbe) && n.endsWith(".json")) aus.add(n.substring(vorsilbe.length(), n.length() - 5));
        return aus;
    }

    // ---------- Überblick ----------
    /** Alle Fächer mit Ordner, ob bekannt, ob diese App schreiben darf, und die Zahl der Einträge. */
    public List<Map<String, Object>> faecher() throws IOException {
        offen();
        List<Map<String, Object>> aus = new ArrayList<>();
        for (Fach f : Fach.ALLE) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("fach", f.slug); m.put("ordner", f.ordner); m.put("uebergabe", f.istUebergabe());
            m.put("bekannt", fachBekannt(f.slug)); m.put("schreiben", f.darfSchreiben(app));
            m.put("ordnerDa", ablage.istOrdner(f.ordner));
            aus.add(m);
        }
        return aus;
    }

    public String id() { return id; }
    public String app() { return app; }

    /** Kopie des Hauptschlüssels, damit die App ihn im Keystore merken kann. Nie speichern, nie senden. */
    public byte[] hauptschluesselKopie() throws IOException { offen(); return haupt.clone(); }

    @Override public void close() {
        if (haupt != null) Arrays.fill(haupt, (byte) 0);
        haupt = null;
        for (byte[] k : fachSchluessel.values()) Arrays.fill(k, (byte) 0);
        fachSchluessel.clear();
    }
}
