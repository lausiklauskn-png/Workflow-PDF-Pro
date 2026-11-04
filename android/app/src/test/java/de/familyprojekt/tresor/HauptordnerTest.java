package de.familyprojekt.tresor;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 * Hauptordner: der Nutzer wählt nur den Speicher, die App findet oder legt den Tresor-Hauptordner selbst an
 * (Klaus 2026-11-04). Gestellter Ordner über DateiAblage, echter TresorOrdner.
 */
public final class HauptordnerTest {
    static final String PW = "richtig-langes-Passwort-Ä";

    static File leer() throws IOException { File d = Files.createTempDirectory("hauptordner").toFile(); d.deleteOnExit(); return d; }
    static String code(TresorOrdnerTest.ThrowingRunnable r) { return TresorOrdnerTest.code(r); }

    @Test public void leererSpeicherWirdHierAngelegtUndDanachGefunden() throws Exception {
        File d = leer(); DateiAblage a = new DateiAblage(d);
        Hauptordner.Ergebnis e = Hauptordner.suchen(a, "Family-Projekt");
        assertEquals(Hauptordner.ANLEGEN_HIER, e.art);
        TresorOrdner.anlegen(Hauptordner.ablage(a, e, null), Fach.WORKFLOW_PDF_APP, PW).close();
        assertEquals(Hauptordner.GEFUNDEN, Hauptordner.suchen(a, "Family-Projekt").art);
        assertEquals("", Hauptordner.suchen(a, "Family-Projekt").pfad);
    }

    @Test public void speicherMitInhaltBekommtEigenenOrdnerMitGewaehltemNamen() throws Exception {
        File d = leer(); new File(d, "DCIM").mkdir(); Files.write(new File(d, "foto.jpg").toPath(), new byte[]{1});
        DateiAblage a = new DateiAblage(d);
        Hauptordner.Ergebnis e = Hauptordner.suchen(a, "");
        assertEquals(Hauptordner.ANLEGEN_DARIN, e.art);
        Ablage h = Hauptordner.ablage(a, e, "Familienprojekt");
        TresorOrdner.anlegen(h, Fach.WORKFLOW_PDF_APP, PW).close();
        assertTrue(new File(d, "Familienprojekt/" + TresorOrdner.KOPF).isFile());
        // Andere Dateien des Speichers bleiben unberührt, der Tresor liegt nicht lose daneben.
        assertFalse(new File(d, TresorOrdner.KOPF).exists());
        assertTrue(new File(d, "foto.jpg").isFile());
        // Später wählt man wieder nur den Speicher – gefunden wird der Ordner, egal wie er heißt.
        Hauptordner.Ergebnis wieder = Hauptordner.suchen(a, "");
        assertEquals(Hauptordner.GEFUNDEN, wieder.art);
        assertEquals("Familienprojekt", wieder.pfad);
        try (TresorOrdner t = TresorOrdner.oeffnen(Hauptordner.ablage(a, wieder, null), Fach.FAMILIENAKTE_APP, PW)) { assertNotNull(t.id()); }
    }

    @Test public void vorschlagWennKeinNameGetipptWurde() throws Exception {
        File d = leer(); new File(d, "Musik").mkdir(); DateiAblage a = new DateiAblage(d);
        Hauptordner.ablage(a, Hauptordner.suchen(a, ""), "  ");
        assertTrue(new File(d, Hauptordner.VORSCHLAG).isDirectory());
        assertEquals("Family-Projekt", Hauptordner.VORSCHLAG);
    }

    @Test public void alterTresorMitAnderemNamenWirdGefunden() throws Exception {
        File d = leer(); File alt = new File(d, "Privat Brain Pro Hauptablageordner"); alt.mkdir();
        TresorOrdner.anlegen(new DateiAblage(alt), Fach.BOOKLEDGER_APP, PW).close();
        new File(d, "Download").mkdir();
        Hauptordner.Ergebnis e = Hauptordner.suchen(new DateiAblage(d), "");
        assertEquals(Hauptordner.GEFUNDEN, e.art);
        assertEquals("Privat Brain Pro Hauptablageordner", e.pfad);
    }

    @Test public void fachEingangUndVerwaltungWerdenNieAlsSpeicherGenommen() throws Exception {
        File d = leer(); DateiAblage a = new DateiAblage(d);
        try (TresorOrdner t = TresorOrdner.anlegen(a, Fach.WORKFLOW_PDF_APP, PW)) { t.fachAnlegen(Fach.WORKFLOW_PDF.slug); }
        for (String n : new String[]{"Workflow PDF Pro", "Eingang-Familienakte", "Familienakte", "Tresorordner"}) {
            File f = new File(d, n); f.mkdirs();
            assertEquals(n, Hauptordner.UNTERORDNER, Hauptordner.suchen(new DateiAblage(f), n).art);
        }
        // Verwaltung auch umbenannt, am Inhalt erkannt.
        File umbenannt = new File(d, "irgendwas"); assertTrue(new File(d, TresorOrdner.VERWALTUNG).renameTo(umbenannt));
        assertEquals(Hauptordner.UNTERORDNER, Hauptordner.suchen(new DateiAblage(umbenannt), "irgendwas").art);
        // Ordner einer App-Ablage am Kopf erkannt.
        File app = new File(leer(), "Ablage"); app.mkdirs(); Files.write(new File(app, "workflow-pdf-pro.tresor.json").toPath(), "{}".getBytes());
        assertEquals(Hauptordner.UNTERORDNER, Hauptordner.suchen(new DateiAblage(app), "Ablage").art);
        assertEquals("TRESOR_ORDNER_UNTERORDNER", code(() -> Hauptordner.ablage(a, Hauptordner.suchen(new DateiAblage(app), "Ablage"), null)));
    }

    @Test public void zweiTresoreNebeneinanderWerdenNichtGeraten() throws Exception {
        File d = leer();
        for (String n : new String[]{"A", "B"}) { File f = new File(d, n); f.mkdir(); TresorOrdner.anlegen(new DateiAblage(f), Fach.WORKFLOW_PDF_APP, PW).close(); }
        Hauptordner.Ergebnis e = Hauptordner.suchen(new DateiAblage(d), "");
        assertEquals(Hauptordner.MEHRERE, e.art);
        assertEquals(2, e.kandidaten.size());
        assertEquals("TRESOR_ORDNER_MEHRERE", code(() -> Hauptordner.ablage(new DateiAblage(d), e, null)));
    }

    @Test public void namenRegeln() throws Exception {
        assertEquals("Familienprojekt", Hauptordner.name(" Familienprojekt "));
        assertEquals("Family-Projekt", Hauptordner.name(null));
        for (String n : new String[]{"a/b", "a\\b", "x:y", "was?", "..", ".", "ende.", "Tresorordner", "familienakte", "Eingang-WorkflowPDF", "x".repeat(81)})
            assertEquals(n, "TRESOR_NAME_UNGUELTIG", code(() -> Hauptordner.name(n)));
    }

    @Test public void niemalsInEinenBelegtenFremdenOrdner() throws Exception {
        File d = leer(); File fremd = new File(d, "Family-Projekt"); fremd.mkdir();
        Files.write(new File(fremd, "privat.txt").toPath(), new byte[]{7});
        DateiAblage a = new DateiAblage(d);
        Hauptordner.Ergebnis e = Hauptordner.suchen(a, "");
        assertEquals(Hauptordner.ANLEGEN_DARIN, e.art);
        assertEquals("TRESOR_NAME_BELEGT", code(() -> Hauptordner.ablage(a, e, null)));
        assertEquals(1, fremd.list().length);
        // Ein leerer Ordner mit dem Namen darf genommen werden.
        File leerOrdner = new File(d, "Neu"); leerOrdner.mkdir();
        Hauptordner.ablage(a, e, "Neu");
    }

    @Test public void unterAblageBleibtImPraefix() throws Exception {
        File d = leer(); DateiAblage a = new DateiAblage(d);
        UnterAblage u = new UnterAblage(a, "Family-Projekt");
        u.ordner("x");
        assertTrue(new File(d, "Family-Projekt/x").isDirectory());
        for (String p : new String[]{"", "/a", "a/", "a//b", "a/../b", ".."})
            assertEquals(p, "TRESOR_PFAD_UNGUELTIG", code(() -> new UnterAblage(a, p)));
    }

    @Test public void liesMichEntstehtNurImTresorUndBleibtUnveraendert() throws Exception {
        File d = leer(); DateiAblage a = new DateiAblage(d);
        assertEquals("TRESOR_NICHT_VORHANDEN", code(() -> Hauptordner.liesMichAnlegen(a)));
        assertFalse(new File(d, Hauptordner.LIES_MICH).exists());
        TresorOrdner.anlegen(a, Fach.WORKFLOW_PDF_APP, PW).close();
        assertTrue(Hauptordner.liesMichAnlegen(a));
        String text = new String(Files.readAllBytes(new File(d, Hauptordner.LIES_MICH).toPath()), "UTF-8");
        assertTrue(text.contains("tresorordner.json") && text.contains("GANZEN Hauptordner"));
        Files.write(new File(d, Hauptordner.LIES_MICH).toPath(), "eigene Notiz".getBytes("UTF-8"));
        assertFalse(Hauptordner.liesMichAnlegen(a));
        assertEquals("eigene Notiz", new String(Files.readAllBytes(new File(d, Hauptordner.LIES_MICH).toPath()), "UTF-8"));
        // Die Lies-mich-Datei stört das Wiederfinden nicht.
        assertEquals(Hauptordner.GEFUNDEN, Hauptordner.suchen(a, "Family-Projekt").art);
    }
}
