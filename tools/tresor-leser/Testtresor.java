import de.familyprojekt.tresor.DateiAblage;
import de.familyprojekt.tresor.Eintrag;
import de.familyprojekt.tresor.TresorOrdner;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

/**
 * Baut für die Probe des Tresor-Lesers einen Testtresor mit dem echten Paket de.familyprojekt.tresor (erfundene Inhalte).
 *   java Testtresor <leerer Ordner> <Passwort> <Ordner mit Klartext-Kopien>
 * Inhalt: Workflow PDF Pro legt ein kleines PDF und eine Textdatei über drei PBV1-Blöcke ab, Familienakte ein Bild,
 * Private Brain trägt eine Zeile im eigenen Format („app“) ein. Die Klartexte gehen zum Vergleich in den dritten Ordner.
 */
public final class Testtresor {
    public static void main(String[] args) throws Exception {
        File ziel = new File(args[0]), klar = new File(args[2]);
        String pw = args[1];
        klar.mkdirs();
        DateiAblage a = new DateiAblage(ziel);
        byte[] pdf = ("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj "
            + "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n").getBytes(StandardCharsets.US_ASCII);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; sb.length() < 600 * 1024; i++) sb.append("Zeile ").append(i).append(": Testtresor, erfundener Inhalt – Ä Ö Ü ß €\n");
        byte[] text = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] png = java.util.Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
        try (TresorOrdner t = TresorOrdner.anlegen(a, "workflow-pdf-pro", pw)) {
            t.ablegen("workflow-pdf-pro", "", "Rechnung Muster 2026.pdf", "application/pdf", 1762200000000L, new ByteArrayInputStream(pdf), "Rechnung Nr. 42, erfunden");
            t.ablegen("workflow-pdf-pro", "Notizen", "Lange Notiz.txt", "text/plain", 1762300000000L, new ByteArrayInputStream(text), "");
        }
        try (TresorOrdner t = TresorOrdner.oeffnen(a, "familienakte", pw)) {
            t.ablegen("familienakte", "", "Punkt.png", "image/png", 1762100000000L, new ByteArrayInputStream(png), "Ein Bildpunkt");
        }
        try (TresorOrdner t = TresorOrdner.oeffnen(a, "private-brain", pw)) {
            t.fachAnlegen("private-brain");
            Eintrag e = new Eintrag();
            e.id = "a1b2c3d4"; e.name = "Mail von Muster GmbH"; e.art = "message/rfc822"; e.datum = 1762000000000L; e.groesse = 1234;
            e.auszug = "Betreff: Angebot"; e.verweis = "Mails/a1b2c3d4"; e.schreiber = "private-brain"; e.verschluesselung = "app"; e.sha256 = "";
            List<Eintrag> l = new ArrayList<>(); l.add(e);
            t.verzeichnisSchreiben("private-brain", l);
        }
        Files.write(new File(klar, "Rechnung Muster 2026.pdf").toPath(), pdf);
        Files.write(new File(klar, "Lange Notiz.txt").toPath(), text);
        Files.write(new File(klar, "Punkt.png").toPath(), png);
        System.out.println("Testtresor angelegt");
    }
}
