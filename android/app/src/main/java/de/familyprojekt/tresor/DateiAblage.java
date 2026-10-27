package de.familyprojekt.tresor;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Ablage über java.io.File: Proben auf der JVM und die Windows-Java-Engine. */
public final class DateiAblage implements Ablage {
    private final File wurzel;

    public DateiAblage(File wurzel) { this.wurzel = wurzel; }

    static String pruefen(String pfad) throws IOException {
        if (pfad == null) throw new IOException("TRESOR_PFAD");
        if (pfad.isEmpty()) return pfad;
        for (String teil : pfad.split("/", -1))
            if (teil.isEmpty() || teil.equals(".") || teil.equals("..") || teil.indexOf('\\') >= 0 || teil.indexOf(':') >= 0) throw new IOException("TRESOR_PFAD");
        return pfad;
    }

    private File datei(String pfad) throws IOException {
        pruefen(pfad);
        return pfad.isEmpty() ? wurzel : new File(wurzel, pfad.replace('/', File.separatorChar));
    }

    @Override public List<String> liste(String ordner) throws IOException {
        String[] namen = datei(ordner).list();
        if (namen == null) return new ArrayList<>();
        Arrays.sort(namen);
        return new ArrayList<>(Arrays.asList(namen));
    }
    @Override public boolean gibtEs(String pfad) throws IOException { return datei(pfad).exists(); }
    @Override public boolean istOrdner(String pfad) throws IOException { return datei(pfad).isDirectory(); }
    @Override public void ordner(String pfad) throws IOException {
        File f = datei(pfad);
        if (!f.isDirectory() && !f.mkdirs() && !f.isDirectory()) throw new IOException("TRESOR_ORDNER_NICHT_ERREICHBAR");
    }
    @Override public byte[] lesen(String pfad, int grenze) throws IOException {
        try (InputStream in = new FileInputStream(datei(pfad)); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] puffer = new byte[8192]; int n;
            while ((n = in.read(puffer)) != -1) { if (out.size() + n > grenze) throw new IOException("TRESOR_BESCHAEDIGT"); out.write(puffer, 0, n); }
            return out.toByteArray();
        }
    }
    @Override public OutputStream neu(String pfad) throws IOException {
        File f = datei(pfad);
        if (pfad.isEmpty()) throw new IOException("TRESOR_PFAD");
        File eltern = f.getParentFile();
        if (eltern != null && !eltern.isDirectory() && !eltern.mkdirs()) throw new IOException("TRESOR_ORDNER_NICHT_ERREICHBAR");
        if (!f.createNewFile()) throw new IOException("TRESOR_DATEI_DA");
        return new FileOutputStream(f);
    }
    @Override public Kanal kanal(String pfad) throws IOException {
        FileInputStream in = new FileInputStream(datei(pfad));
        return new Kanal(in.getChannel(), in);
    }
    @Override public long groesse(String pfad) throws IOException { return datei(pfad).length(); }
    @Override public void loeschen(String pfad) throws IOException {
        File f = datei(pfad);
        if (f.exists() && !f.delete()) throw new IOException("TRESOR_ORDNER_NICHT_ERREICHBAR");
    }
}
