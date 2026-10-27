package de.familyprojekt.tresor;

import java.io.Closeable;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.channels.FileChannel;
import java.util.List;

/**
 * Der gewählte Ordner, unabhängig vom Gerät: Android (SAF, {@code SafAblage}), JVM/Windows
 * ({@code DateiAblage}). Pfade sind relativ zum gewählten Ordner, Teile mit „/“ getrennt,
 * nie „..“ oder leer. Die Ordnerschicht ruft {@link #loeschen} nur für ihre eigenen
 * Verwaltungsdateien unter {@code Tresorordner/} auf, nie in einem Fach.
 */
public interface Ablage {
    /** Namen der Kinder eines Ordners; leere Liste, wenn es den Ordner nicht gibt. */
    List<String> liste(String ordner) throws IOException;
    boolean gibtEs(String pfad) throws IOException;
    boolean istOrdner(String pfad) throws IOException;
    /** Legt den Ordner (und fehlende Eltern) an; vorhanden ist kein Fehler. */
    void ordner(String pfad) throws IOException;
    /** Ganze kleine Datei; über der Grenze ist sie beschädigt. */
    byte[] lesen(String pfad, int grenze) throws IOException;
    /** Neue Datei; gibt es den Namen schon, wird nichts geschrieben ({@code TRESOR_DATEI_DA}). */
    OutputStream neu(String pfad) throws IOException;
    /** Zum Lesen mit wahlfreiem Zugriff; {@code besitzer} wird mit dem Kanal geschlossen. */
    Kanal kanal(String pfad) throws IOException;
    long groesse(String pfad) throws IOException;
    void loeschen(String pfad) throws IOException;

    final class Kanal {
        public final FileChannel kanal;
        public final Closeable besitzer;
        public Kanal(FileChannel kanal, Closeable besitzer) { this.kanal = kanal; this.besitzer = besitzer; }
    }
}
