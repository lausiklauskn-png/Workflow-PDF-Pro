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
    private final PluginWorker worker=new PluginWorker("printing");
    PdfPrintAdapter(File file, String name) { this.file = file; this.name = name; }
    interface LayoutResult { void finished(PrintDocumentInfo info,boolean changed); void failed(CharSequence message); void cancelled(); }
    interface WriteResult { void finished(PageRange[] ranges); void failed(CharSequence message); void cancelled(); }
    @Override public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
            CancellationSignal cancellation, LayoutResultCallback callback, Bundle extras) {
        layoutAsync(oldAttributes,newAttributes,cancellation,new LayoutResult(){
            public void finished(PrintDocumentInfo info,boolean changed){callback.onLayoutFinished(info,changed);}
            public void failed(CharSequence message){callback.onLayoutFailed(message);}
            public void cancelled(){callback.onLayoutCancelled();}
        });
    }
    void layoutAsync(PrintAttributes oldAttributes,PrintAttributes newAttributes,CancellationSignal cancellation,LayoutResult callback){
        if(!worker.submit(null,()->layout(oldAttributes,newAttributes,cancellation,callback)))callback.cancelled();
    }
    private void layout(PrintAttributes oldAttributes,PrintAttributes newAttributes,CancellationSignal cancellation,LayoutResult callback){
        if (cancellation.isCanceled()) { callback.cancelled(); return; }
        PrintDocumentInfo info;
        try (ParcelFileDescriptor source=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);PdfRenderer pdf = new PdfRenderer(source)) {
            info=new PrintDocumentInfo.Builder(name).setPageCount(pdf.getPageCount()).setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).build();
        } catch (Exception error) { callback.failed("PDF unavailable");return; }
        if(cancellation.isCanceled())callback.cancelled();else callback.finished(info,!newAttributes.equals(oldAttributes));
    }
    @Override public void onWrite(PageRange[] ranges, ParcelFileDescriptor destination,
            CancellationSignal cancellation, WriteResultCallback callback) {
        writeAsync(destination,cancellation,new WriteResult(){
            public void finished(PageRange[] ranges){callback.onWriteFinished(ranges);}
            public void failed(CharSequence message){callback.onWriteFailed(message);}
            public void cancelled(){callback.onWriteCancelled();}
        });
    }
    void writeAsync(ParcelFileDescriptor destination,CancellationSignal cancellation,WriteResult callback){
        if(!worker.submit(null,()->write(destination,cancellation,callback))){try{destination.close();}catch(IOException ignored){}callback.cancelled();}
    }
    private void write(ParcelFileDescriptor destination,CancellationSignal cancellation,WriteResult callback){
        if(cancellation.isCanceled()){try{destination.close();}catch(IOException ignored){}callback.cancelled();return;}
        // The spooler receives all original pages and applies the requested page selection.
        try (InputStream in = new FileInputStream(file);
             OutputStream out = new ParcelFileDescriptor.AutoCloseOutputStream(destination)) {
            byte[] buffer = new byte[262144]; int n;
            while ((n = in.read(buffer)) != -1) {
                if (cancellation.isCanceled())break;
                if (n > 0) out.write(buffer, 0, n);
            }
            out.flush();
        } catch (Exception error) {if(cancellation.isCanceled())callback.cancelled();else callback.failed("PDF unavailable");return;}
        if(cancellation.isCanceled())callback.cancelled();else callback.finished(new PageRange[] { PageRange.ALL_PAGES });
    }
    @Override public void onFinish(){worker.close(()->{});}
}
