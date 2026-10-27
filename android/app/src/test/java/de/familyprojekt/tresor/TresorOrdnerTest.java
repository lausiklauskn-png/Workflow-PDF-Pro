package de.familyprojekt.tresor;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.TreeMap;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 * Gemeinsamer Tresorordner mit gestelltem Ordner (java.io.File). Gegenproben aus dem Brief:
 * falsches Passwort ändert nichts · Ersatzschlüssel öffnet · fremdes Fach lesbar, nie gelöscht ·
 * Umzug eines vorhandenen Tresors lässt jede Datei byte-gleich.
 */
public final class TresorOrdnerTest {
    static final String PW = "richtig-langes-Passwort-Ä", PW2 = "noch-ein-anderes-Passwort";

    static File neuerOrdner() throws IOException { File d = Files.createTempDirectory("tresorordner").toFile(); d.deleteOnExit(); return d; }

    /** Jede Datei mit SHA-256 — der Fingerabdruck eines Ordners. */
    static Map<String, String> baum(File wurzel, String unter) throws Exception {
        Map<String, String> aus = new TreeMap<>();
        File start = unter.isEmpty() ? wurzel : new File(wurzel, unter);
        sammeln(start, unter, aus);
        return aus;
    }
    private static void sammeln(File f, String pfad, Map<String, String> aus) throws Exception {
        if (f.isDirectory()) {
            aus.put(pfad + "/", "ordner");
            String[] namen = f.list(); Arrays.sort(namen);
            for (String n : namen) sammeln(new File(f, n), pfad.isEmpty() ? n : pfad + "/" + n, aus);
        } else aus.put(pfad, VaultCrypto.hex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(f.toPath()))));
    }

    static String code(ThrowingRunnable r) {
        try { r.run(); return "kein Fehler"; } catch (IOException e) { return e.getMessage(); } catch (Exception e) { return e.toString(); }
    }
    interface ThrowingRunnable { void run() throws Exception; }

    static byte[] alles(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (InputStream i = in) { byte[] b = new byte[7000]; int n; while ((n = i.read(b)) != -1) out.write(b, 0, n); }
        return out.toByteArray();
    }

    /** Ablage, die jedes Löschen mitschreibt. */
    static final class Mitschrift implements Ablage {
        final Ablage innen; final List<String> geloescht = new ArrayList<>();
        Mitschrift(Ablage innen) { this.innen = innen; }
        public List<String> liste(String o) throws IOException { return innen.liste(o); }
        public boolean gibtEs(String p) throws IOException { return innen.gibtEs(p); }
        public boolean istOrdner(String p) throws IOException { return innen.istOrdner(p); }
        public void ordner(String p) throws IOException { innen.ordner(p); }
        public byte[] lesen(String p, int g) throws IOException { return innen.lesen(p, g); }
        public OutputStream neu(String p) throws IOException { return innen.neu(p); }
        public Kanal kanal(String p) throws IOException { return innen.kanal(p); }
        public long groesse(String p) throws IOException { return innen.groesse(p); }
        public void loeschen(String p) throws IOException { geloescht.add(p); innen.loeschen(p); }
    }

    /** Wie Private Brain Pro heute: Ordner „Private Brain“ mit eigenem Kopf und PBV1-Dateien. */
    static byte[] privateBrainNachstellen(File wurzel) throws Exception {
        byte[] daten = VaultCrypto.random(32);
        File pb = new File(wurzel, "Private Brain"); new File(pb, "Mails").mkdirs(); new File(pb, "Originale").mkdirs();
        Files.write(new File(pb, "tresor.json").toPath(), "{\"format\":\"private-brain-vault\",\"version\":1,\"id\":\"x\"}".getBytes(StandardCharsets.UTF_8));
        Random r = new Random(5);
        for (String name : new String[] {"Mails/3f2a", "Originale/9b1c", "Originale/77de"}) {
            byte[] plain = new byte[100_000 + r.nextInt(400_000)]; r.nextBytes(plain);
            try (VaultCrypto.Writer w = new VaultCrypto.Writer(new java.io.FileOutputStream(new File(pb, name)), daten, "pb|" + name, Long.MAX_VALUE)) { w.write(plain); }
        }
        return daten;
    }

    @Test public void falschesPasswortAendertNichtsUndRichtigesOeffnet() throws Exception {
        File d = neuerOrdner(); DateiAblage a = new DateiAblage(d);
        byte[] haupt;
        try (TresorOrdner t = TresorOrdner.anlegen(a, Fach.BOOKLEDGER_APP, PW)) { haupt = t.hauptschluesselKopie(); t.fachAnlegen("bookledgerpro"); }
        assertTrue(TresorOrdner.vorhanden(a));
        Map<String, String> vorher = baum(d, "");
        assertEquals("TRESOR_PASSWORT_FALSCH", code(() -> TresorOrdner.oeffnen(a, Fach.BOOKLEDGER_APP, "falsches-Passwort-123")));
        assertEquals("TRESOR_PASSWORT_FALSCH", code(() -> TresorOrdner.oeffnen(a, Fach.PRIVATE_BRAIN_APP, PW.toUpperCase())));
        assertEquals("ein falsches Passwort hat etwas geschrieben", vorher, baum(d, ""));
        try (TresorOrdner t = TresorOrdner.oeffnen(a, Fach.WORKFLOW_PDF_APP, PW)) { assertArrayEquals(haupt, t.hauptschluesselKopie()); }
        // Zerlegtes „Ä“ (A + Trema) öffnet denselben Ordner.
        try (TresorOrdner t = TresorOrdner.oeffnen(a, Fach.BOOKLEDGER_APP, "richtig-langes-Passwort-A\u0308")) { assertArrayEquals(haupt, t.hauptschluesselKopie()); }
        assertEquals("TRESOR_DA", code(() -> TresorOrdner.anlegen(a, Fach.BOOKLEDGER_APP, PW)));
        assertEquals("TRESOR_PASSWORT_KURZ", code(() -> TresorOrdner.anlegen(new DateiAblage(neuerOrdner()), Fach.BOOKLEDGER_APP, "kurz")));
        assertEquals("TRESOR_APP_UNBEKANNT", code(() -> TresorOrdner.oeffnen(a, "fremde-app", PW)));
        // Gemerkter Schlüssel: nur der richtige öffnet.
        try (TresorOrdner t = TresorOrdner.mitHauptschluessel(a, Fach.BOOKLEDGER_APP, haupt)) { assertEquals(TresorOrdner.kennung(a), t.id()); }
        assertEquals("TRESOR_GESPERRT", code(() -> TresorOrdner.mitHauptschluessel(a, Fach.BOOKLEDGER_APP, VaultCrypto.random(32))));
        assertEquals(vorher, baum(d, ""));
    }

    @Test public void passwortAendernNimmtDemAltenDieMacht() throws Exception {
        File d = neuerOrdner(); DateiAblage a = new DateiAblage(d);
        byte[] haupt;
        try (TresorOrdner t = TresorOrdner.anlegen(a, Fach.PRIVATE_BRAIN_APP, PW)) { haupt = t.hauptschluesselKopie(); t.passwortAendern(PW2); }
        assertEquals("TRESOR_PASSWORT_FALSCH", code(() -> TresorOrdner.oeffnen(a, Fach.PRIVATE_BRAIN_APP, PW)));
        try (TresorOrdner t = TresorOrdner.oeffnen(a, Fach.BOOKLEDGER_APP, PW2)) { assertArrayEquals(haupt, t.hauptschluesselKopie()); }
        long plaetze = a.liste("Tresorordner").stream().filter(n -> n.startsWith("kennwort-")).count();
        assertEquals(1, plaetze);
    }

    @Test public void ersatzschluesselOeffnetMitJeDreiVonFuenf() throws Exception {
        File d = neuerOrdner(); DateiAblage a = new DateiAblage(d);
        byte[] haupt; List<String> teile;
        try (TresorOrdner t = TresorOrdner.anlegen(a, Fach.BOOKLEDGER_APP, PW)) {
            haupt = t.hauptschluesselKopie();
            List<String> alt = t.ersatzErstellen(5, 3);
            teile = t.ersatzErstellen(5, 3);
            assertEquals(5, teile.size());
            for (String s : teile) assertTrue(s.startsWith("FPT1-"));
            assertEquals(true, t.ersatzInfo().get("vorhanden"));
            // Der alte Satz ist ersetzt.
            assertEquals("TRESOR_ERSATZ_UNBEKANNT", code(() -> TresorOrdner.wiederherstellen(a, Fach.BOOKLEDGER_APP, alt.subList(0, 3), PW2)));
        }
        assertEquals("TRESOR_ERSATZ_INCOMPLETE", code(() -> TresorOrdner.wiederherstellen(a, Fach.BOOKLEDGER_APP, teile.subList(0, 2), PW2)));
        Map<String, String> vorher = baum(d, "");
        String falsch = teile.get(0).substring(0, 12) + (teile.get(0).charAt(12) == 'A' ? 'B' : 'A') + teile.get(0).substring(13);
        assertEquals("TRESOR_ERSATZ_TYPO", code(() -> TresorOrdner.wiederherstellen(a, Fach.BOOKLEDGER_APP, Arrays.asList(falsch, teile.get(1), teile.get(2)), PW2)));
        assertEquals(vorher, baum(d, ""));
        int kombis = 0;
        for (int x = 0; x < 5; x++) for (int y = x + 1; y < 5; y++) for (int z = y + 1; z < 5; z++) {
            if (kombis++ % 3 != 0) continue; // jede dritte Kombination (PBKDF2 kostet), darunter 0-1-2 und 2-3-4
            String neu = "Neues-Passwort-Nr-" + kombis;
            try (TresorOrdner t = TresorOrdner.wiederherstellen(a, Fach.PRIVATE_BRAIN_APP, Arrays.asList(teile.get(z), teile.get(x).toLowerCase().replace('-', ' '), teile.get(y)), neu)) {
                assertArrayEquals(haupt, t.hauptschluesselKopie());
            }
            try (TresorOrdner t = TresorOrdner.oeffnen(a, Fach.BOOKLEDGER_APP, neu)) { assertArrayEquals(haupt, t.hauptschluesselKopie()); }
        }
        assertEquals("TRESOR_PASSWORT_FALSCH", code(() -> TresorOrdner.oeffnen(a, Fach.BOOKLEDGER_APP, PW)));
        // Teile eines anderen Tresorordners öffnen diesen nicht.
        DateiAblage b = new DateiAblage(neuerOrdner());
        List<String> fremd;
        try (TresorOrdner t = TresorOrdner.anlegen(b, Fach.BOOKLEDGER_APP, PW)) { fremd = t.ersatzErstellen(5, 3); }
        assertEquals("TRESOR_ERSATZ_UNBEKANNT", code(() -> TresorOrdner.wiederherstellen(a, Fach.BOOKLEDGER_APP, fremd.subList(0, 3), PW2)));
    }

    @Test public void umzugEinesVorhandenenTresorsLaesstJedeDateiByteGleich() throws Exception {
        File d = neuerOrdner(); DateiAblage a = new DateiAblage(d);
        byte[] pbSchluessel = privateBrainNachstellen(d);
        Map<String, String> vorher = baum(d, "Private Brain");
        try (TresorOrdner t = TresorOrdner.anlegen(a, Fach.PRIVATE_BRAIN_APP, PW)) {
            t.fachEinziehen("private-brain", pbSchluessel);
            t.fachEinziehen("private-brain", pbSchluessel); // zweimal ist kein Fehler
            assertEquals("TRESOR_FACH_BELEGT", code(() -> t.fachEinziehen("private-brain", VaultCrypto.random(32))));
            assertEquals("TRESOR_FACH_FREMD", code(() -> t.fachEinziehen("bookledgerpro", VaultCrypto.random(32))));
        }
        assertEquals("Umzug hat eine Datei im Fach verändert", vorher, baum(d, "Private Brain"));
        // Eine andere App liest mit demselben Passwort den Schlüssel des Fachs und damit dessen Dateien.
        try (TresorOrdner t = TresorOrdner.oeffnen(a, Fach.BOOKLEDGER_APP, PW)) {
            byte[] k = t.fachSchluessel("private-brain");
            assertArrayEquals(pbSchluessel, k);
            try (VaultCrypto.Reader r = new VaultCrypto.Reader(new RandomAccessFile(new File(d, "Private Brain/Originale/9b1c"), "r").getChannel(), null, k, "pb|Originale/9b1c")) {
                assertTrue(r.size() > 100_000);
            }
            assertEquals("TRESOR_FACH_FREMD", code(() -> t.fachEinziehen("private-brain", pbSchluessel)));
        }
        assertEquals(vorher, baum(d, "Private Brain"));
    }

    @Test public void fremdesFachLesbarAberNieGeloeschtUndNieBeschrieben() throws Exception {
        File d = neuerOrdner();
        Mitschrift a = new Mitschrift(new DateiAblage(d));
        byte[] pbSchluessel = privateBrainNachstellen(d);
        try (TresorOrdner pb = TresorOrdner.anlegen(a, Fach.PRIVATE_BRAIN_APP, PW)) {
            pb.fachEinziehen("private-brain", pbSchluessel);
            Eintrag e = new Eintrag();
            e.id = "mail-3f2a"; e.name = "Rechnung März.eml"; e.art = "message/rfc822"; e.datum = 1_761_000_000_000L; e.groesse = 12345;
            e.auszug = "Rechnung Nr. 4711 über 119,00 EUR"; e.verweis = "Mails/3f2a"; e.schreiber = Fach.PRIVATE_BRAIN_APP; e.verschluesselung = "app";
            pb.verzeichnisSchreiben("private-brain", Arrays.asList(e));
            pb.ablegen("eingang-bookledgerpro", null, "Rechnung März.pdf", "application/pdf", 1_761_000_000_000L,
                new ByteArrayInputStream("%PDF-1.4 Rechnung".getBytes(StandardCharsets.UTF_8)), "Rechnung Nr. 4711");
        }
        Map<String, String> pbVorher = baum(d, "Private Brain");
        Map<String, String> eingangVorher = baum(d, "Eingang-BookLedgerPro");
        try (TresorOrdner blp = TresorOrdner.oeffnen(a, Fach.BOOKLEDGER_APP, PW)) {
            // Lesen: Verzeichnis des fremden Fachs und des Eingangs.
            List<Eintrag> pbListe = blp.verzeichnis("private-brain");
            assertEquals(1, pbListe.size());
            assertEquals("Rechnung März.eml", pbListe.get(0).name);
            assertEquals("TRESOR_NUR_IN_DER_APP", code(() -> blp.oeffnen("private-brain", pbListe.get(0))));
            List<Eintrag> eingang = blp.verzeichnis("eingang-bookledgerpro");
            assertEquals(1, eingang.size());
            assertEquals("%PDF-1.4 Rechnung", new String(alles(blp.oeffnen("eingang-bookledgerpro", eingang.get(0))), StandardCharsets.UTF_8));
            // Übernehmen: Marke, die Datei bleibt.
            blp.markeSetzen("eingang-bookledgerpro", eingang.get(0).id);
            blp.markeSetzen("eingang-bookledgerpro", eingang.get(0).id);
            assertTrue(blp.marken("eingang-bookledgerpro").contains(eingang.get(0).id));
            // Schreiben ins fremde Fach ist gesperrt.
            assertEquals("TRESOR_FACH_FREMD", code(() -> blp.verzeichnisSchreiben("private-brain", new ArrayList<>())));
            assertEquals("TRESOR_FACH_FREMD", code(() -> blp.ablegen("private-brain", null, "x", "text/plain", 0, new ByteArrayInputStream(new byte[1]), "")));
            assertEquals("TRESOR_FACH_FREMD", code(() -> blp.fachAnlegen("workflow-pdf-pro")));
            // Eigenes Fach: viele Stände, Passwort- und Ersatzwechsel — alles erlaubt.
            for (int i = 0; i < 6; i++) blp.ablegen("bookledgerpro", "Sicherung", "sicherung-" + i + ".blpr", "application/octet-stream", i, new ByteArrayInputStream(new byte[1000 * i]), "");
            blp.ersatzErstellen(5, 3); blp.ersatzErstellen(5, 3);
            blp.passwortAendern(PW2);
            assertEquals(6, blp.verzeichnis("bookledgerpro").size());
            assertEquals(1, blp.verzeichnis("eingang-bookledgerpro").size());
        }
        assertEquals("fremdes Fach verändert", pbVorher, baum(d, "Private Brain"));
        assertEquals("Eingang verändert", eingangVorher, baum(d, "Eingang-BookLedgerPro"));
        assertFalse(a.geloescht.isEmpty());
        for (String p : a.geloescht) {
            assertTrue("gelöscht außerhalb der Verwaltung: " + p, p.startsWith("Tresorordner/"));
            assertFalse("fremden Stand gelöscht: " + p, p.startsWith("Tresorordner/verzeichnis/") && !p.contains("/" + Fach.BOOKLEDGER_APP + "/"));
        }
        // Ältere eigene Stände über drei sind weg, drei bleiben.
        assertEquals(TresorOrdner.BEHALTENE_STAENDE, new DateiAblage(d).liste("Tresorordner/verzeichnis/bookledgerpro/bookledgerpro").size());
    }

    @Test public void uebergabefachSammeltMehrereSchreiber() throws Exception {
        DateiAblage a = new DateiAblage(neuerOrdner());
        try (TresorOrdner t = TresorOrdner.anlegen(a, Fach.PRIVATE_BRAIN_APP, PW)) {
            t.ablegen("eingang-bookledgerpro", "Mails", "a.eml", "message/rfc822", 1, new ByteArrayInputStream(new byte[] {1}), "von PB");
        }
        try (TresorOrdner t = TresorOrdner.oeffnen(a, Fach.WORKFLOW_PDF_APP, PW)) {
            t.ablegen("eingang-bookledgerpro", null, "scan.pdf", "application/pdf", 2, new ByteArrayInputStream(new byte[] {2, 2}), "von WFP");
        }
        try (TresorOrdner t = TresorOrdner.oeffnen(a, Fach.BOOKLEDGER_APP, PW)) {
            List<Eintrag> l = t.verzeichnis("eingang-bookledgerpro");
            assertEquals(2, l.size());
            for (Eintrag e : l) assertArrayEquals(e.schreiber.equals(Fach.PRIVATE_BRAIN_APP) ? new byte[] {1} : new byte[] {2, 2}, alles(t.oeffnen("eingang-bookledgerpro", e)));
            assertTrue(t.eigenesVerzeichnis("eingang-bookledgerpro").isEmpty());
        }
    }

    @Test public void manipulationenWerdenErkannt() throws Exception {
        File d = neuerOrdner(); DateiAblage a = new DateiAblage(d);
        Eintrag e;
        try (TresorOrdner t = TresorOrdner.anlegen(a, Fach.BOOKLEDGER_APP, PW)) {
            byte[] inhalt = new byte[600_000]; new Random(1).nextBytes(inhalt);
            e = t.ablegen("bookledgerpro", "Belege", "beleg.pdf", "application/pdf", 3, new ByteArrayInputStream(inhalt), "Beleg");
            assertArrayEquals(inhalt, alles(t.oeffnen("bookledgerpro", e)));
            assertEquals(TresorOrdner.sha256(new ByteArrayInputStream(inhalt)), e.sha256);
            t.ablegen("bookledgerpro", "Belege", "zweiter.pdf", "application/pdf", 4, new ByteArrayInputStream(new byte[10]), "");
        }
        // Ein Bit in der Belegdatei.
        File beleg = new File(d, "BookLedgerPro/" + e.verweis);
        try (RandomAccessFile f = new RandomAccessFile(beleg, "rw")) { f.seek(VaultCrypto.HEADER + 300_000); int b = f.read(); f.seek(VaultCrypto.HEADER + 300_000); f.write(b ^ 4); }
        try (TresorOrdner t = TresorOrdner.oeffnen(a, Fach.BOOKLEDGER_APP, PW)) {
            assertEquals("TRESOR_BESCHAEDIGT", code(() -> alles(t.oeffnen("bookledgerpro", e))));
            // Ein Eintrag, der auf eine andere Datei zeigt, öffnet sie nicht unter falschem Namen.
            Eintrag umgebogen = Eintrag.ausMap(e.alsMap());
            umgebogen.id = t.verzeichnis("bookledgerpro").get(1).id;
            assertEquals("TRESOR_EINTRAG_UNGUELTIG", code(() -> t.oeffnen("bookledgerpro", umgebogen)));
        }
        // Älterer Stand des Verzeichnisses unter neuer Nummer (Zurückspielen) wird erkannt.
        File ordner = new File(d, "Tresorordner/verzeichnis/bookledgerpro/bookledgerpro");
        String[] staende = ordner.list(); Arrays.sort(staende);
        String aeltester = staende[0], neuester = staende[staende.length - 1];
        Files.copy(new File(ordner, aeltester).toPath(), new File(ordner, "v-00000000000000000099-" + neuester.substring(23)).toPath());
        try (TresorOrdner t = TresorOrdner.oeffnen(a, Fach.BOOKLEDGER_APP, PW)) {
            assertEquals("TRESOR_BESCHAEDIGT", code(() -> t.verzeichnis("bookledgerpro")));
        }
        // Kopf mit fremdem Prüfwert: das Passwort öffnet nicht still einen anderen Schlüssel.
        File kopf = new File(d, TresorOrdner.KOPF);
        String k = new String(Files.readAllBytes(kopf.toPath()), StandardCharsets.UTF_8);
        String pruefung = (String) Json.objekt(k).get("pruefung");
        Files.write(kopf.toPath(), k.replace(pruefung, VaultCrypto.hex(VaultCrypto.random(32))).getBytes(StandardCharsets.UTF_8));
        assertEquals("TRESOR_BESCHAEDIGT", code(() -> TresorOrdner.oeffnen(a, Fach.BOOKLEDGER_APP, PW)));
    }

    @Test public void jsonRundlaufUndKaputtes() throws Exception {
        String s = Json.schreiben(Json.objekt("{\"a\":\"ä\\n\\\"x\\u0001\",\"b\":-12,\"c\":[true,false,null,{}],\"d\":{\"e\":[]}}"));
        assertEquals("{\"a\":\"ä\\n\\\"x\\u0001\",\"b\":-12,\"c\":[true,false,null,{}],\"d\":{\"e\":[]}}", s);
        for (String kaputt : new String[] {"", "{", "{\"a\":1,}", "{\"a\":1}x", "{\"a\":1.5}", "{\"a\":1,\"a\":2}", "[1 2]", "\"\\q\""})
            assertEquals(kaputt, "TRESOR_BESCHAEDIGT", code(() -> Json.lesen(kaputt)));
    }

    @Test public void ersatzteileDerAppTresoreWerdenNichtAngenommen() throws Exception {
        List<Ersatzschluessel.Share> s = Ersatzschluessel.split(VaultCrypto.random(32), new byte[] {1, 2, 3, 4}, 5, 3);
        String fpt = Ersatzschluessel.encode(s.get(0));
        assertEquals("TRESOR_ERSATZ_TYPO", code(() -> Ersatzschluessel.decode("WFP1" + fpt.substring(4))));
    }
}
