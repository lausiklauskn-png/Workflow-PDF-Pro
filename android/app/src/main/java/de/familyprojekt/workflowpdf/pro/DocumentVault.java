package de.familyprojekt.workflowpdf.pro;

import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.text.Normalizer;
import java.util.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import org.json.*;

/** SAF location + the password/chunk format used in Private Brain Pro, with an
 * independent Workflow identity and a generic record index. No mail or foreign keys.
 * All calls are serialised by WorkflowVault's executor. */
final class DocumentVault {
    static final String FOLDER = "Workflow PDF Pro", HEADER = "workflow-pdf-pro.tresor.json";
    static final String FORMAT = "workflow-pdf-pro-vault", DEVICE_ALIAS = "workflow-pdf-pro-vault-remember-v1";
    static final String DIR = DocumentsContract.Document.MIME_TYPE_DIR;
    static final Set<String> STORES = new HashSet<>(Arrays.asList("folders", "docs", "files", "texte", "vektoren", "settings"));
    private final Context context;
    private final ContentResolver resolver;
    private SharedPreferences prefs;
    private final String deviceAlias;
    private Place active;
    private final Map<String, Pending> pending = new HashMap<>();
    private Batch batch;
    private static final class Batch { Place place; JSONObject index; Set<String> created=new HashSet<>(); }
    private JSONObject visibleIndex(Place p){return batch!=null&&batch.place==p?batch.index:p.index;}
    static final class Place { Uri tree; String root, id, label; byte[] key; long revision; JSONObject index = new JSONObject(); List<String> setupObjects; }
    static final class Entry { String id, name, mime; }
    static final class Pending { String store, id; File file; long size; Place place; JSONObject reference; }
    DocumentVault(Context context) {
        this(context, "workflow-vault-v1", DEVICE_ALIAS);
    }
    DocumentVault(Context context, String preferences, String alias) {
        this.context = context.getApplicationContext(); resolver = context.getContentResolver();
        prefs = context.getSharedPreferences(preferences, Context.MODE_PRIVATE); deviceAlias = alias;
    }
    private static IOException failure(String code) { return new IOException(code); }
    private static byte[] bytes(String text) { return text.getBytes(StandardCharsets.UTF_8); }
    private static String b64(byte[] value) { return Base64.encodeToString(value, Base64.NO_WRAP); }
    private static byte[] un64(String value) { return Base64.decode(value, Base64.NO_WRAP); }
    private static String logical(Place p, String kind) { return FORMAT + ":" + p.id + ":" + kind; }
    private static String recordName(String store, String id) throws IOException {
        if (!STORES.contains(store) || id == null || id.isEmpty()) throw failure("VAULT_INVALID_RECORD");
        return store + ":" + id;
    }
    private static Uri doc(Place p, String id) { return DocumentsContract.buildDocumentUriUsingTree(p.tree, id); }
    private List<Entry> children(Place p, String parent) throws IOException {
        ArrayList<Entry> result = new ArrayList<>();
        String[] columns = { DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE };
        try (Cursor cursor = resolver.query(DocumentsContract.buildChildDocumentsUriUsingTree(p.tree, parent), columns, null, null, null)) {
            if (cursor == null) throw failure("VAULT_FOLDER_UNAVAILABLE");
            while (cursor.moveToNext()) { Entry entry = new Entry(); entry.id = cursor.getString(0); entry.name = cursor.getString(1); entry.mime = cursor.getString(2); result.add(entry); }
        } catch (SecurityException | IllegalArgumentException error) { throw failure("VAULT_FOLDER_UNAVAILABLE"); }
        return result;
    }
    private Entry child(Place p, String parent, String name) throws IOException {
        for (Entry e : children(p, parent)) if (name.equals(e.name)) return e;
        return null;
    }
    private String displayName(Place p, String id) throws IOException {
        try (Cursor c = resolver.query(doc(p, id), new String[] {DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
            if (c == null || !c.moveToFirst()) throw failure("VAULT_FOLDER_UNAVAILABLE");
            return c.getString(0);
        }
    }
    private String create(Place p, String parent, String mime, String name) throws IOException {
        if (child(p, parent, name) != null) throw failure("VAULT_FILE_EXISTS");
        try {
            Uri uri = DocumentsContract.createDocument(resolver, doc(p, parent), mime, name);
            if (uri == null) throw failure("VAULT_FOLDER_UNAVAILABLE");
            String id = DocumentsContract.getDocumentId(uri);
            if (p.setupObjects != null) p.setupObjects.add(id);
            return id;
        } catch (SecurityException error) { throw failure("VAULT_FOLDER_UNAVAILABLE"); }
    }
    private void delete(Place p, String id) { try { DocumentsContract.deleteDocument(resolver, doc(p, id)); } catch (Exception ignored) { } }
    private byte[] small(Place p, String id, int limit) throws IOException {
        try (InputStream in = resolver.openInputStream(doc(p, id)); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) throw failure("VAULT_FOLDER_UNAVAILABLE");
            byte[] buffer = new byte[8192]; int n;
            while ((n = in.read(buffer)) != -1) { if (out.size() + n > limit) throw failure("VAULT_DAMAGED"); out.write(buffer, 0, n); }
            return out.toByteArray();
        } catch (SecurityException error) { throw failure("VAULT_FOLDER_UNAVAILABLE"); }
    }
    private VaultCrypto.Reader readerId(Place p, String id, String kind) throws IOException {
        ParcelFileDescriptor descriptor = resolver.openFileDescriptor(doc(p, id), "r");
        if (descriptor == null) throw failure("VAULT_FOLDER_UNAVAILABLE");
        try {
            ParcelFileDescriptor.AutoCloseInputStream input = new ParcelFileDescriptor.AutoCloseInputStream(descriptor);
            return new VaultCrypto.Reader(input.getChannel(), input, p.key, logical(p, kind));
        } catch (Exception error) { descriptor.close(); throw error instanceof IOException ? (IOException) error : failure("VAULT_DAMAGED"); }
    }
    private VaultCrypto.Reader reader(Place p, String name, String kind) throws IOException {
        if (name == null || !name.matches("[a-f0-9-]{36}\\.wpv")) throw failure("VAULT_DAMAGED");
        Entry entry = child(p, p.root, name);
        if (entry == null) throw failure("VAULT_RECORD_NOT_FOUND");
        return readerId(p, entry.id, kind);
    }
    private void deleteName(Place p, String name) {
        try { Entry entry = child(p, p.root, name); if (entry != null) delete(p, entry.id); } catch (Exception ignored) { }
    }
    private String encrypted(Place p, String kind, InputStream input) throws Exception {
        String name = UUID.randomUUID() + ".wpv";
        String id = create(p, p.root, "application/octet-stream", name);
        boolean good = false;
        try {
            OutputStream out = resolver.openOutputStream(doc(p, id), "w");
            if (out == null) throw failure("VAULT_FOLDER_UNAVAILABLE");
            VaultCrypto.Writer writer = new VaultCrypto.Writer(out, p.key, logical(p, kind), Long.MAX_VALUE);
            try (InputStream in = input; VaultCrypto.Writer close = writer) {
                byte[] buffer = new byte[VaultCrypto.CHUNK]; int n;
                while ((n = in.read(buffer)) != -1) if (n > 0) writer.write(buffer, 0, n);
            }
            // Verify every chunk before referencing it from a durable index.
            try (VaultCrypto.Reader verify = readerId(p, id, kind)) {
                if (verify.size() != writer.size()) throw failure("VAULT_DAMAGED");
                if (!writer.digestHex().equals(VaultCrypto.hex(ProFilesPlugin.hash(verify.stream())))) throw failure("VAULT_DAMAGED");
            }
            // Persist relative names, never Android document IDs. A copied vault
            // must also open on a different volume and future Windows/iOS hosts.
            good = true; return name;
        } finally { if (!good) delete(p, id); }
    }
    private void index(Place p, JSONObject next) throws Exception {
        long revision = Math.addExact(p.revision, 1);
        JSONObject envelope = new JSONObject().put("app", FORMAT).put("v", 1).put("revision", revision).put("records", next);
        String id = encrypted(p, "index", new ByteArrayInputStream(bytes(envelope.toString())));
        // Persist the commit marker only after the authenticated index is fully written.
        String marker = create(p, p.root, "application/json", "commit-" + String.format(Locale.ROOT, "%020d", revision) + "-" + UUID.randomUUID() + ".json");
        try {
            byte[] data = bytes(new JSONObject().put("index", id).put("revision", revision).toString());
            try (OutputStream out = resolver.openOutputStream(doc(p, marker), "w")) { if (out == null) throw failure("VAULT_FOLDER_UNAVAILABLE"); out.write(data); }
            JSONObject checked = new JSONObject(new String(small(p, marker, 65536), StandardCharsets.UTF_8));
            if (!id.equals(checked.getString("index")) || revision != checked.getLong("revision")) throw failure("VAULT_DAMAGED");
        } catch (Exception error) { delete(p, marker); deleteName(p, id); throw error; }
        p.index = next; p.revision = revision;
        // This local rollback checkpoint is supplementary. A failed cache
        // write must never cause deletion of an already committed external record.
        if (p == active) try { prefs.edit().putLong("revision", revision).commit(); } catch (RuntimeException ignored) { }
        try { prune(p); } catch (Exception ignored) { /* Keep older copies if cleanup cannot be verified. */ }
    }
    private JSONObject readGeneration(Place p, Entry marker) throws Exception {
        JSONObject info = new JSONObject(new String(small(p, marker.id, 65536), StandardCharsets.UTF_8));
        if (!marker.name.startsWith("commit-" + String.format(Locale.ROOT, "%020d", info.getLong("revision")) + "-")) throw failure("VAULT_DAMAGED");
        try (VaultCrypto.Reader input = reader(p, info.getString("index"), "index")) {
            JSONObject state = new JSONObject(new String(VaultCrypto.readAll(input, Integer.MAX_VALUE), StandardCharsets.UTF_8));
            if (!FORMAT.equals(state.getString("app")) || state.getInt("v") != 1 || state.getLong("revision") != info.getLong("revision")) throw failure("VAULT_DAMAGED");
            state.put("physicalIndex", info.getString("index")); return state;
        }
    }
    private void prune(Place p) throws Exception {
        if (p.setupObjects != null) return;
        List<Entry> all = children(p, p.root); ArrayList<Entry> commits = new ArrayList<>();
        Set<String> owned = new HashSet<>();
        for (Entry e : all) {
            if (e.name != null && e.name.matches("[a-f0-9-]{36}\\.wpv")) owned.add(e.name);
            if (e.name != null && e.name.matches("commit-[0-9]{20}-[a-f0-9-]{36}\\.json")) commits.add(e);
        }
        commits.sort((a,b) -> b.name.compareTo(a.name)); if (commits.size() <= 3) return;
        Set<String> retained = new HashSet<>(), expired = new HashSet<>();
        for (int i = 0; i < commits.size(); i++) {
            // Authenticate each generation before considering any deletion.
            JSONObject generation = readGeneration(p, commits.get(i));
            Set<String> target = i < 3 ? retained : expired;
            target.add(generation.getString("physicalIndex"));
            JSONObject records = generation.getJSONObject("records"); Iterator<String> keys = records.keys();
            while (keys.hasNext()) target.add(records.getJSONObject(keys.next()).getString("file"));
        }
        expired.removeAll(retained); expired.retainAll(owned);
        for (String name : expired) deleteName(p, name);
        for (int i = 3; i < commits.size(); i++) delete(p, commits.get(i).id);
    }
    private void loadIndex(Place p) throws Exception {
        ArrayList<Entry> commits = new ArrayList<>();
        for (Entry entry : children(p, p.root)) if (entry.name != null && entry.name.matches("commit-[0-9]{20}-[a-f0-9-]{36}\\.json")) commits.add(entry);
        commits.sort((a, b) -> b.name.compareTo(a.name));
        if (commits.isEmpty()) throw failure("VAULT_DAMAGED");
        // Do not silently ignore a damaged newest commit or restore a stale success state.
        JSONObject marker = new JSONObject(new String(small(p, commits.get(0).id, 65536), StandardCharsets.UTF_8));
        if (!commits.get(0).name.startsWith("commit-" + String.format(Locale.ROOT, "%020d", marker.getLong("revision")) + "-")) throw failure("VAULT_DAMAGED");
        if (p.id.equals(prefs.getString("id", null)) && marker.getLong("revision") < prefs.getLong("revision", 0)) throw failure("VAULT_DAMAGED");
        try (VaultCrypto.Reader in = reader(p, marker.getString("index"), "index")) {
            JSONObject state = new JSONObject(new String(VaultCrypto.readAll(in, Integer.MAX_VALUE), StandardCharsets.UTF_8));
            if (!FORMAT.equals(state.getString("app")) || state.getInt("v") != 1 || state.getLong("revision") != marker.getLong("revision")) throw failure("VAULT_DAMAGED");
            p.index = state.getJSONObject("records"); p.revision = state.getLong("revision");
        }
    }
    Place inspect(Uri tree) throws Exception {
        if (!"content".equals(tree.getScheme())) throw failure("VAULT_FOLDER_UNAVAILABLE");
        Place p = new Place(); p.tree = tree; p.root = DocumentsContract.getTreeDocumentId(tree);
        if (child(p, p.root, HEADER) == null) { Entry own = child(p, p.root, FOLDER); if (own != null && DIR.equals(own.mime)) p.root = own.id; }
        p.label = displayName(p, p.root);
        return p;
    }
    boolean existing(Place p) throws IOException { return child(p, p.root, HEADER) != null; }
    void unlock(CharSequence password, boolean remember) throws Exception {
        if (!configured()) throw failure("VAULT_NOT_CONFIGURED");
        Place p = new Place(); p.tree = Uri.parse(prefs.getString("tree", "")); p.root = prefs.getString("root", ""); p.label = prefs.getString("label", FOLDER);
        open(p, password, remember);
    }
    /** Gespeicherten Tresor mit Ersatzschlüsseln öffnen (Passwort vergessen). */
    void recoverStored(List<String> texts, CharSequence newPassword, boolean remember) throws Exception {
        if (!configured()) throw failure("VAULT_NOT_CONFIGURED");
        Place p = new Place(); p.tree = Uri.parse(prefs.getString("tree", "")); p.root = prefs.getString("root", ""); p.label = prefs.getString("label", FOLDER);
        recover(p, texts, newPassword, remember);
    }
    static final String RECOVERY_PREFIX = "workflow-pdf-pro.ersatz-", SLOT_PREFIX = "workflow-pdf-pro.kennwort-";
    private JSONObject readHeader(Place candidate) throws Exception {
        Entry header = child(candidate, candidate.root, HEADER);
        if (header == null) throw failure("VAULT_NOT_FOUND");
        JSONObject meta = new JSONObject(new String(small(candidate, header.id, 65536), StandardCharsets.UTF_8));
        checkPasswordMeta(meta);
        candidate.id = meta.getString("id");
        if (!candidate.id.matches("[a-f0-9-]{36}")) throw failure("VAULT_DAMAGED");
        return meta;
    }
    private static void checkPasswordMeta(JSONObject meta) throws Exception {
        int rounds = meta.getInt("iterations");
        if (!FORMAT.equals(meta.getString("app")) || meta.getInt("v") != 1 || rounds < VaultCrypto.MIN_ITERATIONS || rounds > VaultCrypto.MAX_ITERATIONS) throw failure("VAULT_DAMAGED");
    }
    /** Datenschlüssel mit einem Passwort aus Kopf oder Passwortfach öffnen. */
    private static byte[] unwrapPassword(Place candidate, JSONObject meta, CharSequence password) throws Exception {
        checkPasswordMeta(meta);
        byte[] salt = un64(meta.getString("salt")), wrapped = un64(meta.getString("wrapped"));
        if (salt.length != 16 || wrapped.length != VaultCrypto.NONCE + VaultCrypto.KEY + VaultCrypto.TAG) throw failure("VAULT_DAMAGED");
        byte[] pw = VaultCrypto.passwordBytes(password), derived = null;
        try {
            derived = VaultCrypto.pbkdf2(pw, salt, meta.getInt("iterations"));
            byte[] key;
            try { key = VaultCrypto.open(derived, wrapped, bytes(logical(candidate, "password"))); }
            catch (GeneralSecurityException error) { throw failure("VAULT_PASSWORD"); }
            if (key.length != 32) { Arrays.fill(key, (byte) 0); throw failure("VAULT_DAMAGED"); }
            return key;
        } finally { Arrays.fill(pw, (byte) 0); if (derived != null) Arrays.fill(derived, (byte) 0); }
    }
    /** Zusätzliche Passwortfächer nach einer Wiederherstellung mit Ersatzschlüsseln. */
    private List<JSONObject> passwordSlots(Place p) throws Exception {
        ArrayList<JSONObject> slots = new ArrayList<>();
        for (Entry e : children(p, p.root)) {
            if (e.name == null || !e.name.matches(java.util.regex.Pattern.quote(SLOT_PREFIX) + "[a-f0-9-]{36}\\.json")) continue;
            JSONObject meta = new JSONObject(new String(small(p, e.id, 65536), StandardCharsets.UTF_8));
            if (p.id.equals(meta.optString("id"))) slots.add(meta);
        }
        return slots;
    }
    void open(Place candidate, CharSequence password, boolean remember) throws Exception {
        if (transferring()) throw failure("VAULT_BUSY");
        JSONObject meta = readHeader(candidate);
        try {
            try { candidate.key = unwrapPassword(candidate, meta, password); }
            catch (IOException error) {
                if (!"VAULT_PASSWORD".equals(error.getMessage())) throw error;
                for (JSONObject slot : passwordSlots(candidate)) {
                    try { candidate.key = unwrapPassword(candidate, slot, password); break; }
                    catch (IOException wrong) { if (!"VAULT_PASSWORD".equals(wrong.getMessage())) throw wrong; }
                }
                if (candidate.key == null) throw failure("VAULT_PASSWORD");
            }
            loadIndex(candidate); select(candidate, remember);
        } finally { if (active != candidate && candidate.key != null) Arrays.fill(candidate.key, (byte) 0); }
    }
    private void writeNew(Place p, String name, byte[] data) throws Exception {
        String id = create(p, p.root, "application/json", name);
        try (OutputStream out = resolver.openOutputStream(doc(p, id), "w")) { if (out == null) throw failure("VAULT_FOLDER_UNAVAILABLE"); out.write(data); }
        catch (Exception error) { delete(p, id); throw error; }
    }
    private Entry named(Place p, String name) throws IOException { return child(p, p.root, name); }
    /** Ersatzschlüssel für den entsperrten Tresor: n Teile, k genügen. Ein neuer Satz
     *  ersetzt frühere erst, nachdem er geprüft geschrieben ist. */
    List<String> createRecovery(int n, int k) throws Exception {
        Place p = require();
        byte[] secret = VaultCrypto.random(VaultRecovery.SECRET), set = VaultCrypto.random(4);
        String setHex = VaultCrypto.hex(set), name = RECOVERY_PREFIX + setHex + ".json";
        try {
            List<VaultRecovery.Share> shares = VaultRecovery.split(secret, set, n, k);
            byte[] wrapped = VaultCrypto.seal(secret, p.key, bytes(logical(p, "recovery:" + setHex)));
            JSONObject file = new JSONObject().put("app", FORMAT).put("v", 1).put("id", p.id).put("set", setHex).put("n", n).put("k", k).put("created", System.currentTimeMillis()).put("wrapped", b64(wrapped));
            writeNew(p, name, bytes(file.toString()));
            Entry written = named(p, name);
            try {
                if (written == null) throw failure("VAULT_DAMAGED");
                JSONObject back = new JSONObject(new String(small(p, written.id, 65536), StandardCharsets.UTF_8));
                byte[] key;
                try { key = VaultCrypto.open(secret, un64(back.getString("wrapped")), bytes(logical(p, "recovery:" + setHex))); }
                catch (GeneralSecurityException error) { throw failure("VAULT_DAMAGED"); }
                boolean same = MessageDigest.isEqual(key, p.key); Arrays.fill(key, (byte) 0);
                byte[] again = VaultRecovery.combine(shares.subList(0, k));
                same &= MessageDigest.isEqual(again, secret); Arrays.fill(again, (byte) 0);
                if (!same) throw failure("VAULT_DAMAGED");
            } catch (Exception error) { if (written != null) delete(p, written.id); throw error; }
            for (Entry e : children(p, p.root)) if (e.name != null && e.name.startsWith(RECOVERY_PREFIX) && !e.name.equals(name)) delete(p, e.id);
            ArrayList<String> out = new ArrayList<>();
            for (VaultRecovery.Share share : shares) { out.add(VaultRecovery.encode(share)); Arrays.fill(share.data, (byte) 0); }
            return out;
        } finally { Arrays.fill(secret, (byte) 0); }
    }
    JSONObject recoveryInfo() throws Exception {
        Place p = require();
        for (Entry e : children(p, p.root)) {
            if (e.name == null || !e.name.startsWith(RECOVERY_PREFIX) || !e.name.endsWith(".json")) continue;
            JSONObject meta = new JSONObject(new String(small(p, e.id, 65536), StandardCharsets.UTF_8));
            if (p.id.equals(meta.optString("id"))) return new JSONObject().put("exists", true).put("set", meta.optString("set")).put("n", meta.optInt("n")).put("k", meta.optInt("k")).put("created", meta.optLong("created"));
        }
        return new JSONObject().put("exists", false);
    }
    /** Mit genug Ersatzschlüsseln öffnen und ein neues Passwort setzen. Der Tresorkopf
     *  bleibt unverändert; das neue Passwort liegt in einem eigenen Passwortfach. */
    void recover(Place candidate, List<String> texts, CharSequence newPassword, boolean remember) throws Exception {
        if (transferring()) throw failure("VAULT_BUSY");
        String normalized = Normalizer.normalize(newPassword, Normalizer.Form.NFC);
        if (normalized.codePointCount(0, normalized.length()) < 10) throw failure("VAULT_PASSWORD_SHORT");
        ArrayList<VaultRecovery.Share> shares = new ArrayList<>();
        for (String text : texts) if (text != null && !text.trim().isEmpty()) shares.add(VaultRecovery.decode(text));
        byte[] secret = VaultRecovery.combine(shares), derived = null, pw = null;
        try {
            String setHex = VaultCrypto.hex(shares.get(0).set);
            readHeader(candidate);
            Entry file = named(candidate, RECOVERY_PREFIX + setHex + ".json");
            if (file == null) throw failure("VAULT_RECOVERY_UNKNOWN");
            JSONObject meta = new JSONObject(new String(small(candidate, file.id, 65536), StandardCharsets.UTF_8));
            if (!FORMAT.equals(meta.optString("app")) || !candidate.id.equals(meta.optString("id")) || !setHex.equals(meta.optString("set"))) throw failure("VAULT_RECOVERY_UNKNOWN");
            try { candidate.key = VaultCrypto.open(secret, un64(meta.getString("wrapped")), bytes(logical(candidate, "recovery:" + setHex))); }
            catch (GeneralSecurityException error) { throw failure("VAULT_RECOVERY_INVALID"); }
            if (candidate.key.length != 32) throw failure("VAULT_DAMAGED");
            loadIndex(candidate);
            byte[] salt = VaultCrypto.random(16); pw = VaultCrypto.passwordBytes(newPassword);
            derived = VaultCrypto.pbkdf2(pw, salt, VaultCrypto.ITERATIONS);
            byte[] wrapped = VaultCrypto.seal(derived, candidate.key, bytes(logical(candidate, "password")));
            JSONObject slot = new JSONObject().put("app", FORMAT).put("v", 1).put("id", candidate.id).put("iterations", VaultCrypto.ITERATIONS).put("salt", b64(salt)).put("wrapped", b64(wrapped));
            String name = SLOT_PREFIX + UUID.randomUUID() + ".json";
            writeNew(candidate, name, bytes(slot.toString()));
            Entry written = named(candidate, name);
            try {
                if (written == null) throw failure("VAULT_DAMAGED");
                byte[] key = unwrapPassword(candidate, new JSONObject(new String(small(candidate, written.id, 65536), StandardCharsets.UTF_8)), newPassword);
                boolean same = MessageDigest.isEqual(key, candidate.key); Arrays.fill(key, (byte) 0);
                if (!same) throw failure("VAULT_DAMAGED");
            } catch (Exception error) { if (written != null) delete(candidate, written.id); throw error; }
            select(candidate, remember);
        } finally {
            Arrays.fill(secret, (byte) 0); if (pw != null) Arrays.fill(pw, (byte) 0); if (derived != null) Arrays.fill(derived, (byte) 0);
            for (VaultRecovery.Share share : shares) Arrays.fill(share.data, (byte) 0);
            if (active != candidate && candidate.key != null) Arrays.fill(candidate.key, (byte) 0);
        }
    }
    void initialize(Place candidate, CharSequence password, boolean remember) throws Exception {
        if (transferring()) throw failure("VAULT_BUSY");
        if (Normalizer.normalize(password, Normalizer.Form.NFC).codePointCount(0, Normalizer.normalize(password, Normalizer.Form.NFC).length()) < 10) throw failure("VAULT_PASSWORD_SHORT");
        if (existing(candidate)) throw failure("VAULT_FILE_EXISTS");
        candidate.setupObjects = new ArrayList<>();
        candidate.id = UUID.randomUUID().toString(); candidate.key = VaultCrypto.random(32);
        byte[] salt = VaultCrypto.random(16), pw = VaultCrypto.passwordBytes(password), derived = null;
        String createdHeader = null;
        try {
            if (!FOLDER.equals(displayName(candidate, candidate.root)) || !children(candidate, candidate.root).isEmpty()) candidate.root = create(candidate, candidate.root, DIR, FOLDER);
            candidate.label = displayName(candidate, candidate.root);
            derived = VaultCrypto.pbkdf2(pw, salt, VaultCrypto.ITERATIONS);
            byte[] wrapped = VaultCrypto.seal(derived, candidate.key, bytes(logical(candidate, "password")));
            JSONObject meta = new JSONObject().put("app", FORMAT).put("v", 1).put("id", candidate.id)
                .put("iterations", VaultCrypto.ITERATIONS).put("salt", b64(salt)).put("wrapped", b64(wrapped));
            index(candidate, new JSONObject());
            createdHeader = create(candidate, candidate.root, "application/json", HEADER);
            try (OutputStream out = resolver.openOutputStream(doc(candidate, createdHeader), "w")) { if (out == null) throw failure("VAULT_FOLDER_UNAVAILABLE"); out.write(bytes(meta.toString())); }
            if (!meta.toString().equals(new String(small(candidate, createdHeader, 65536), StandardCharsets.UTF_8))) throw failure("VAULT_DAMAGED");
            select(candidate, remember); candidate.setupObjects = null;
        } catch (Exception error) {
            if (candidate.setupObjects != null) for (int i = candidate.setupObjects.size() - 1; i >= 0; i--) delete(candidate, candidate.setupObjects.get(i));
            throw error;
        }
        finally { Arrays.fill(pw, (byte) 0); if (derived != null) Arrays.fill(derived, (byte) 0); if (active != candidate) Arrays.fill(candidate.key, (byte) 0); }
    }
    private SecretKey deviceKey(boolean create) throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(deviceAlias)) return (SecretKey) store.getKey(deviceAlias, null);
        if (!create) return null;
        KeyGenerator generator = KeyGenerator.getInstance("AES", "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(deviceAlias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
        return generator.generateKey();
    }
    private void select(Place p, boolean remember) throws Exception {
        SharedPreferences.Editor edit = prefs.edit().putString("tree", p.tree.toString()).putString("root", p.root).putString("id", p.id).putString("label", p.label).putLong("revision", p.revision).remove("remember");
        if (remember) {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, deviceKey(true)); cipher.updateAAD(bytes(logical(p, "device")));
            byte[] sealed = cipher.doFinal(p.key), value = new byte[12 + sealed.length];
            System.arraycopy(cipher.getIV(), 0, value, 0, 12); System.arraycopy(sealed, 0, value, 12, sealed.length); edit.putString("remember", b64(value));
        }
        if (!edit.commit()) throw failure("VAULT_UNAVAILABLE");
        clearActive(); active = p;
    }
    private void clearActive() { if (active != null && active.key != null) Arrays.fill(active.key, (byte) 0); active = null; }
    boolean configured() { return prefs.contains("tree"); }
    /** Kopie des Datenschlüssels für den Einzug in den gemeinsamen Tresorordner (Schritt D1). Bleibt nativ, nie an die WebView. */
    byte[] tresorSchluessel() throws Exception { return require().key.clone(); }
    boolean transferring() { return !pending.isEmpty()||batch!=null; }
    String identity() { return prefs.getString("id", ""); }
    String locationId() throws Exception {
        return VaultCrypto.hex(MessageDigest.getInstance("SHA-256").digest(bytes(prefs.getString("tree", "")+"|"+prefs.getString("root", "")+"|"+identity())));
    }
    void rehome(String preferences) throws Exception {
        if (transferring()) throw failure("VAULT_BUSY");
        SharedPreferences next=context.getSharedPreferences(preferences,Context.MODE_PRIVATE);
        if (identity().equals(next.getString("id", "")) && prefs.getLong("revision",0)<next.getLong("revision",0)) throw failure("VAULT_DAMAGED");
        SharedPreferences.Editor editor=next.edit().clear();
        for(String key:new String[]{"tree","root","id","label","remember"})if(prefs.contains(key))editor.putString(key,prefs.getString(key,null));
        editor.putLong("revision",prefs.getLong("revision",0));
        if(!editor.commit())throw failure("VAULT_UNAVAILABLE");
        SharedPreferences previous=prefs;prefs=next;previous.edit().clear().commit();
    }
    private Place require() throws Exception {
        if (active != null) { children(active, active.root); return active; }
        if (!configured()) throw failure("VAULT_NOT_CONFIGURED");
        String remembered = prefs.getString("remember", null);
        if (remembered == null) throw failure("VAULT_LOCKED");
        Place p = new Place(); p.tree = Uri.parse(prefs.getString("tree", "")); p.root = prefs.getString("root", ""); p.id = prefs.getString("id", ""); p.label = prefs.getString("label", FOLDER);
        try {
            byte[] value = un64(remembered); SecretKey key = deviceKey(false);
            if (key == null || value.length != 60) throw failure("VAULT_LOCKED");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, value, 0, 12)); cipher.updateAAD(bytes(logical(p, "device")));
            p.key = cipher.doFinal(value, 12, value.length - 12); loadIndex(p); active = p; return p;
        } catch (GeneralSecurityException error) { throw failure("VAULT_LOCKED"); }
        finally { if (active != p && p.key != null) Arrays.fill(p.key, (byte) 0); }
    }
    JSONObject state() throws Exception {
        JSONObject state = new JSONObject().put("configured", configured()).put("unlocked", false);
        if (!configured()) return state;
        state.put("id", identity()).put("folder", prefs.getString("label",FOLDER));
        try { Place p = require(); state.put("unlocked", true).put("reachable", true).put("id", p.id).put("folder", p.label).put("revision", p.revision).put("records", p.index.length()); }
        catch (IOException error) { state.put("problem", error.getMessage()); }
        return state;
    }
    void lock() throws Exception {
        abortBatch();
        for (Pending p : pending.values()) p.file.delete(); pending.clear(); clearActive();
        if (!prefs.edit().remove("remember").commit()) throw failure("VAULT_UNAVAILABLE");
    }
    void closeWorking() {
        abortBatch();
        for (Pending p : pending.values()) p.file.delete(); pending.clear(); clearActive();
    }
    String begin(String store, String id) throws Exception {
        return begin(store,id,null);
    }
    String begin(String store,String id,JSONObject reference)throws Exception {
        Place place = require(); recordName(store, id);
        File folder = new File(context.getCacheDir(), "workflow-vault-pending"); if (!folder.isDirectory() && !folder.mkdirs()) throw failure("VAULT_UNAVAILABLE");
        Pending p = new Pending(); p.store = store; p.id = id; p.place = place; p.file = File.createTempFile("record-", ".tmp", folder);p.reference=reference;
        if(reference!=null&&(!"files".equals(store)||!id.equals(reference.optString("id"))||!reference.optString("vaultId").matches("[a-f0-9-]{36}")||!reference.optString("hash").matches("[a-f0-9]{64}"))){p.file.delete();throw failure("VAULT_INVALID_RECORD");}
        String ticket = UUID.randomUUID().toString(); pending.put(ticket, p); return ticket;
    }
    void append(String ticket, long offset, byte[] data) throws Exception {
        Place place = require(); Pending p = pending.get(ticket);
        if (p == null || p.place != place || offset != p.size || data.length > VaultCrypto.CHUNK) throw failure("VAULT_INVALID_TRANSFER");
        try (FileOutputStream out = new FileOutputStream(p.file, true)) { out.write(data); out.getFD().sync(); }
        p.size += data.length;
    }
    void abort(String ticket) { Pending p = pending.remove(ticket); if (p != null) p.file.delete(); }
    void finish(String ticket, long size) throws Exception {
        Place place = require(); Pending p = pending.get(ticket);
        if (p == null || p.place != place || p.size != size || p.file.length() != size) throw failure("VAULT_INVALID_TRANSFER");
        String logical = recordName(p.store, p.id), file = null; boolean committed = false;
        try {
            String hash=VaultCrypto.hex(ProFilesPlugin.hash(new FileInputStream(p.file)));
            file = encrypted(place, logical, new FileInputStream(p.file));
            JSONObject next = new JSONObject(visibleIndex(place).toString());
            JSONObject entry=new JSONObject().put("store",p.store).put("id",p.id).put("file",file).put("size",size).put("hash",hash);
            if(p.reference!=null)entry.put("reference",p.reference);
            next.put(logical,entry);
            if(batch!=null){batch.index=next;batch.created.add(file);}else index(place, next);
            committed = true;
        } finally { abort(ticket); if (!committed && file != null) deleteName(place, file); }
    }
    JSONObject info(String store, String id) throws Exception {
        Place p = require(); JSONObject record = visibleIndex(p).optJSONObject(recordName(store, id));
        if(record==null)return new JSONObject().put("exists",false);
        JSONObject info=new JSONObject().put("exists",true).put("size",record.getLong("size")).put("hash",record.getString("hash"));
        if(record.has("reference"))info.put("reference",record.getJSONObject("reference"));
        return info;
    }
    byte[] read(String store, String id, long offset) throws Exception {
        return read(store,id,offset,null);
    }
    byte[] read(String store,String id,long offset,String expectedHash)throws Exception {
        Place p = require(); String name = recordName(store, id); JSONObject record = visibleIndex(p).optJSONObject(name);
        if (record == null) throw failure("VAULT_RECORD_NOT_FOUND");
        if(expectedHash!=null&&!expectedHash.equals(record.optString("hash")))throw failure("VAULT_RECORD_CHANGED");
        try (VaultCrypto.Reader reader = reader(p, record.getString("file"), name)) {
            if (reader.size() != record.getLong("size")) throw failure("VAULT_DAMAGED");
            return reader.read(offset, VaultCrypto.CHUNK);
        }
    }
    JSONArray list(String store) throws Exception {
        Place p = require(); if (!STORES.contains(store)) throw failure("VAULT_INVALID_RECORD");
        JSONObject view=visibleIndex(p);JSONArray out = new JSONArray(); Iterator<String> keys = view.keys();
        while (keys.hasNext()) { JSONObject entry = view.getJSONObject(keys.next()); if (store.equals(entry.getString("store"))) out.put(entry.getString("id")); }
        return out;
    }
    void remove(String store, String id, boolean prefix) throws Exception {
        Place p = require(); recordName(store, id);JSONObject view=visibleIndex(p); JSONObject next = new JSONObject(view.toString()); Iterator<String> keys = view.keys();
        while (keys.hasNext()) { String key = keys.next(); JSONObject entry = view.getJSONObject(key);
            if (store.equals(entry.getString("store")) && (id.equals(entry.getString("id")) || (prefix && entry.getString("id").startsWith(id + "#")))) next.remove(key);
        }
        if(batch!=null)batch.index=next;else index(p, next);
    }
    void beginBatch()throws Exception{
        if(transferring())throw failure("VAULT_BUSY");
        Place p=require();Batch next=new Batch();next.place=p;next.index=new JSONObject(p.index.toString());batch=next;
    }
    void commitBatch()throws Exception{
        if(batch==null||batch.place!=require()||!pending.isEmpty())throw failure("VAULT_BUSY");
        index(batch.place,batch.index);batch=null;
    }
    void abortBatch(){
        if(batch==null)return;
        for(Pending item:pending.values())item.file.delete();pending.clear();
        Batch old=batch;batch=null;for(String name:old.created)deleteName(old.place,name);
    }
}
