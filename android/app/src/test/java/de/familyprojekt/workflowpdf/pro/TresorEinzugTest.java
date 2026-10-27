package de.familyprojekt.workflowpdf.pro;

import de.familyprojekt.tresor.DateiAblage;
import de.familyprojekt.tresor.Eintrag;
import de.familyprojekt.tresor.Fach;
import de.familyprojekt.tresor.TresorOrdner;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.TreeMap;
import java.util.UUID;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 * Schritt D1: Einzug des Workflow-PDF-Tresors in den gemeinsamen Tresorordner, am nachgestellten Ordner
 * (java.io.File statt SD-Karte). Kernfragen aus Klaus' Plan: die Probe an einer Kopie lässt das Original
 * unberührt · im Fach bleibt jede Datei byte-gleich · der Rückweg (zwei Einträge löschen) ergibt wieder den
 * Ausgangszustand · eine andere App liest danach das Inhaltsverzeichnis.
 */
public final class TresorEinzugTest {
    static final String PW = "ein-langes-Tresorordner-Passwort";

    static File neu() throws IOException { File d = Files.createTempDirectory("einzug").toFile(); d.deleteOnExit(); return d; }

    static Map<String, String> baum(File wurzel) throws Exception {
        Map<String, String> aus = new TreeMap<>();
        sammeln(wurzel, "", aus);
        return aus;
    }
    private static void sammeln(File f, String pfad, Map<String, String> aus) throws Exception {
        if (f.isDirectory()) {
            aus.put(pfad + "/", "ordner");
            String[] namen = f.list(); Arrays.sort(namen);
            for (String n : namen) sammeln(new File(f, n), pfad.isEmpty() ? n : pfad + "/" + n, aus);
        } else aus.put(pfad, VaultCrypto.hex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(f.toPath()))));
    }
    static String code(Run r) { try { r.run(); return "kein Fehler"; } catch (IOException e) { return e.getMessage(); } catch (Exception e) { return e.toString(); } }
    interface Run { void run() throws Exception; }

    /** Wie DocumentVault.initialize: „Workflow PDF Pro/“ mit Kopf, Datensätzen (*.wpv) und Commit-Marken. */
    static String workflowTresorNachstellen(File eltern) throws Exception {
        String id = UUID.randomUUID().toString();
        File w = new File(eltern, Fach.WORKFLOW_PDF.ordner); assertTrue(w.mkdirs());
        String kopf = "{\"app\":\"workflow-pdf-pro-vault\",\"v\":1,\"id\":\"" + id + "\",\"iterations\":600000,\"salt\":\"AAAAAAAAAAAAAAAAAAAAAA==\",\"wrapped\":\"eA==\"}";
        Files.write(new File(w, TresorEinzug.TRESOR_KOPF).toPath(), kopf.getBytes(StandardCharsets.UTF_8));
        Random r = new Random(7);
        for (int i = 0; i < 4; i++) { byte[] b = new byte[50_000 + r.nextInt(200_000)]; r.nextBytes(b); Files.write(new File(w, UUID.randomUUID() + ".wpv").toPath(), b); }
        Files.write(new File(w, "commit-00000000000000000004-" + UUID.randomUUID() + ".json").toPath(), "{\"index\":\"x\",\"revision\":4}".getBytes(StandardCharsets.UTF_8));
        return id;
    }
    static void kopieren(File von, File nach) throws IOException {
        if (von.isDirectory()) { assertTrue(nach.mkdirs()); for (String n : von.list()) kopieren(new File(von, n), new File(nach, n)); }
        else Files.copy(von.toPath(), nach.toPath());
    }
    static void loeschenRekursiv(File f) { File[] k = f.listFiles(); if (k != null) for (File x : k) loeschenRekursiv(x); assertTrue(f.delete()); }

    @Test public void pruefenErkenntOrdner() throws Exception {
        File leer = neu(), sd = neu();
        String id = workflowTresorNachstellen(sd);
        assertEquals("OHNE_TRESOR", TresorEinzug.pruefen(new DateiAblage(leer), id));
        assertEquals("PASST", TresorEinzug.pruefen(new DateiAblage(sd), id));
        assertEquals("FREMDER_TRESOR", TresorEinzug.pruefen(new DateiAblage(sd), UUID.randomUUID().toString()));
        // Wer den Ordner „Workflow PDF Pro“ selbst wählt, muss die Ebene darüber freigeben.
        assertEquals("IST_FACH", TresorEinzug.pruefen(new DateiAblage(new File(sd, Fach.WORKFLOW_PDF.ordner)), id));
        // Ein Kopf einer anderen App unter dem Namen zählt nicht.
        File fremd = neu(); new File(fremd, Fach.WORKFLOW_PDF.ordner).mkdirs();
        Files.write(new File(fremd, TresorEinzug.KOPF_PFAD).toPath(), ("{\"app\":\"private-brain-vault\",\"id\":\"" + id + "\"}").getBytes(StandardCharsets.UTF_8));
        assertEquals("FREMDER_TRESOR", TresorEinzug.pruefen(new DateiAblage(fremd), id));
    }

    @Test public void probeAnKopieLaesstOriginalUndFachUnberuehrtUndRueckwegStimmt() throws Exception {
        File sd = neu(), original = new File(sd, "Ablage"), probe = new File(sd, "Tresor-Probe");
        assertTrue(original.mkdirs());
        String id = workflowTresorNachstellen(original);
        kopieren(new File(original, Fach.WORKFLOW_PDF.ordner), new File(probe, Fach.WORKFLOW_PDF.ordner));
        Map<String, String> sdVorher = baum(sd), probeVorher = baum(probe), fachVorher = baum(new File(probe, Fach.WORKFLOW_PDF.ordner));
        byte[] datenSchluessel = new SecureRandom().generateSeed(32);

        DateiAblage a = new DateiAblage(probe);
        assertEquals("PASST", TresorEinzug.pruefen(a, id));
        try (TresorOrdner t = TresorOrdner.anlegen(a, TresorEinzug.APP, PW)) {
            TresorEinzug.einziehen(t, datenSchluessel);
            assertTrue(TresorEinzug.eingezogen(t));
            TresorEinzug.einziehen(t, datenSchluessel); // zweimal ist kein Fehler
            assertEquals("TRESOR_FACH_BELEGT", code(() -> TresorEinzug.einziehen(t, new SecureRandom().generateSeed(32))));
        }
        // Original (alles außerhalb der Probe) unverändert, im Fach jede Datei byte-gleich.
        Map<String, String> sdNachher = baum(sd);
        for (Map.Entry<String, String> e : sdVorher.entrySet()) if (!e.getKey().startsWith("Tresor-Probe")) assertEquals(e.getKey(), e.getValue(), sdNachher.get(e.getKey()));
        assertEquals(fachVorher, baum(new File(probe, Fach.WORKFLOW_PDF.ordner)));
        // Neu in der Probe nur: tresorordner.json, Tresorordner/ und der leere Eingangs-Ordner.
        List<String> neueOben = new ArrayList<>(Arrays.asList(probe.list())); neueOben.removeAll(Arrays.asList(Fach.WORKFLOW_PDF.ordner));
        neueOben.sort(null);
        assertEquals(Arrays.asList(Fach.EINGANG_WORKFLOW_PDF.ordner, TresorOrdner.VERWALTUNG, TresorOrdner.KOPF), neueOben);

        // Eine andere App öffnet mit demselben Passwort und bekommt genau den Datenschlüssel des Fachs.
        try (TresorOrdner blp = TresorOrdner.oeffnen(new DateiAblage(probe), Fach.BOOKLEDGER_APP, PW)) {
            assertArrayEquals(datenSchluessel, blp.fachSchluessel(TresorEinzug.FACH));
            assertEquals("TRESOR_FACH_FREMD", code(() -> blp.fachEinziehen(TresorEinzug.FACH, datenSchluessel)));
        }
        // Rückweg: die drei neuen Einträge löschen = Ausgangszustand.
        loeschenRekursiv(new File(probe, TresorOrdner.VERWALTUNG));
        assertTrue(new File(probe, TresorOrdner.KOPF).delete());
        loeschenRekursiv(new File(probe, Fach.EINGANG_WORKFLOW_PDF.ordner));
        assertEquals(probeVorher, baum(probe));
    }

    static Map<String, Object> zeile(String id, String name, long datum, String auszug) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id); m.put("name", name); m.put("datum", datum); m.put("groesse", 1234L); m.put("auszug", auszug);
        m.put("sha256", "ab".repeat(32));
        return m;
    }

    @Test public void inhaltsverzeichnisNurBeiAenderungUndFuerAndereLesbar() throws Exception {
        File sd = neu(); String id = workflowTresorNachstellen(sd);
        DateiAblage a = new DateiAblage(sd);
        try (TresorOrdner t = TresorOrdner.anlegen(a, TresorEinzug.APP, PW)) {
            TresorEinzug.einziehen(t, new SecureRandom().generateSeed(32));
            List<Map<String, Object>> zeilen = new ArrayList<>();
            zeilen.add(zeile(UUID.randomUUID().toString(), "Rechnung Mai", 1700000000000L, "Rechnung Nr. 4711 " + "x".repeat(2000)));
            zeilen.add(zeile(UUID.randomUUID().toString(), "Vertrag", 1700000001000L, ""));
            assertTrue(TresorEinzug.schreibenWennGeaendert(t, TresorEinzug.eintraege(zeilen)));
            int staende = new File(sd, TresorOrdner.VERWALTUNG + "/verzeichnis/" + TresorEinzug.FACH + "/" + TresorEinzug.APP).list().length;
            assertFalse(TresorEinzug.schreibenWennGeaendert(t, TresorEinzug.eintraege(zeilen)));
            assertEquals(staende, new File(sd, TresorOrdner.VERWALTUNG + "/verzeichnis/" + TresorEinzug.FACH + "/" + TresorEinzug.APP).list().length);
            zeilen.get(1).put("name", "Vertrag (neu)");
            assertTrue(TresorEinzug.schreibenWennGeaendert(t, TresorEinzug.eintraege(zeilen)));
            // Schreiber und Format setzt die App-Seite selbst, egal was hereinkommt.
            zeilen.get(0).put("schreiber", Fach.PRIVATE_BRAIN_APP); zeilen.get(0).put("verschluesselung", "fpt1");
            for (Eintrag e : TresorEinzug.eintraege(zeilen)) { assertEquals(TresorEinzug.APP, e.schreiber); assertEquals("app", e.verschluesselung); }
            zeilen.get(0).put("id", "../böse");
            assertEquals("TRESOR_EINTRAG_UNGUELTIG", code(() -> TresorEinzug.eintraege(zeilen)));
        }
        try (TresorOrdner pb = TresorOrdner.oeffnen(a, Fach.PRIVATE_BRAIN_APP, PW)) {
            List<Eintrag> gelesen = pb.verzeichnis(TresorEinzug.FACH);
            assertEquals(2, gelesen.size());
            Eintrag r = gelesen.get(0).name.startsWith("Rechnung") ? gelesen.get(0) : gelesen.get(1);
            assertTrue(r.auszug.startsWith("Rechnung Nr. 4711"));
            assertEquals(Eintrag.AUSZUG_MAX, r.auszug.length());
            assertEquals("docs/" + r.id, r.verweis);
            assertEquals("TRESOR_FACH_FREMD", code(() -> pb.verzeichnisSchreiben(TresorEinzug.FACH, new ArrayList<>())));
        }
        assertEquals("PASST", TresorEinzug.pruefen(a, id));
    }
}
