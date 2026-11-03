package de.familyprojekt.workflowpdf.pro;

import de.familyprojekt.tresor.DateiAblage;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 * Ordnerwahl nach dem Befund von Klaus' SD-Karte (2026-11-03): Hauptablageordner oder „Workflow PDF Pro“ öffnen dieselbe
 * Ablage, nie ein verschachteltes „Workflow PDF Pro/Workflow PDF Pro“, nie still ein neuer Tresor; „Speichern unter“ in den
 * Tresor wird erkannt (Pfad-Vergleich der SAF-Kennungen). Nachgestellt mit java.io.File statt SD-Karte.
 */
public final class OrdnerWahlTest {
    static File neu() throws IOException { File d = Files.createTempDirectory("ordnerwahl").toFile(); d.deleteOnExit(); return d; }
    static void datei(File eltern, String pfad, String inhalt) throws IOException {
        File f = new File(eltern, pfad); f.getParentFile().mkdirs(); Files.write(f.toPath(), inhalt.getBytes(StandardCharsets.UTF_8));
    }
    static File ordner(File eltern, String name) { File f = new File(eltern, name); f.mkdirs(); return f; }
    static String ablage(File f) throws IOException { return OrdnerWahl.ablage(new DateiAblage(f), f.getName()); }
    static String tresor(File f) throws IOException { return OrdnerWahl.tresor(new DateiAblage(f), f.getName()); }

    /** Klaus' Karte nachgestellt: Hauptablageordner mit Kopf, Verwaltung, eigenem Fach (Kopf, .wpv, offene Dateien), Eingängen. */
    static File karte() throws IOException {
        File karte = neu(), haupt = ordner(karte, "Privat Brain Pro Hauptablageordner");
        datei(haupt, "tresorordner.json", "{\"format\":\"familyprojekt-tresorordner\"}");
        datei(haupt, "Tresorordner/kennwort-0f0e0d0c-0000-4000-8000-000000000001.json", "{}");
        datei(haupt, "Tresorordner/fach-workflow-pdf-pro.json", "{}");
        ordner(haupt, "Tresorordner/verzeichnis");
        datei(haupt, "Workflow PDF Pro/workflow-pdf-pro.tresor.json", "{\"app\":\"workflow-pdf-pro-vault\"}");
        datei(haupt, "Workflow PDF Pro/0a1b2c.wpv", "x");
        datei(haupt, "Workflow PDF Pro/Eroeffnungsmail.pdf", "%PDF");
        datei(haupt, "Private Brain/abc", "x");
        ordner(haupt, "Eingang-WorkflowPDF");
        datei(haupt, "Arbeitsstand.workfloh.json", "{}");
        return haupt;
    }

    @Test public void hauptablageUndFachOeffnenDieselbeAblage() throws Exception {
        File haupt = karte();
        assertEquals(OrdnerWahl.ABLAGE_DARIN, ablage(haupt));
        assertEquals(OrdnerWahl.ABLAGE_HIER, ablage(new File(haupt, "Workflow PDF Pro")));
        // Übrig gebliebene Verschachtelung vom alten Fehler: der äußere Ordner öffnet die innere Ablage, legt nichts neu an.
        File alt = ordner(neu(), "Workflow PDF Pro");
        datei(alt, "Workflow PDF Pro/workflow-pdf-pro.tresor.json", "{}");
        assertEquals(OrdnerWahl.ABLAGE_DARIN, ablage(alt));
    }

    @Test public void verwaltungUndFremdeFaecherWerdenAbgelehnt() throws Exception {
        File haupt = karte();
        assertEquals(OrdnerWahl.NEIN_VERWALTUNG, ablage(new File(haupt, "Tresorordner")));
        File umbenannt = ordner(neu(), "Kopie");                // Verwaltung unter anderem Namen (z. B. kopiert)
        datei(umbenannt, "kennwort-0f0e0d0c-0000-4000-8000-000000000001.json", "{}"); ordner(umbenannt, "verzeichnis");
        assertEquals(OrdnerWahl.NEIN_VERWALTUNG, ablage(umbenannt));
        assertEquals(OrdnerWahl.NEIN_FREMDES_FACH, ablage(new File(haupt, "Private Brain")));
        assertEquals(OrdnerWahl.NEIN_FREMDES_FACH, ablage(new File(haupt, "Eingang-WorkflowPDF")));
        for (String art : new String[] { OrdnerWahl.NEIN_VERWALTUNG, OrdnerWahl.NEIN_FREMDES_FACH, OrdnerWahl.NEIN_FACH_OHNE_KOPF })
            assertTrue(art, OrdnerWahl.abgelehnt(art) && !OrdnerWahl.frage(art));
    }

    @Test public void ohneErkennbarenTresorWirdGefragt() throws Exception {
        assertEquals(OrdnerWahl.FRAGEN_NEU, ablage(ordner(neu(), "Download")));
        File leer = ordner(neu(), "Workflow PDF Pro");
        assertEquals(OrdnerWahl.FRAGEN_FACH_LEER, ablage(leer));
        datei(leer, "Eroeffnungsmail.pdf", "%PDF");                // Inhalt, aber kein Kopf: nichts anlegen
        assertEquals(OrdnerWahl.NEIN_FACH_OHNE_KOPF, ablage(leer));
        File darueber = neu(); datei(darueber, "Workflow PDF Pro/x.pdf", "%PDF");
        assertEquals(OrdnerWahl.NEIN_FACH_OHNE_KOPF, ablage(darueber));
        assertTrue(OrdnerWahl.frage(OrdnerWahl.FRAGEN_NEU) && OrdnerWahl.frage(OrdnerWahl.FRAGEN_FACH_LEER));
    }

    @Test public void tresorOhneEigenesFachLegtEsDarinAn() throws Exception {
        File haupt = ordner(neu(), "Hauptablage");
        datei(haupt, "tresorordner.json", "{}");
        assertEquals(OrdnerWahl.TRESOR_NEUE_ABLAGE, ablage(haupt));
        ordner(haupt, "Workflow PDF Pro");                          // leeres Fach (andere App hat es vorbereitet)
        assertEquals(OrdnerWahl.TRESOR_NEUE_ABLAGE, ablage(haupt));
        assertFalse(OrdnerWahl.frage(OrdnerWahl.TRESOR_NEUE_ABLAGE) || OrdnerWahl.abgelehnt(OrdnerWahl.TRESOR_NEUE_ABLAGE));
    }

    @Test public void nieVerschachteln() throws Exception {
        assertTrue(OrdnerWahl.unterordnerAnlegen("Download", false));
        assertTrue(OrdnerWahl.unterordnerAnlegen("Privat Brain Pro Hauptablageordner", true));
        assertFalse(OrdnerWahl.unterordnerAnlegen("Workflow PDF Pro", true));
        try { OrdnerWahl.unterordnerAnlegen("Workflow PDF Pro", false); fail("verschachtelt"); }
        catch (IOException e) { assertEquals("VAULT_ORDNER_FACH_OHNE_KOPF", e.getMessage()); }
    }

    @Test public void gemeinsamerTresorNurMitTresorordnerJson() throws Exception {
        File haupt = karte();
        assertEquals(OrdnerWahl.TRESOR_PASST, tresor(haupt));
        assertEquals(OrdnerWahl.TRESOR_APP_ORDNER, tresor(new File(haupt, "Workflow PDF Pro")));
        assertEquals(OrdnerWahl.TRESOR_APP_ORDNER, tresor(new File(haupt, "Private Brain")));
        assertEquals(OrdnerWahl.TRESOR_APP_ORDNER, tresor(new File(haupt, "Eingang-WorkflowPDF")));
        assertEquals(OrdnerWahl.TRESOR_VERWALTUNG, tresor(new File(haupt, "Tresorordner")));
        File eigeneAblage = ordner(neu(), "Meine Ablage"); datei(eigeneAblage, "workflow-pdf-pro.tresor.json", "{}");
        assertEquals(OrdnerWahl.TRESOR_APP_ORDNER, tresor(eigeneAblage));
        assertEquals(OrdnerWahl.TRESOR_OHNE, tresor(ordner(neu(), "Download")));
    }

    static final String EXT = OrdnerWahl.EXTERN, HAUPT = "1234-ABCD:Privat Brain Pro Hauptablageordner";
    @Test public void speichernUnterImTresorWirdErkannt() {
        assertTrue(OrdnerWahl.liegtIn(EXT, HAUPT, EXT, HAUPT + "/Workflow PDF Pro/Eröffnungsmail.pdf"));
        assertTrue(OrdnerWahl.liegtIn(EXT, HAUPT, EXT, HAUPT + "/Arbeitsstand.workfloh.json"));
        assertTrue(OrdnerWahl.liegtIn(EXT, HAUPT + "/Workflow PDF Pro", EXT, HAUPT + "/Workflow PDF Pro/a.pdf"));
        assertTrue(OrdnerWahl.liegtIn(EXT, HAUPT, EXT, HAUPT));
        assertTrue(OrdnerWahl.liegtIn(EXT, "1234-ABCD:", EXT, "1234-abcd:Download/a.pdf"));   // ganze Karte freigegeben
        assertFalse(OrdnerWahl.liegtIn(EXT, HAUPT, EXT, HAUPT + "2/a.pdf"));                 // Nachbarordner mit gleichem Anfang
        assertFalse(OrdnerWahl.liegtIn(EXT, HAUPT, EXT, "1234-ABCD:Download/a.pdf"));
        assertFalse(OrdnerWahl.liegtIn(EXT, HAUPT, EXT, "primary:Privat Brain Pro Hauptablageordner/a.pdf"));
        assertFalse(OrdnerWahl.liegtIn(EXT, HAUPT, "com.android.providers.downloads.documents", HAUPT + "/a.pdf"));
        assertFalse(OrdnerWahl.liegtIn("com.example.cloud", HAUPT, "com.example.cloud", HAUPT + "/a.pdf"));   // fremde Kennungen: keine Aussage
        assertFalse(OrdnerWahl.liegtIn(EXT, null, EXT, HAUPT));
    }
}
