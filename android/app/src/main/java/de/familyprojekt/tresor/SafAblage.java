package de.familyprojekt.tresor;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Ablage über Androids Speicherzugriff (SAF) auf einem gewählten Ordner (Baum-URI mit dauerhafter
 * Freigabe). Gespeichert werden immer relative Namen, nie Android-Dokumentkennungen — derselbe
 * Ordner öffnet so auch auf einem anderen Gerät, einer anderen SD-Karte oder unter Windows.
 * Nicht thread-sicher: die App ruft alles aus einem Arbeits-Thread.
 */
public final class SafAblage implements Ablage {
    private static final String DIR = DocumentsContract.Document.MIME_TYPE_DIR;
    private final ContentResolver resolver;
    private final Uri baum;
    private final String wurzel;
    private final Map<String, String> kennungen = new HashMap<>();

    public SafAblage(ContentResolver resolver, Uri baum) {
        this(resolver, baum, DocumentsContract.getTreeDocumentId(baum));
    }

    public SafAblage(ContentResolver resolver, Uri baum, String wurzelKennung) {
        this.resolver = resolver; this.baum = baum; this.wurzel = wurzelKennung;
    }

    private static IOException fehler(String code) { return new IOException(code); }
    private Uri dok(String kennung) { return DocumentsContract.buildDocumentUriUsingTree(baum, kennung); }

    private static final class Kind { String kennung, name, art; }

    private List<Kind> kinder(String kennung) throws IOException {
        List<Kind> aus = new ArrayList<>();
        String[] spalten = { DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE };
        try (Cursor c = resolver.query(DocumentsContract.buildChildDocumentsUriUsingTree(baum, kennung), spalten, null, null, null)) {
            if (c == null) throw fehler("TRESOR_ORDNER_NICHT_ERREICHBAR");
            while (c.moveToNext()) { Kind k = new Kind(); k.kennung = c.getString(0); k.name = c.getString(1); k.art = c.getString(2); aus.add(k); }
        } catch (SecurityException | IllegalArgumentException e) { throw fehler("TRESOR_ORDNER_NICHT_ERREICHBAR"); }
        return aus;
    }

    private Kind kind(String eltern, String name) throws IOException {
        for (Kind k : kinder(eltern)) if (name.equals(k.name)) return k;
        return null;
    }

    /** Dokumentkennung zu einem Pfad oder null. */
    private String finden(String pfad) throws IOException {
        DateiAblage.pruefen(pfad);
        if (pfad.isEmpty()) return wurzel;
        String da = kennungen.get(pfad);
        if (da != null) return da;
        String aktuell = wurzel, bisher = "";
        for (String teil : pfad.split("/")) {
            bisher = bisher.isEmpty() ? teil : bisher + "/" + teil;
            String gemerkt = kennungen.get(bisher);
            if (gemerkt != null) { aktuell = gemerkt; continue; }
            Kind k = kind(aktuell, teil);
            if (k == null) return null;
            aktuell = k.kennung;
            if (DIR.equals(k.art)) kennungen.put(bisher, aktuell);
        }
        return aktuell;
    }

    private String eltern(String pfad) { int i = pfad.lastIndexOf('/'); return i < 0 ? "" : pfad.substring(0, i); }
    private String name(String pfad) { return pfad.substring(pfad.lastIndexOf('/') + 1); }

    private String anlegen(String elternKennung, String art, String name) throws IOException {
        try {
            Uri uri = DocumentsContract.createDocument(resolver, dok(elternKennung), art, name);
            if (uri == null) throw fehler("TRESOR_ORDNER_NICHT_ERREICHBAR");
            String kennung = DocumentsContract.getDocumentId(uri);
            // Manche Anbieter hängen „ (1)“ an, wenn der Name schon da war: dann nichts davon behalten.
            Kind probe = null;
            for (Kind k : kinder(elternKennung)) if (kennung.equals(k.kennung)) probe = k;
            if (probe == null || !name.equals(probe.name)) {
                try { DocumentsContract.deleteDocument(resolver, uri); } catch (Exception ignoriert) { }
                throw fehler("TRESOR_DATEI_DA");
            }
            return kennung;
        } catch (SecurityException e) { throw fehler("TRESOR_ORDNER_NICHT_ERREICHBAR"); }
    }

    @Override public List<String> liste(String ordner) throws IOException {
        String k = finden(ordner);
        List<String> aus = new ArrayList<>();
        if (k == null) return aus;
        for (Kind c : kinder(k)) if (c.name != null) aus.add(c.name);
        Collections.sort(aus);
        return aus;
    }

    @Override public boolean gibtEs(String pfad) throws IOException { return finden(pfad) != null; }

    @Override public boolean istOrdner(String pfad) throws IOException {
        if (pfad.isEmpty()) return true;
        String k = finden(eltern(pfad));
        if (k == null) return false;
        Kind c = kind(k, name(pfad));
        return c != null && DIR.equals(c.art);
    }

    @Override public void ordner(String pfad) throws IOException {
        DateiAblage.pruefen(pfad);
        if (pfad.isEmpty()) return;
        String aktuell = wurzel, bisher = "";
        for (String teil : pfad.split("/")) {
            bisher = bisher.isEmpty() ? teil : bisher + "/" + teil;
            Kind k = kind(aktuell, teil);
            if (k == null) aktuell = anlegen(aktuell, DIR, teil);
            else if (!DIR.equals(k.art)) throw fehler("TRESOR_ORDNER_NICHT_ERREICHBAR");
            else aktuell = k.kennung;
            kennungen.put(bisher, aktuell);
        }
    }

    @Override public byte[] lesen(String pfad, int grenze) throws IOException {
        String k = finden(pfad);
        if (k == null) throw fehler("TRESOR_DATEI_FEHLT");
        try (InputStream in = resolver.openInputStream(dok(k)); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) throw fehler("TRESOR_ORDNER_NICHT_ERREICHBAR");
            byte[] puffer = new byte[8192]; int n;
            while ((n = in.read(puffer)) != -1) { if (out.size() + n > grenze) throw fehler("TRESOR_BESCHAEDIGT"); out.write(puffer, 0, n); }
            return out.toByteArray();
        } catch (SecurityException e) { throw fehler("TRESOR_ORDNER_NICHT_ERREICHBAR"); }
    }

    @Override public OutputStream neu(String pfad) throws IOException {
        DateiAblage.pruefen(pfad);
        if (pfad.isEmpty()) throw fehler("TRESOR_PFAD");
        ordner(eltern(pfad));
        String e = finden(eltern(pfad));
        if (kind(e, name(pfad)) != null) throw fehler("TRESOR_DATEI_DA");
        String art = pfad.endsWith(".json") ? "application/json" : "application/octet-stream";
        String k = anlegen(e, art, name(pfad));
        try {
            OutputStream out = resolver.openOutputStream(dok(k), "w");
            if (out == null) throw fehler("TRESOR_ORDNER_NICHT_ERREICHBAR");
            return out;
        } catch (SecurityException x) { throw fehler("TRESOR_ORDNER_NICHT_ERREICHBAR"); }
    }

    @Override public Kanal kanal(String pfad) throws IOException {
        String k = finden(pfad);
        if (k == null) throw fehler("TRESOR_DATEI_FEHLT");
        try {
            ParcelFileDescriptor pfd = resolver.openFileDescriptor(dok(k), "r");
            if (pfd == null) throw fehler("TRESOR_ORDNER_NICHT_ERREICHBAR");
            return new Kanal(new FileInputStream(pfd.getFileDescriptor()).getChannel(), pfd);
        } catch (SecurityException e) { throw fehler("TRESOR_ORDNER_NICHT_ERREICHBAR"); }
    }

    @Override public long groesse(String pfad) throws IOException {
        String k = finden(pfad);
        if (k == null) throw fehler("TRESOR_DATEI_FEHLT");
        try (Cursor c = resolver.query(dok(k), new String[] {DocumentsContract.Document.COLUMN_SIZE}, null, null, null)) {
            if (c == null || !c.moveToFirst()) throw fehler("TRESOR_ORDNER_NICHT_ERREICHBAR");
            return c.getLong(0);
        } catch (SecurityException e) { throw fehler("TRESOR_ORDNER_NICHT_ERREICHBAR"); }
    }

    @Override public void loeschen(String pfad) throws IOException {
        String k = finden(pfad);
        if (k == null) return;
        try { DocumentsContract.deleteDocument(resolver, dok(k)); }
        catch (Exception e) { throw fehler("TRESOR_ORDNER_NICHT_ERREICHBAR"); }
        kennungen.remove(pfad);
    }
}
