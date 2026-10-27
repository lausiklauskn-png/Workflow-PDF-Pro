package de.familyprojekt.tresor;

import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.Locale;
import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Password vault file format PBV1. Pure Java: testable on the JVM without Android.
 *
 * File = header (magic, version, chunk size, wrapped random file key) followed by
 * AES-256-GCM chunks of 256 KiB. Every chunk authenticates the header, the logical
 * name, its index and whether it is the final chunk; reordering, swapping files
 * or cutting off the end is detected.
 */
final class VaultCrypto {
    static final int CHUNK = 256 * 1024, NONCE = 12, TAG = 16, KEY = 32, OVERHEAD = NONCE + TAG;
    static final int ITERATIONS = 600_000, MIN_ITERATIONS = 100_000, MAX_ITERATIONS = 10_000_000;
    static final int HEADER = 4 + 1 + 4 + NONCE + KEY + TAG;
    private static final byte[] MAGIC = {'P', 'B', 'V', '1'};
    private static final SecureRandom RANDOM = new SecureRandom();

    static final class Failure extends IOException { Failure(String code) { super(code); } }

    private VaultCrypto() { }

    static byte[] random(int length) { byte[] value = new byte[length]; RANDOM.nextBytes(value); return value; }

    static String hex(byte[] value) {
        StringBuilder out = new StringBuilder(value.length * 2);
        for (byte b : value) out.append(String.format(Locale.ROOT, "%02x", b & 255));
        return out.toString();
    }

    /** NFC first: the same password typed on another keyboard must open the vault. */
    static byte[] passwordBytes(CharSequence password) {
        String normalized = Normalizer.normalize(password, Normalizer.Form.NFC);
        ByteBuffer encoded = StandardCharsets.UTF_8.encode(CharBuffer.wrap(normalized));
        byte[] bytes = new byte[encoded.remaining()];
        encoded.get(bytes);
        if (encoded.hasArray()) Arrays.fill(encoded.array(), (byte) 0);
        return bytes;
    }

    /** PBKDF2-HMAC-SHA256 written out: identical on every Android version (minSdk 24). */
    static byte[] pbkdf2(byte[] password, byte[] salt, int iterations) throws GeneralSecurityException {
        if (password.length == 0 || salt.length == 0 || iterations < 1) throw new GeneralSecurityException("INVALID_KDF");
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(password, "HmacSHA256"));
        mac.update(salt);
        mac.update(new byte[] {0, 0, 0, 1});
        byte[] u = mac.doFinal(), result = u.clone();
        for (int i = 1; i < iterations; i++) {
            u = mac.doFinal(u);
            for (int k = 0; k < result.length; k++) result[k] ^= u[k];
        }
        Arrays.fill(u, (byte) 0);
        return result;
    }

    static byte[] seal(byte[] key, byte[] plain, byte[] aad) throws GeneralSecurityException {
        byte[] nonce = random(NONCE);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG * 8, nonce));
        cipher.updateAAD(aad);
        byte[] sealed = cipher.doFinal(plain), out = new byte[NONCE + sealed.length];
        System.arraycopy(nonce, 0, out, 0, NONCE);
        System.arraycopy(sealed, 0, out, NONCE, sealed.length);
        return out;
    }

    static byte[] open(byte[] key, byte[] sealed, int offset, int length, byte[] aad) throws GeneralSecurityException {
        if (length < OVERHEAD) throw new AEADBadTagException("SHORT");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG * 8, sealed, offset, NONCE));
        cipher.updateAAD(aad);
        return cipher.doFinal(sealed, offset + NONCE, length - NONCE);
    }

    static byte[] open(byte[] key, byte[] sealed, byte[] aad) throws GeneralSecurityException {
        return open(key, sealed, 0, sealed.length, aad);
    }

    private static byte[] keyAad(String id) { return ("pbv1-key|" + id).getBytes(StandardCharsets.UTF_8); }

    private static byte[] chunkAad(byte[] header, String id, long index, boolean last) {
        byte[] name = id.getBytes(StandardCharsets.UTF_8);
        return ByteBuffer.allocate(header.length + name.length + 10).put(header).put(name).put((byte) 0)
            .putLong(index).put((byte) (last ? 1 : 0)).array();
    }

    /** Plain size from the encrypted size; throws for impossible lengths. */
    static long plainSize(long encrypted) throws Failure {
        long body = encrypted - HEADER, full = CHUNK + OVERHEAD;
        if (body < OVERHEAD) throw new Failure("VAULT_DAMAGED");
        long chunks = body / full, rest = body % full;
        if (rest == 0) return chunks * CHUNK;
        if (rest < OVERHEAD) throw new Failure("VAULT_DAMAGED");
        return chunks * CHUNK + rest - OVERHEAD;
    }

    static long encryptedSize(long plain) {
        long chunks = plain == 0 ? 1 : (plain + CHUNK - 1) / CHUNK;
        return HEADER + plain + chunks * OVERHEAD;
    }

    /** Streams plaintext into chunks. Only close() writes the final chunk. */
    static final class Writer extends OutputStream {
        private final OutputStream out;
        private final byte[] key, header, buffer = new byte[CHUNK];
        private final String id;
        private final long limit;
        private final MessageDigest digest;
        private int filled;
        private long index, size;
        private boolean closed;

        Writer(OutputStream out, byte[] dataKey, String id, long limit) throws IOException {
            this.out = out; this.id = id; this.limit = limit;
            try {
                key = random(KEY);
                byte[] wrapped = seal(dataKey, key, keyAad(id));
                header = ByteBuffer.allocate(HEADER).put(MAGIC).put((byte) 1).putInt(CHUNK).put(wrapped).array();
                digest = MessageDigest.getInstance("SHA-256");
            } catch (GeneralSecurityException error) { throw new Failure("VAULT_UNAVAILABLE"); }
            out.write(header);
        }
        @Override public void write(int b) throws IOException { write(new byte[] {(byte) b}, 0, 1); }
        @Override public void write(byte[] data, int offset, int length) throws IOException {
            if (closed) throw new IOException("CLOSED");
            if (size + length > limit) throw new Failure("FILE_TOO_LARGE");
            digest.update(data, offset, length);
            size += length;
            while (length > 0) {
                // A full buffer is emitted only when more data follows: the last chunk stays for close().
                if (filled == CHUNK) emit(false);
                int n = Math.min(length, CHUNK - filled);
                System.arraycopy(data, offset, buffer, filled, n);
                filled += n; offset += n; length -= n;
            }
        }
        private void emit(boolean last) throws IOException {
            try { out.write(seal(key, Arrays.copyOf(buffer, filled), chunkAad(header, id, index++, last))); }
            catch (GeneralSecurityException error) { throw new Failure("VAULT_UNAVAILABLE"); }
            filled = 0;
        }
        long size() { return size; }
        private String finished;
        @Override public void close() throws IOException {
            if (closed) return;
            closed = true;
            try { emit(true); out.flush(); }
            finally { Arrays.fill(buffer, (byte) 0); Arrays.fill(key, (byte) 0); out.close(); }
            finished = hex(digest.digest());
        }
        /** Hex SHA-256 of the plaintext; valid after close(). */
        String digestHex() { return finished; }
    }

    /** Random access reader over a seekable channel. */
    static final class Reader implements Closeable {
        private final FileChannel channel;
        private final Closeable owner;
        private final byte[] key, header = new byte[HEADER];
        private final String id;
        private final long chunks, plain;

        Reader(FileChannel channel, Closeable owner, byte[] dataKey, String id) throws IOException {
            this.channel = channel; this.owner = owner; this.id = id;
            long encrypted = channel.size();
            plain = plainSize(encrypted);
            chunks = plain == 0 ? 1 : (plain + CHUNK - 1) / CHUNK;
            readFully(0, header);
            ByteBuffer h = ByteBuffer.wrap(header);
            byte[] magic = new byte[4]; h.get(magic);
            if (!Arrays.equals(magic, MAGIC) || h.get() != 1 || h.getInt() != CHUNK) throw new Failure("VAULT_DAMAGED");
            try { key = open(dataKey, header, 9, NONCE + KEY + TAG, keyAad(id)); }
            catch (GeneralSecurityException error) { throw new Failure("VAULT_DAMAGED"); }
        }
        long size() { return plain; }
        private void readFully(long position, byte[] target) throws IOException {
            ByteBuffer buffer = ByteBuffer.wrap(target);
            while (buffer.hasRemaining()) {
                int n = channel.read(buffer, position + buffer.position());
                if (n < 0) throw new EOFException();
            }
        }
        byte[] chunk(long index) throws IOException {
            if (index < 0 || index >= chunks) throw new Failure("INVALID_INPUT");
            boolean last = index == chunks - 1;
            int length = (int) ((last ? plain - index * CHUNK : CHUNK) + OVERHEAD);
            byte[] sealed = new byte[length];
            readFully(HEADER + index * (long) (CHUNK + OVERHEAD), sealed);
            try { return open(key, sealed, 0, length, chunkAad(header, id, index, last)); }
            catch (GeneralSecurityException error) { throw new Failure("VAULT_DAMAGED"); }
        }
        /** Up to one chunk from offset; offset must be chunk-aligned for streaming callers. */
        byte[] read(long offset, int max) throws IOException {
            if (offset < 0 || offset > plain || max < 0) throw new Failure("INVALID_INPUT");
            if (offset == plain) return new byte[0];
            long index = offset / CHUNK;
            byte[] block = chunk(index);
            int start = (int) (offset - index * CHUNK), n = Math.min(max, block.length - start);
            byte[] out = Arrays.copyOfRange(block, start, start + n);
            Arrays.fill(block, (byte) 0);
            return out;
        }
        InputStream stream() {
            return new InputStream() {
                long next; byte[] block = new byte[0]; int position;
                private boolean fill() throws IOException {
                    while (position >= block.length) {
                        if (next >= chunks) return false;
                        block = chunk(next++); position = 0;
                    }
                    return true;
                }
                @Override public int read() throws IOException { return fill() ? block[position++] & 255 : -1; }
                @Override public int read(byte[] b, int off, int len) throws IOException {
                    if (len == 0) return 0;
                    if (!fill()) return -1;
                    int n = Math.min(len, block.length - position);
                    System.arraycopy(block, position, b, off, n); position += n; return n;
                }
            };
        }
        @Override public void close() throws IOException { Arrays.fill(key, (byte) 0); try { channel.close(); } finally { if (owner != null) owner.close(); } }
    }

    /** Small documents (index, settings): one call, whole content. */
    static byte[] readAll(Reader reader, long limit) throws IOException {
        if (reader.size() > limit) throw new Failure("VAULT_DAMAGED");
        ByteArrayOutputStream out = new ByteArrayOutputStream((int) reader.size());
        try (InputStream in = reader.stream()) {
            byte[] buffer = new byte[8192]; int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
        }
        return out.toByteArray();
    }
}
