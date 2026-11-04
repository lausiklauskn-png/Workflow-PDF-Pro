package de.familyprojekt.tresor;

import java.io.IOException;
import java.io.OutputStream;
import java.util.List;

/**
 * Ein Ordner innerhalb einer Ablage als eigene Ablage: alle Pfade bekommen {@code praefix/} vorne. So kann eine App
 * den Speicherort (z. B. die SD-Karte) gewählt haben und trotzdem genau im Tresor-Hauptordner darin arbeiten
 * ({@link Hauptordner}). Der Präfix wird wie jeder Pfad geprüft: keine leeren Teile, nie „.“ oder „..“.
 */
public final class UnterAblage implements Ablage {
    private final Ablage basis;
    private final String praefix;

    public UnterAblage(Ablage basis, String praefix) throws IOException {
        if (basis == null || praefix == null || praefix.isEmpty() || praefix.startsWith("/") || praefix.endsWith("/")) throw new IOException("TRESOR_PFAD_UNGUELTIG");
        for (String teil : praefix.split("/", -1)) if (teil.isEmpty() || teil.equals(".") || teil.equals("..")) throw new IOException("TRESOR_PFAD_UNGUELTIG");
        this.basis = basis; this.praefix = praefix;
    }

    /** Der Präfix relativ zur gewählten Ablage (zum Merken neben der Freigabe). */
    public String praefix() { return praefix; }

    private String p(String pfad) { return pfad == null || pfad.isEmpty() ? praefix : praefix + "/" + pfad; }

    @Override public List<String> liste(String ordner) throws IOException { return basis.liste(p(ordner)); }
    @Override public boolean gibtEs(String pfad) throws IOException { return basis.gibtEs(p(pfad)); }
    @Override public boolean istOrdner(String pfad) throws IOException { return basis.istOrdner(p(pfad)); }
    @Override public void ordner(String pfad) throws IOException { basis.ordner(p(pfad)); }
    @Override public byte[] lesen(String pfad, int grenze) throws IOException { return basis.lesen(p(pfad), grenze); }
    @Override public OutputStream neu(String pfad) throws IOException { return basis.neu(p(pfad)); }
    @Override public Kanal kanal(String pfad) throws IOException { return basis.kanal(p(pfad)); }
    @Override public long groesse(String pfad) throws IOException { return basis.groesse(p(pfad)); }
    @Override public void loeschen(String pfad) throws IOException { basis.loeschen(p(pfad)); }
}
