package de.familyprojekt.tresor;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;

/** Ausgewählte Originaldateien im vorhandenen FPT1-Format. Keine eigene Verschlüsselung,
 * kein Löschen und keine automatische Übernahme ins app-eigene Archiv. */
public final class Uebergaben {
    public static final int MAX_BYTES = 20 * 1024 * 1024;
    public static final String VERTRAG = "familienakte-uebergabe/1";
    private final TresorOrdner tresor;
    public Uebergaben(TresorOrdner tresor) { this.tresor = tresor; }
    public static Fach eingang(String app) throws IOException {
        if (Fach.FAMILIENAKTE_APP.equals(app)) return Fach.EINGANG_FAMILIENAKTE;
        if (Fach.PRIVATE_BRAIN_APP.equals(app)) return Fach.EINGANG_PRIVATE_BRAIN;
        if (Fach.WORKFLOW_PDF_APP.equals(app)) return Fach.EINGANG_WORKFLOW_PDF;
        if (Fach.BOOKLEDGER_APP.equals(app)) return Fach.EINGANG_BOOKLEDGER;
        throw new IOException("TRESOR_UEBERGABE_ZIEL_UNBEKANNT");
    }
    private static void kennung(String id) throws IOException {
        if (id == null || !id.matches("[A-Za-z0-9_.-]{1,160}") || id.equals(".") || id.equals("..")) throw new IOException("TRESOR_UEBERGABE_KENNUNG");
    }
    private static void dokumentKennung(String id) throws IOException {
        // BookLedgerPro benutzt z. B. beleg:datum:kennung. Dies ist Metadatum, kein Dateipfad.
        if(id==null || !id.matches("[A-Za-z0-9_.:-]{1,200}")) throw new IOException("TRESOR_UEBERGABE_KENNUNG");
    }
    private static String sha(byte[] bytes) throws IOException {
        try { return VaultCrypto.hex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IOException(e); }
    }
    private static byte[] begrenzt(InputStream in) throws IOException {
        if(in==null) throw new IOException("TRESOR_UEBERGABE_FEHLT");
        try (InputStream quelle = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] puffer = new byte[65536]; int n;
            while ((n=quelle.read(puffer))!=-1) { if(n>MAX_BYTES-out.size()) throw new IOException("TRESOR_UEBERGABE_ZU_GROSS"); out.write(puffer,0,n); }
            return out.toByteArray();
        }
    }
    private Map<String,Object> metadaten(String ziel, String id, String dokumentId, String bezug) throws IOException {
        kennung(id); dokumentKennung(dokumentId); if(bezug!=null&&!bezug.isEmpty()) kennung(bezug);
        Map<String,Object> m=new LinkedHashMap<>(); m.put("vertrag",VERTRAG); m.put("id",id); m.put("quelle",tresor.app()); m.put("ziel",ziel); m.put("dokumentId",dokumentId);
        if(bezug!=null&&!bezug.isEmpty()) m.put("bezug",bezug);
        return m;
    }
    private Map<String,Object> vertrag(Fach fach, Eintrag e) throws IOException {
        Map<String,Object> m;
        try { m=Json.objekt(e.auszug); }
        catch(Exception kaputt) { throw new IOException("TRESOR_UEBERGABE_VERTRAG"); }
        kennung(Json.text(m,"id")); dokumentKennung(Json.text(m,"dokumentId"));
        if(!VERTRAG.equals(Json.text(m,"vertrag")) || !e.schreiber.equals(Json.text(m,"quelle")) || !fach.empfaenger.equals(Json.text(m,"ziel")) || !"fpt1".equals(e.verschluesselung)) throw new IOException("TRESOR_UEBERGABE_VERTRAG");
        Map<String,Object> aus=new LinkedHashMap<>(m);
        aus.put("name",e.name); aus.put("mime",e.art); aus.put("groesse",e.groesse); aus.put("sha256",e.sha256);
        return aus;
    }
    /** Stabile ID bezeichnet genau eine Fassung. Bearbeitung braucht neue ID mit Bezug. */
    public synchronized Eintrag senden(String ziel, String id, String dokumentId, String bezug, String name, String mime, InputStream quelle) throws IOException {
        Fach fach=eingang(ziel);
        String meta=Json.schreiben(metadaten(ziel,id,dokumentId,bezug));
        if(meta.length()>Eintrag.AUSZUG_MAX || name==null || name.isEmpty() || name.length()>Eintrag.NAME_MAX || mime==null || mime.length()>200) throw new IOException("TRESOR_UEBERGABE_VERTRAG");
        byte[] bytes=begrenzt(quelle); String summe=sha(bytes);
        String pfad="Uebergaben/"+id+"/";
        for(Eintrag e:tresor.eigenesVerzeichnis(fach.slug)) if(e.verweis.startsWith(pfad)) {
            if(!meta.equals(e.auszug) || !name.equals(e.name) || !mime.equals(e.art) || bytes.length!=e.groesse || !summe.equals(e.sha256)) throw new IOException("TRESOR_UEBERGABE_KONFLIKT");
            pruefeBytes(fach,e); return e;
        }
        return tresor.ablegen(fach.slug,pfad.substring(0,pfad.length()-1),name,mime,0,new ByteArrayInputStream(bytes),meta);
    }
    private Eintrag finden(Fach fach,String id) throws IOException {
        for(Eintrag e:tresor.verzeichnis(fach.slug)) if(e.id.equals(id)) return e;
        throw new IOException("TRESOR_UEBERGABE_FEHLT");
    }
    private byte[] pruefeBytes(Fach fach,Eintrag e) throws IOException {
        if(e.groesse>MAX_BYTES) throw new IOException("TRESOR_UEBERGABE_ZU_GROSS");
        byte[] bytes=begrenzt(tresor.oeffnen(fach.slug,e));
        if(bytes.length!=e.groesse || !sha(bytes).equals(e.sha256)) throw new IOException("TRESOR_UEBERGABE_PRUEFSUMME");
        return bytes;
    }
    /** Kleine Liste, keine Sammlung sämtlicher Originalbytes im Arbeitsspeicher. */
    public synchronized List<Map<String,Object>> offen() throws IOException {
        Fach fach=eingang(tresor.app()); List<Map<String,Object>> aus=new ArrayList<>();
        java.util.Set<String> marken=tresor.marken(fach.slug);
        for(Eintrag e:tresor.verzeichnis(fach.slug)) {
            if(marken.contains(e.id)) continue;
            Map<String,Object> m=new LinkedHashMap<>(); m.put("entryId",e.id);
            try { m.put("vertrag",vertrag(fach,e)); if(e.groesse>MAX_BYTES) throw new IOException("TRESOR_UEBERGABE_ZU_GROSS"); }
            catch(IOException falsch) { m.put("fehler",falsch.getMessage()); }
            aus.add(m);
        }
        return aus;
    }
    public synchronized Map<String,Object> beschreibung(String eintragId) throws IOException {
        Fach fach=eingang(tresor.app()); return vertrag(fach,finden(fach,eintragId));
    }
    public synchronized byte[] lesen(String eintragId) throws IOException {
        Fach fach=eingang(tresor.app()); Eintrag e=finden(fach,eintragId); vertrag(fach,e); return pruefeBytes(fach,e);
    }
    /** Erst aufrufen, nachdem die aufnehmende App Datei UND Eingangsdatensatz dauerhaft quittiert hat. */
    public synchronized void quittieren(String eintragId,String erwarteteSumme) throws IOException {
        Fach fach=eingang(tresor.app()); Eintrag e=finden(fach,eintragId); vertrag(fach,e);
        if(!e.sha256.equals(erwarteteSumme)) throw new IOException("TRESOR_UEBERGABE_PRUEFSUMME");
        pruefeBytes(fach,e); tresor.markeSetzen(fach.slug,e.id);
    }
    public synchronized boolean bestaetigt(String ziel,String eintragId) throws IOException {
        Fach fach=eingang(ziel); Eintrag e=finden(fach,eintragId); vertrag(fach,e);
        if(!tresor.app().equals(e.schreiber)) throw new IOException("TRESOR_UEBERGABE_FREMD");
        return tresor.marken(fach.slug,ziel).contains(e.id);
    }
}
