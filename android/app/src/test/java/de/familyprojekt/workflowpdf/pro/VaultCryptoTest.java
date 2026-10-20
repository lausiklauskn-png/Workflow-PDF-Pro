package de.familyprojekt.workflowpdf.pro;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Random;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.junit.Test;
import static org.junit.Assert.*;

public class VaultCryptoTest {
    private static byte[] hexBytes(String hex) {
        byte[] out = new byte[hex.length() / 2];
        for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(hex.substring(2 * i, 2 * i + 2), 16);
        return out;
    }
    private static File encrypt(byte[] key, String id, byte[] plain) throws Exception {
        File file = File.createTempFile("pbv", ".bin");file.deleteOnExit();
        VaultCrypto.Writer writer = new VaultCrypto.Writer(new FileOutputStream(file), key, id, 1L << 31);
        // Uneven writes cross chunk borders.
        for (int offset = 0; offset < plain.length; ) { int n = Math.min(plain.length - offset, 70001); writer.write(plain, offset, n); offset += n; }
        writer.close();
        assertEquals(plain.length, writer.size());
        assertEquals(VaultCrypto.hex(MessageDigest.getInstance("SHA-256").digest(plain)), writer.digestHex());
        assertEquals(VaultCrypto.encryptedSize(plain.length), file.length());
        return file;
    }
    private static VaultCrypto.Reader reader(File file, byte[] key, String id) throws Exception {
        return new VaultCrypto.Reader(FileChannel.open(file.toPath(), StandardOpenOption.READ), null, key, id);
    }
    private static byte[] decrypt(File file, byte[] key, String id) throws Exception {
        try (VaultCrypto.Reader reader = reader(file, key, id); InputStream in = reader.stream()) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[9000]; int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            return out.toByteArray();
        }
    }

    @Test public void pbkdf2MatchesRfc7914AndThePlatform() throws Exception {
        assertArrayEquals(hexBytes("55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc"),
            VaultCrypto.pbkdf2("passwd".getBytes(StandardCharsets.UTF_8), "salt".getBytes(StandardCharsets.UTF_8), 1));
        assertArrayEquals(hexBytes("4ddcd8f60b98be21830cee5ef22701f9641a4418d04c0414aeff08876b34ab56"),
            VaultCrypto.pbkdf2("Password".getBytes(StandardCharsets.UTF_8), "NaCl".getBytes(StandardCharsets.UTF_8), 80000));
        byte[] salt = VaultCrypto.random(16);
        byte[] platform = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            .generateSecret(new PBEKeySpec("Schlüssel-Ä".toCharArray(), salt, 2000, 256)).getEncoded();
        // The platform encodes chars as UTF-8, the same as the NFC-normalized vault password.
        assertArrayEquals(platform, VaultCrypto.pbkdf2(VaultCrypto.passwordBytes("Schlüssel-Ä"), salt, 2000));
        // Decomposed input (u + combining diaeresis) opens the same vault.
        assertArrayEquals(VaultCrypto.passwordBytes("Schlüssel"), VaultCrypto.passwordBytes("Schlüssel"));
    }

    @Test public void chunkedRoundTripAtAllBorders() throws Exception {
        byte[] key = VaultCrypto.random(32);
        Random random = new Random(7);
        for (int size : new int[] {0, 1, VaultCrypto.CHUNK - 1, VaultCrypto.CHUNK, VaultCrypto.CHUNK + 1, 3 * VaultCrypto.CHUNK, 3 * VaultCrypto.CHUNK + 12345}) {
            byte[] plain = new byte[size]; random.nextBytes(plain);
            File file = encrypt(key, "att/x", plain);
            assertArrayEquals("size " + size, plain, decrypt(file, key, "att/x"));
            try (VaultCrypto.Reader reader = reader(file, key, "att/x")) {
                assertEquals(size, reader.size());
                if (size > VaultCrypto.CHUNK) assertArrayEquals(Arrays.copyOfRange(plain, VaultCrypto.CHUNK, Math.min(size, 2 * VaultCrypto.CHUNK)), reader.read(VaultCrypto.CHUNK, VaultCrypto.CHUNK));
                assertEquals(0, reader.read(size, VaultCrypto.CHUNK).length);
            }
        }
    }

    @Test public void tamperingSwappingTruncationAndWrongKeysAreRejected() throws Exception {
        byte[] key = VaultCrypto.random(32), plain = new byte[2 * VaultCrypto.CHUNK + 10];
        new Random(3).nextBytes(plain);
        File file = encrypt(key, "att/a", plain);
        try { decrypt(file, VaultCrypto.random(32), "att/a"); fail("wrong key opened file"); } catch (VaultCrypto.Failure expected) { }
        try { decrypt(file, key, "att/b"); fail("swapped logical name accepted"); } catch (VaultCrypto.Failure expected) { }
        try (RandomAccessFile raw = new RandomAccessFile(file, "rw")) {
            raw.seek(VaultCrypto.HEADER + VaultCrypto.CHUNK + 40); int b = raw.read(); raw.seek(VaultCrypto.HEADER + VaultCrypto.CHUNK + 40); raw.write(b ^ 1);
        }
        try { decrypt(file, key, "att/a"); fail("flipped bit accepted"); } catch (VaultCrypto.Failure expected) { }
        // Cutting off the final partial chunk leaves a well-formed length whose new last chunk is not final.
        File cut = encrypt(key, "att/c", plain);
        try (RandomAccessFile raw = new RandomAccessFile(cut, "rw")) { raw.setLength(VaultCrypto.HEADER + 2L * (VaultCrypto.CHUNK + VaultCrypto.OVERHEAD)); }
        try { decrypt(cut, key, "att/c"); fail("truncated file accepted"); } catch (VaultCrypto.Failure expected) { }
        // Reordering two complete chunks.
        File swap = encrypt(key, "att/d", plain);
        try (RandomAccessFile raw = new RandomAccessFile(swap, "rw")) {
            int size = VaultCrypto.CHUNK + VaultCrypto.OVERHEAD; byte[] a = new byte[size], b = new byte[size];
            raw.seek(VaultCrypto.HEADER); raw.readFully(a); raw.readFully(b);
            raw.seek(VaultCrypto.HEADER); raw.write(b); raw.write(a);
        }
        try { decrypt(swap, key, "att/d"); fail("reordered chunks accepted"); } catch (VaultCrypto.Failure expected) { }
    }

    @Test public void limitStopsOversizedStreams() throws Exception {
        File file = File.createTempFile("pbv", ".bin");file.deleteOnExit();
        VaultCrypto.Writer writer = new VaultCrypto.Writer(new FileOutputStream(file), VaultCrypto.random(32), "att/l", 1000);
        writer.write(new byte[1000]);
        try { writer.write(1); fail("limit ignored"); } catch (VaultCrypto.Failure expected) { assertEquals("FILE_TOO_LARGE", expected.getMessage()); }
    }

    @Test public void sealedValuesAreBoundToTheirContext() throws Exception {
        byte[] key = VaultCrypto.random(32), sealed = VaultCrypto.seal(key, "data".getBytes(StandardCharsets.UTF_8), "a".getBytes(StandardCharsets.UTF_8));
        assertEquals("data", new String(VaultCrypto.open(key, sealed, "a".getBytes(StandardCharsets.UTF_8)), StandardCharsets.UTF_8));
        try { VaultCrypto.open(key, sealed, "b".getBytes(StandardCharsets.UTF_8)); fail("context ignored"); } catch (java.security.GeneralSecurityException expected) { }
    }
}
