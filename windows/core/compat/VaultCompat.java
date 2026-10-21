package de.familyprojekt.workflowpdf.pro;

import java.io.*;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.*;

/** Gegenprobe zwischen Android und Windows: nutzt den unveränderten VaultCrypto.java
 *  aus der Android-App und baut die Ordnerstruktur von DocumentVault.java nach.
 *  Das Passwort steht UTF-8-kodiert in einer Datei (unabhängig von der Spracheinstellung).
 *  write <ordner> <passwortdatei> <datei>: Tresor wie Android anlegen, Datensatz files:doc-1.
 *  read  <ordner> <passwortdatei>: von Windows angelegten Tresor lesen, SHA-256 von files:doc-1 ausgeben. */
public final class VaultCompat {
    static final String FORMAT = "workflow-pdf-pro-vault";
    static String b64(byte[] v) { return Base64.getEncoder().encodeToString(v); }
    static String logical(String id, String kind) { return FORMAT + ":" + id + ":" + kind; }
    static String field(String json, String key) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(\"([^\"]*)\"|(-?[0-9]+))").matcher(json);
        if (!m.find()) throw new IllegalStateException("Feld fehlt: " + key);
        return m.group(2) != null ? m.group(2) : m.group(3);
    }
    static String encrypt(Path root, byte[] key, String kind, byte[] data) throws Exception {
        String name = UUID.randomUUID() + ".wpv";
        try (VaultCrypto.Writer w = new VaultCrypto.Writer(new FileOutputStream(root.resolve(name).toFile()), key, kind, Long.MAX_VALUE)) { w.write(data, 0, data.length); }
        return name;
    }
    static byte[] decrypt(Path file, byte[] key, String kind) throws Exception {
        FileChannel channel = FileChannel.open(file, StandardOpenOption.READ);
        try (VaultCrypto.Reader r = new VaultCrypto.Reader(channel, null, key, kind)) { return VaultCrypto.readAll(r, Integer.MAX_VALUE); }
    }
    public static void main(String[] args) throws Exception {
        Path root = Paths.get(args[1]); String password = new String(Files.readAllBytes(Paths.get(args[2])), StandardCharsets.UTF_8);
        if (args[0].equals("write")) {
            byte[] data = Files.readAllBytes(Paths.get(args[3]));
            Files.createDirectories(root);
            String id = UUID.randomUUID().toString(); byte[] key = VaultCrypto.random(32), salt = VaultCrypto.random(16);
            byte[] derived = VaultCrypto.pbkdf2(VaultCrypto.passwordBytes(password), salt, VaultCrypto.ITERATIONS);
            byte[] wrapped = VaultCrypto.seal(derived, key, logical(id, "password").getBytes(StandardCharsets.UTF_8));
            String file = encrypt(root, key, logical(id, "files:doc-1"), data);
            String hash = VaultCrypto.hex(MessageDigest.getInstance("SHA-256").digest(data));
            String index = "{\"app\":\"" + FORMAT + "\",\"v\":1,\"revision\":1,\"records\":{\"files:doc-1\":{\"store\":\"files\",\"id\":\"doc-1\",\"file\":\"" + file + "\",\"size\":" + data.length + ",\"hash\":\"" + hash + "\"}}}";
            String indexFile = encrypt(root, key, logical(id, "index"), index.getBytes(StandardCharsets.UTF_8));
            Files.write(root.resolve("commit-" + String.format(Locale.ROOT, "%020d", 1) + "-" + UUID.randomUUID() + ".json"), ("{\"index\":\"" + indexFile + "\",\"revision\":1}").getBytes(StandardCharsets.UTF_8));
            Files.write(root.resolve("workflow-pdf-pro.tresor.json"), ("{\"app\":\"" + FORMAT + "\",\"v\":1,\"id\":\"" + id + "\",\"iterations\":" + VaultCrypto.ITERATIONS + ",\"salt\":\"" + b64(salt) + "\",\"wrapped\":\"" + b64(wrapped) + "\"}").getBytes(StandardCharsets.UTF_8));
            System.out.println(hash);
        } else {
            String meta = new String(Files.readAllBytes(root.resolve("workflow-pdf-pro.tresor.json")), StandardCharsets.UTF_8);
            String id = field(meta, "id");
            byte[] derived = VaultCrypto.pbkdf2(VaultCrypto.passwordBytes(password), Base64.getDecoder().decode(field(meta, "salt")), Integer.parseInt(field(meta, "iterations")));
            byte[] key = VaultCrypto.open(derived, Base64.getDecoder().decode(field(meta, "wrapped")), logical(id, "password").getBytes(StandardCharsets.UTF_8));
            List<Path> commits = new ArrayList<>();
            try (DirectoryStream<Path> s = Files.newDirectoryStream(root, "commit-*.json")) { for (Path p : s) commits.add(p); }
            commits.sort(Comparator.comparing(p -> p.getFileName().toString()));
            String marker = new String(Files.readAllBytes(commits.get(commits.size() - 1)), StandardCharsets.UTF_8);
            String index = new String(decrypt(root.resolve(field(marker, "index")), key, logical(id, "index")), StandardCharsets.UTF_8);
            int at = index.indexOf("\"files:doc-1\""); if (at < 0) throw new IllegalStateException("Datensatz fehlt");
            String record = index.substring(at, index.indexOf('}', at) + 1);
            byte[] data = decrypt(root.resolve(field(record, "file")), key, logical(id, "files:doc-1"));
            String hash = VaultCrypto.hex(MessageDigest.getInstance("SHA-256").digest(data));
            if (!hash.equals(field(record, "hash"))) throw new IllegalStateException("Prüfsumme weicht ab");
            System.out.println(hash);
        }
    }
}
