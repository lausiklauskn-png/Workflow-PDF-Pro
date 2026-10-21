package de.familyprojekt.workflowpdf.pro;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.util.Base64;
import org.json.JSONArray;

/** App-created export tickets only. JavaScript never supplies a filesystem path or content URI. */
@CapacitorPlugin(name = "WorkflowFiles")
public final class ProFilesPlugin extends Plugin {
    private final PluginWorker worker = new PluginWorker("exports");
    private final Map<String, Transfer> transfers = new HashMap<>();
    private String saving;
    private static final int CHUNK = 262144;
    private static final class Transfer {
        File file; String name, mime; long size; boolean finished;
    }
    private interface Work { JSObject run() throws Exception; }
    private void work(PluginCall call, Work fn) {
        worker.submit(call, () -> {
            try { call.resolve(fn.run()); }
            catch (Exception error) { call.reject(error instanceof SecurityException ? "FILE_PERMISSION" : "FILE_OPERATION_FAILED"); }
        });
    }
    static String filename(String value) {
        String name = value == null ? "Dokument" : value.replaceAll("[\\p{Cntrl}/\\\\]", "_").trim();
        if (name.isEmpty() || name.equals(".") || name.equals("..")) return "Dokument";
        return name;
    }
    static long integer(Object value) throws IOException {
        if (!(value instanceof Number)) throw new IOException("INVALID_NUMBER");
        double number = ((Number) value).doubleValue();
        if (!Double.isFinite(number) || number < 0 || number != Math.rint(number) || number > 9007199254740991d) throw new IOException("INVALID_NUMBER");
        return ((Number) value).longValue();
    }
    private Transfer transfer(String id, boolean finished) throws IOException {
        Transfer t = transfers.get(id);
        if (t == null || t.finished != finished) throw new IOException("INVALID_TICKET");
        return t;
    }
    @PluginMethod public void begin(PluginCall call) {
        work(call, () -> {
            File directory = new File(getContext().getCacheDir(), "workflow-exports");
            if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException();
            String id = UUID.randomUUID().toString();
            File place = new File(directory, id);
            if (!place.mkdir()) throw new IOException();
            Transfer t = new Transfer(); t.name = filename(call.getString("name"));
            t.mime = call.getString("mime", "application/octet-stream");
            if (!t.mime.matches("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+")) t.mime = "application/octet-stream";
            t.file = new File(place, t.name);
            if (!t.file.createNewFile()) throw new IOException();
            transfers.put(id, t); return new JSObject().put("id", id);
        });
    }
    @PluginMethod public void append(PluginCall call) {
        work(call, () -> {
            Transfer t = transfer(call.getString("id"), false);
            long offset = integer(call.getData().opt("offset")); String data = call.getString("data", "");
            if (offset != t.size || data.length() > (CHUNK + 2) / 3 * 4) throw new IOException();
            byte[] bytes = Base64.decode(data, Base64.NO_WRAP);
            if (bytes.length > CHUNK || t.file.getUsableSpace() < bytes.length) throw new IOException();
            try (FileOutputStream out = new FileOutputStream(t.file, true)) { out.write(bytes); out.getFD().sync(); }
            t.size += bytes.length; return new JSObject().put("size", t.size);
        });
    }
    static byte[] hash(InputStream input) throws Exception {
        try (InputStream in = input) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256"); byte[] buffer = new byte[CHUNK]; int n;
            while ((n = in.read(buffer)) != -1) if (n > 0) digest.update(buffer, 0, n);
            return digest.digest();
        }
    }
    @PluginMethod public void finish(PluginCall call) {
        work(call, () -> {
            Transfer t = transfer(call.getString("id"), false);
            long size = integer(call.getData().opt("size"));
            if (size != t.size || t.file.length() != size) throw new IOException();
            t.finished = true; return new JSObject().put("size", t.size);
        });
    }
    @PluginMethod public void abort(PluginCall call) {
        work(call, () -> {
            Transfer t = transfers.remove(call.getString("id"));
            if (t != null) { t.file.delete(); t.file.getParentFile().delete(); }
            return new JSObject();
        });
    }
    @PluginMethod public void save(PluginCall call) {
        worker.submit(call, () -> {
            try {
                Transfer t = transfer(call.getString("id"), true);
                if (saving != null) { call.reject("FILE_BUSY"); return; }
                saving = call.getString("id");
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(t.mime).putExtra(Intent.EXTRA_TITLE, t.name);
                getActivity().runOnUiThread(() -> {
                    try { startActivityForResult(call, intent, "saved"); }
                    catch (Exception error) { worker.execute(() -> saving = null); call.reject("FILE_PICKER_UNAVAILABLE"); }
                });
            } catch (Exception error) { call.reject("FILE_OPERATION_FAILED"); }
        });
    }
    @ActivityCallback private void saved(PluginCall call, ActivityResult result) {
        if (call == null) { worker.execute(() -> saving = null); return; }
        worker.submit(call, () -> {
            try {
                Transfer t = transfer(saving, true);
                if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
                    call.resolve(new JSObject().put("cancelled", true)); return;
                }
                Uri uri = result.getData().getData();
                if (!"content".equals(uri.getScheme())) throw new SecurityException();
                try (InputStream in = new FileInputStream(t.file); OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (out == null) throw new IOException();
                    byte[] bytes = new byte[CHUNK]; int n;
                    while ((n = in.read(bytes)) != -1) if (n > 0) out.write(bytes, 0, n);
                    out.flush();
                }
                if (!MessageDigest.isEqual(hash(new FileInputStream(t.file)), hash(getContext().getContentResolver().openInputStream(uri)))) throw new IOException();
                call.resolve(new JSObject().put("saved", true));
            } catch (Exception error) { call.reject("FILE_SAVE_FAILED"); }
            finally { saving = null; }
        });
    }
    @PluginMethod public void share(PluginCall call) {
        worker.submit(call, () -> {
            try {
                JSONArray ids = call.getArray("ids", new com.getcapacitor.JSArray());
                ArrayList<Uri> uris = new ArrayList<>(); String mime = null;
                for (int i = 0; i < ids.length(); i++) {
                    Transfer t = transfer(ids.getString(i), true);
                    uris.add(FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", t.file));
                    mime = mime == null ? t.mime : mime.equals(t.mime) ? mime : "*/*";
                }
                Intent intent = new Intent(uris.size() > 1 ? Intent.ACTION_SEND_MULTIPLE : Intent.ACTION_SEND);
                intent.setType(mime == null ? "text/plain" : mime);
                String text = call.getString("text", ""), url = call.getString("url", "");
                if (!url.isEmpty()) {
                    Uri link = Uri.parse(url);
                    if (!Arrays.asList("https", "http").contains(link.getScheme())) throw new SecurityException();
                    text += (text.isEmpty() ? "" : "\n") + url;
                }
                intent.putExtra(Intent.EXTRA_TEXT, text).putExtra(Intent.EXTRA_SUBJECT, call.getString("title", ""));
                if (uris.size() == 1) intent.putExtra(Intent.EXTRA_STREAM, uris.get(0));
                if (uris.size() > 1) intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
                if (!uris.isEmpty()) {
                    ClipData clips = ClipData.newUri(getContext().getContentResolver(), "Workflow PDF Pro", uris.get(0));
                    for (int i = 1; i < uris.size(); i++) clips.addItem(new ClipData.Item(uris.get(i)));
                    intent.setClipData(clips);
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                }
                Intent chooser = Intent.createChooser(intent, call.getString("title", "Workflow PDF Pro"));
                getActivity().runOnUiThread(() -> {
                    try { startActivityForResult(call, chooser, "shared"); }
                    catch (Exception error) { call.reject("SHARE_UNAVAILABLE"); }
                });
            } catch (Exception error) { call.reject("FILE_OPERATION_FAILED"); }
        });
    }
    @ActivityCallback private void shared(PluginCall call, ActivityResult result) {
        // Android's chooser does not reliably report delivery/cancellation. Do not claim delivery.
        if (call != null) call.resolve(new JSObject().put("opened", true).put("deliveryConfirmed", false));
    }
    @PluginMethod public void openLink(PluginCall call) {
        String url = call.getString("url", ""); Uri uri = Uri.parse(url);
        if (!Arrays.asList("https", "http", "mailto", "tel").contains(uri.getScheme())) { call.reject("LINK_NOT_ALLOWED"); return; }
        getActivity().runOnUiThread(() -> {
            try { getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); call.resolve(); }
            catch (Exception error) { call.reject("LINK_UNAVAILABLE"); }
        });
    }
    @PluginMethod public void print(PluginCall call) {
        worker.submit(call, () -> {
            try {
                Transfer t = transfer(call.getString("id"), true);
                if (!"application/pdf".equals(t.mime)) throw new IOException();
                getActivity().runOnUiThread(() -> {
                    try {
                        android.print.PrintManager manager = (android.print.PrintManager) getActivity().getSystemService(android.content.Context.PRINT_SERVICE);
                        manager.print(t.name, new PdfPrintAdapter(t.file, t.name), null);
                        call.resolve(new JSObject().put("opened", true).put("printed", false));
                    } catch (Exception error) { call.reject("PRINT_UNAVAILABLE"); }
                });
            } catch (Exception error) { call.reject("PRINT_UNAVAILABLE"); }
        });
    }
    @Override protected void handleOnDestroy(){worker.close(()->{
        // Finished shared files may still be read by the receiving application.
        for(Transfer transfer:transfers.values())if(!transfer.finished){transfer.file.delete();transfer.file.getParentFile().delete();}
        transfers.clear();
    });}
}
