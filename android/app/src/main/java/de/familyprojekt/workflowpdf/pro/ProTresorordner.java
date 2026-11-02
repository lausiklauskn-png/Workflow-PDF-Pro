package de.familyprojekt.workflowpdf.pro;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import de.familyprojekt.tresor.Eintrag;
import de.familyprojekt.tresor.Fach;
import de.familyprojekt.tresor.SafAblage;
import de.familyprojekt.tresor.TresorOrdner;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Geräteseite des gemeinsamen Tresorordners für Workflow PDF Pro (Schritt D1). Merkt die Ordnerfreigabe und auf Wunsch
 * den Hauptschlüssel (Android-Schlüsselspeicher). Die Ordnerschicht ist das byte-gleiche Paket de.familyprojekt.tresor,
 * die Regeln des Einzugs stehen in {@link TresorEinzug}. Alle Aufrufe laufen über den einen Arbeits-Thread von WorkflowVault.
 */
final class ProTresorordner {
    private static final String PREFS = "workflow-tresorordner-v1", ALIAS = "workflow-pdf-pro-tresorordner-merken-v1";
    private final Context context;
    private SafAblage ablage;
    private TresorOrdner offen;
    // Von Hand gesperrt (Tablet-Probe 2026-10-28: „Sperren“ öffnete sofort wieder, weil zustand() den gemerkten Schlüssel nahm).
    // Bis zum nächsten Entsperren von Hand oder App-Neustart öffnet der gemerkte Schlüssel nicht von selbst.
    private boolean vonHandGesperrt;

    ProTresorordner(Context context) { this.context = context.getApplicationContext(); }

    private SharedPreferences prefs() { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    boolean gewaehlt() { return prefs().contains("baum"); }
    /** Ganzer Pfad des Tresorordners im Speicher (Leitfaden § 5). */
    String pfad() {
        String b = prefs().getString("baum", null); if (b == null) return "";
        try { String id = android.provider.DocumentsContract.getTreeDocumentId(Uri.parse(b)); return id.contains(":") ? id.substring(id.indexOf(':') + 1) : id; }
        catch (Exception e) { return ""; }
    }
    String speicher() {
        String b = prefs().getString("baum", null); if (b == null) return "";
        try { String id = android.provider.DocumentsContract.getTreeDocumentId(Uri.parse(b)); return id.startsWith("primary:") ? "geraet" : id.contains(":") ? "karte" : ""; }
        catch (Exception e) { return ""; }
    }
    /** Dokument-Adresse des Tresorordners für „In Dateien öffnen“; null ohne gewählten Ordner. */
    Uri ordnerUri() {
        String b = prefs().getString("baum", null); if (b == null) return null;
        Uri t = Uri.parse(b); return android.provider.DocumentsContract.buildDocumentUriUsingTree(t, android.provider.DocumentsContract.getTreeDocumentId(t));
    }
    boolean istOffen() { return offen != null; }
    /** Der Nutzer will ausdrücklich entsperren oder einziehen: der gemerkte Schlüssel darf wieder öffnen. */
    void entsperrenGewuenscht() { vonHandGesperrt = false; }

    private SafAblage ablage() throws IOException {
        if (ablage != null) return ablage;
        String baum = prefs().getString("baum", null);
        if (baum == null) throw new IOException("TRESOR_KEIN_ORDNER");
        ablage = new SafAblage(context.getContentResolver(), Uri.parse(baum));
        return ablage;
    }

    /** Prüft einen frisch gewählten Ordner, ohne ihn zu übernehmen. */
    String pruefen(Uri baum, String tresorId) throws IOException {
        return TresorEinzug.pruefen(new SafAblage(context.getContentResolver(), baum), tresorId);
    }

    void pruefenVerbindung(Uri baum) throws IOException {
        SafAblage a=new SafAblage(context.getContentResolver(),baum);
        if(!TresorOrdner.vorhanden(a))throw new IOException("TRESOR_NICHT_VORHANDEN");
        TresorOrdner.kennung(a);
        if(a.gibtEs(de.familyprojekt.tresor.Umzug.VERMERK))throw new IOException("TRESOR_UMGEZOGEN");
    }

    void baumSetzen(Uri baum) throws IOException {
        schliessen();
        String name = baum.getLastPathSegment() == null ? "" : baum.getLastPathSegment();
        if (name.contains(":")) name = name.substring(name.indexOf(':') + 1);
        // Ein anderer Ordner: ein gemerkter Schlüssel gehört zum alten und wird vergessen.
        SafAblage a=new SafAblage(context.getContentResolver(),baum);
        String id=TresorOrdner.vorhanden(a)?TresorOrdner.kennung(a):null;
        if (!prefs().edit().putString("baum", baum.toString()).putString("name", name).putString("ordnerKennung",id).remove("merken").remove("kennung").commit()) throw new IOException("TRESOR_NICHT_VERFUEGBAR");
        ablage = null;
    }

    boolean vorhanden() throws IOException { return TresorOrdner.vorhanden(ablage()); }

    /** Passt der gespeicherte Ordner (noch) zum entsperrten App-Tresor? */
    String pruefung(String tresorId) throws IOException { return TresorEinzug.pruefen(ablage(), tresorId); }

    /** Gemerkten Hauptschlüssel benutzen, falls vorhanden und passend. */
    boolean gemerktEntsperren() {
        if(vonHandGesperrt)return false;
        if (offen != null) return true;
        if (!prefs().contains("merken")) return false;
        byte[] haupt = null;
        try {
            SafAblage a = ablage();
            pruefeKennung();
            String id = TresorOrdner.kennung(a);
            if (!id.equals(prefs().getString("kennung", ""))) return false;
            byte[] wert = Base64.decode(prefs().getString("merken", ""), Base64.NO_WRAP);
            SecretKey k = geraeteSchluessel(false);
            if (k == null || wert.length != 12 + 32 + 16) return false;
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(128, wert, 0, 12));
            c.updateAAD(geraetAad(id));
            haupt = c.doFinal(wert, 12, wert.length - 12);
            offen = TresorOrdner.mitHauptschluessel(a, TresorEinzug.APP, haupt);
            return true;
        } catch (Exception e) {
            offen = null; // passt nicht mehr (Passwort/Ersatz neu, anderer Ordner): von Hand entsperren
            return false;
        } finally { if (haupt != null) Arrays.fill(haupt, (byte) 0); }
    }

    /** Mit Passwort anlegen oder öffnen, dann den App-Tresor einziehen. */
    void mitPasswort(CharSequence passwort, boolean anlegen, boolean merken, DocumentVault vault) throws Exception {
        mitPasswort(passwort,anlegen,merken,vault,false);
    }
    void mitPasswort(CharSequence passwort, boolean anlegen, boolean merken, DocumentVault vault,boolean nurVerbinden) throws Exception {
        if(nurVerbinden){if(anlegen)throw new IOException("TRESOR_NICHT_VORHANDEN");pruefeKennung();}
        else if (!"PASST".equals(pruefung(vault.identity()))) throw new IOException("TRESOR_ORDNER_PASST_NICHT");
        TresorOrdner t = anlegen ? TresorOrdner.anlegen(ablage(), TresorEinzug.APP, passwort) : TresorOrdner.oeffnen(ablage(), TresorEinzug.APP, passwort);
        if(!prefs().edit().putString("ordnerKennung",t.id()).commit()){t.close();throw new IOException("TRESOR_NICHT_VERFUEGBAR");}
        schliessen();
        vonHandGesperrt = false;
        offen = t;
        if (merken) merken(t);
        else if(!prefs().edit().remove("merken").remove("kennung").commit())throw new IOException("TRESOR_NICHT_VERFUEGBAR");
        if(!nurVerbinden)einziehen(vault);
    }

    /** Einzug bei offenem Tresorordner (wiederholt ist kein Fehler; fremder Schlüssel im Fach: TRESOR_FACH_BELEGT). */
    void einziehen(DocumentVault vault) throws Exception {
        offenOderGemerkt();
        if (!"PASST".equals(pruefung(vault.identity()))) throw new IOException("TRESOR_ORDNER_PASST_NICHT");
        byte[] k = vault.tresorSchluessel();
        try { TresorEinzug.einziehen(offen, k); } finally { Arrays.fill(k, (byte) 0); }
    }

    JSONObject zustand(DocumentVault vault) throws Exception {
        SharedPreferences p = prefs();
        JSONObject z = new JSONObject().put("gewaehlt", p.contains("baum")).put("ordner", p.getString("name", "")).put("pfad", pfad()).put("speicher", speicher()).put("gemerkt", p.contains("merken"));
        z.put("offen", offen != null).put("eingezogen", false).put("uebergaben",true);
        if (!p.contains("baum")) return z;
        try {
            SafAblage a = ablage();
            boolean da = TresorOrdner.vorhanden(a);
            z.put("erreichbar", true).put("vorhanden", da);
            if (vault != null && vault.configured()) z.put("pruefung", TresorEinzug.pruefen(a, vault.identity()));
            if (da) { pruefeKennung();z.put("kennung", TresorOrdner.kennung(a)); if (!vonHandGesperrt) gemerktEntsperren(); }
            else schliessen();
            z.put("offen", offen != null);
            if (offen != null) {
                z.put("eingezogen", TresorEinzug.eingezogen(offen));
                z.put("eintraege", TresorEinzug.eingezogen(offen) ? offen.eigenesVerzeichnis(TresorEinzug.FACH).size() : 0);
            }
        } catch (IOException e) { schliessen();z.put("offen",false).put("erreichbar", false).put("problem", e.getMessage()); }
        return z;
    }

    /** Inhaltsverzeichnis des eigenen Fachs aus den Zeilen der Bibliothek (nur bei Änderung neu). */
    JSONObject verzeichnis(JSONArray zeilen, DocumentVault vault) throws Exception {
        offenOderGemerkt();
        if (!TresorEinzug.eingezogen(offen)) throw new IOException("TRESOR_FACH_FEHLT");
        if (vault != null && !"PASST".equals(pruefung(vault.identity()))) throw new IOException("TRESOR_ORDNER_PASST_NICHT");
        List<Map<String, Object>> roh = new ArrayList<>();
        for (int i = 0; i < zeilen.length(); i++) roh.add(map(zeilen.getJSONObject(i)));
        List<Eintrag> neu = TresorEinzug.eintraege(roh);
        boolean geschrieben = TresorEinzug.schreibenWennGeaendert(offen, neu);
        return new JSONObject().put("geschrieben", geschrieben).put("eintraege", neu.size());
    }

    private static Map<String, Object> map(JSONObject o) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (Iterator<String> k = o.keys(); k.hasNext(); ) {
            String s = k.next(); Object v = o.opt(s);
            if (v instanceof Number) v = ((Number) v).longValue();
            if (v instanceof String || v instanceof Long) m.put(s, v);
        }
        return m;
    }

    void sperren(boolean vergessen) throws IOException {
        schliessen();
        vonHandGesperrt = true;
        if (vergessen&&!prefs().edit().remove("merken").remove("kennung").commit())throw new IOException("TRESOR_NICHT_VERFUEGBAR");
    }

    void schliessen() {
        for (java.io.InputStream in : lesen.values()) try { in.close(); } catch (IOException ignoriert) { /* zu */ }
        lesen.clear();
        if (offen != null) offen.close(); offen = null;
    }

    // ---------- Übergabefach „Eingang-WorkflowPDF“ (Pro-Umbau 5): was andere Pro-Apps hier ablegen ----------
    // Gelesen wird nur; im Fach wird nichts gelöscht. „Übernommen“ ist eine eigene Marke (TresorOrdner.markeSetzen).
    private static final String EINGANG = Fach.EINGANG_WORKFLOW_PDF.slug;
    private static final int TEIL = 192 * 1024;
    private final Map<String, java.io.InputStream> lesen = new LinkedHashMap<>();
    private TresorOrdner offenOderGemerkt() throws IOException {
        try {pruefeKennung();}catch(IOException error){schliessen();throw error;}
        if (offen == null && (vonHandGesperrt || !gemerktEntsperren())) throw new IOException("TRESOR_GESPERRT");
        return offen;
    }
    private void pruefeKennung()throws IOException {
        String actual=TresorOrdner.kennung(ablage());
        String expected=prefs().getString("ordnerKennung",prefs().getString("kennung",null));
        if(expected!=null&&!expected.equals(actual)||offen!=null&&!offen.id().equals(actual))throw new IOException("TRESOR_FREMDE_KENNUNG");
        if(ablage().gibtEs(de.familyprojekt.tresor.Umzug.VERMERK))throw new IOException("TRESOR_UMGEZOGEN");
    }
    JSONObject uebergabe(JSONObject args)throws Exception {
        return new JSONObject(de.familyprojekt.tresor.Json.schreiben(ProVerbund.call(offenOderGemerkt(),de.familyprojekt.tresor.Json.objekt(args.toString()))));
    }
    /** Inhaltsverzeichnis eines Fachs lesen (Pro-Umbau 12, „Überall suchen“): nur die Zeilen (Name, Art, Datum, Kurzfassung), nie Dateien. */
    JSONObject fachLesen(String slug) throws Exception {
        TresorOrdner t = offenOderGemerkt();
        Fach.nachSlug(slug); // unbekanntes Fach: IOException
        JSONArray liste = new JSONArray();
        for (Eintrag e : t.verzeichnis(slug)) liste.put(new JSONObject(e.alsMap()));
        return new JSONObject().put("fach", slug).put("eintraege", liste);
    }
    JSONObject eingang() throws Exception {
        TresorOrdner t = offenOderGemerkt();
        JSONArray liste = new JSONArray(), marken = new JSONArray();
        for (Eintrag e : t.verzeichnis(EINGANG)) liste.put(new JSONObject(e.alsMap()));
        for (String m : t.marken(EINGANG)) marken.put(m);
        return new JSONObject().put("ordner", Fach.EINGANG_WORKFLOW_PDF.ordner).put("eintraege", liste).put("marken", marken);
    }
    JSONObject eingangOeffnen(String id) throws Exception {
        TresorOrdner t = offenOderGemerkt();
        Eintrag gefunden = null;
        for (Eintrag e : t.verzeichnis(EINGANG)) if (e.id.equals(id)) gefunden = e;
        if (gefunden == null) throw new IOException("TRESOR_EINTRAG_FEHLT");
        String ticket = java.util.UUID.randomUUID().toString();
        lesen.put(ticket, t.oeffnen(EINGANG, gefunden));
        return new JSONObject().put("ticket", ticket).put("groesse", gefunden.groesse).put("name", gefunden.name).put("art", gefunden.art);
    }
    JSONObject eingangTeil(String ticket) throws Exception {
        java.io.InputStream in = lesen.get(ticket);
        if (in == null) throw new IOException("TRESOR_UEBERGABE_UNGUELTIG");
        try {
            byte[] puffer = new byte[TEIL]; int n = 0, r;
            while (n < puffer.length && (r = in.read(puffer, n, puffer.length - n)) != -1) n += r;
            boolean fertig = n < puffer.length;
            if (fertig) { lesen.remove(ticket); in.close(); }
            return new JSONObject().put("data", Base64.encodeToString(puffer, 0, n, Base64.NO_WRAP)).put("fertig", fertig);
        } catch (IOException e) { lesen.remove(ticket); try { in.close(); } catch (IOException ignoriert) { /* zu */ } throw e; }
    }
    void eingangAbbrechen(String ticket)throws IOException {
        java.io.InputStream in=lesen.remove(ticket);if(in!=null)in.close();
    }
    void eingangMarkieren(String id,String vaultId,String expectedHash) throws Exception {
        TresorOrdner t=offenOderGemerkt();
        if(!t.id().equals(vaultId))throw new IOException("TRESOR_UEBERGABE_FREMD");
        Eintrag found=null;for(Eintrag e:t.verzeichnis(EINGANG))if(e.id.equals(id))found=e;
        if(found==null||!found.sha256.equals(expectedHash))throw new IOException("TRESOR_UEBERGABE_PRUEFSUMME");
        java.security.MessageDigest digest=java.security.MessageDigest.getInstance("SHA-256");long size=0;
        try(java.io.InputStream in=t.oeffnen(EINGANG,found)){
            byte[] part=new byte[65536];int n;
            while((n=in.read(part))!=-1){size+=n;if(size>de.familyprojekt.tresor.Uebergaben.MAX_BYTES)throw new IOException("TRESOR_UEBERGABE_ZU_GROSS");digest.update(part,0,n);}
        }
        StringBuilder hash=new StringBuilder();for(byte b:digest.digest())hash.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
        if(size!=found.groesse||!hash.toString().equals(expectedHash))throw new IOException("TRESOR_UEBERGABE_PRUEFSUMME");
        t.markeSetzen(EINGANG,id);
    }

    // ---------- Hauptschlüssel im Android-Schlüsselspeicher (wie BookLedgerPro, eigener Alias) ----------
    private SecretKey geraeteSchluessel(boolean anlegen) throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if (ks.containsAlias(ALIAS)) return (SecretKey) ks.getKey(ALIAS, null);
        if (!anlegen) return null;
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
        return g.generateKey();
    }
    private static byte[] geraetAad(String id) { return ("familyprojekt-tresorordner|" + id + "|geraet|" + TresorEinzug.APP).getBytes(StandardCharsets.UTF_8); }
    private void merken(TresorOrdner t) throws Exception {
        byte[] haupt = t.hauptschluesselKopie();
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, geraeteSchluessel(true));
            c.updateAAD(geraetAad(t.id()));
            byte[] zu = c.doFinal(haupt), wert = new byte[12 + zu.length];
            System.arraycopy(c.getIV(), 0, wert, 0, 12); System.arraycopy(zu, 0, wert, 12, zu.length);
            if (!prefs().edit().putString("merken", Base64.encodeToString(wert, Base64.NO_WRAP)).putString("kennung", t.id()).commit()) throw new IOException("TRESOR_NICHT_VERFUEGBAR");
        } finally { Arrays.fill(haupt, (byte) 0); }
    }
}
