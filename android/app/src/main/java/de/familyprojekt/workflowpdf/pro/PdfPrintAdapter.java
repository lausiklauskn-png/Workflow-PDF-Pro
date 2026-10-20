package de.familyprojekt.workflowpdf.pro;

import android.graphics.pdf.PdfRenderer;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.*;
import java.io.*;

/** Supplies the original PDF to the Android print spooler; no canvas rasterisation. */
final class PdfPrintAdapter extends PrintDocumentAdapter {
    private final File file;
    private final String name;
    PdfPrintAdapter(File file, String name) { this.file = file; this.name = name; }
    @Override public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
            CancellationSignal cancellation, LayoutResultCallback callback, Bundle extras) {
        if (cancellation.isCanceled()) { callback.onLayoutCancelled(); return; }
        try (PdfRenderer pdf = new PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY))) {
            callback.onLayoutFinished(new PrintDocumentInfo.Builder(name).setPageCount(pdf.getPageCount())
                .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).build(), !newAttributes.equals(oldAttributes));
        } catch (Exception error) { callback.onLayoutFailed("PDF unavailable"); }
    }
    @Override public void onWrite(PageRange[] ranges, ParcelFileDescriptor destination,
            CancellationSignal cancellation, WriteResultCallback callback) {
        // The spooler receives all original pages and applies the requested page selection.
        try (InputStream in = new FileInputStream(file);
             OutputStream out = new FileOutputStream(destination.getFileDescriptor())) {
            byte[] buffer = new byte[262144]; int n;
            while ((n = in.read(buffer)) != -1) {
                if (cancellation.isCanceled()) { callback.onWriteCancelled(); return; }
                if (n > 0) out.write(buffer, 0, n);
            }
            out.flush(); callback.onWriteFinished(new PageRange[] { PageRange.ALL_PAGES });
        } catch (Exception error) { callback.onWriteFailed("PDF unavailable"); }
    }
}
