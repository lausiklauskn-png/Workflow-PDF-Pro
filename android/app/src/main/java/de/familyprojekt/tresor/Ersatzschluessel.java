package de.familyprojekt.tresor;

import java.io.IOException;
import java.security.MessageDigest;
import java.util.*;

/**
 * Ersatzschlüssel des gemeinsamen Tresorordners: dieselbe Shamir-Rechnung und dasselbe
 * Teil-Format wie {@code VaultRecovery} in Workflow PDF Pro (5 Teile, 3 genügen), nur mit
 * eigener Vorsilbe „FPT1“, damit ein Teil des Ordners nie mit einem Teil eines App-Tresors
 * verwechselt wird.
 *
 * Teil: "FPT1-" + Crockford-Base32 von [1][Satz 4][k][x][32 Byte][Prüfung 2],
 * in Fünfergruppen. Groß/klein, Leerzeichen und O/0, I/L/1 werden toleriert.
 */
final class Ersatzschluessel {
    static final int SECRET = 32, DEFAULT_N = 5, DEFAULT_K = 3;
    static final String PREFIX = "FPT1";
    private static final char[] ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ".toCharArray();
    private static final int[] EXP = new int[512], LOG = new int[256];
    static {
        int x = 1;
        for (int i = 0; i < 255; i++) {
            EXP[i] = x; LOG[x] = i;
            int two = (x << 1) & 0xff; if ((x & 0x80) != 0) two ^= 0x1b;
            x = two ^ x;
        }
        for (int i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
    }
    private Ersatzschluessel() { }

    static final class Share {
        final byte[] set; final int k, x; final byte[] data;
        Share(byte[] set, int k, int x, byte[] data) { this.set = set; this.k = k; this.x = x; this.data = data; }
    }

    private static int mul(int a, int b) { return a == 0 || b == 0 ? 0 : EXP[LOG[a] + LOG[b]]; }
    private static int inv(int a) { return EXP[255 - LOG[a]]; }

    static List<Share> split(byte[] secret, byte[] set, int n, int k) throws IOException {
        if (k < 2 || n < k || n > 255 || set.length != 4) throw new IOException("TRESOR_ERSATZ_INVALID");
        List<Share> shares = new ArrayList<>();
        for (int x = 1; x <= n; x++) shares.add(new Share(set.clone(), k, x, new byte[secret.length]));
        byte[] coeffs = new byte[k];
        for (int i = 0; i < secret.length; i++) {
            byte[] random = VaultCrypto.random(k);
            System.arraycopy(random, 0, coeffs, 0, k); Arrays.fill(random, (byte) 0);
            coeffs[0] = secret[i];
            for (Share share : shares) {
                int y = 0;
                for (int d = k - 1; d >= 0; d--) y = mul(y, share.x) ^ (coeffs[d] & 255);
                share.data[i] = (byte) y;
            }
        }
        Arrays.fill(coeffs, (byte) 0);
        return shares;
    }

    static byte[] combine(List<Share> shares) throws IOException {
        if (shares.isEmpty()) throw new IOException("TRESOR_ERSATZ_INCOMPLETE");
        Share first = shares.get(0); Set<Integer> seen = new HashSet<>();
        for (Share s : shares) {
            if (!Arrays.equals(s.set, first.set) || s.k != first.k || s.data.length != first.data.length || s.x == 0) throw new IOException("TRESOR_ERSATZ_MIXED");
            if (!seen.add(s.x)) throw new IOException("TRESOR_ERSATZ_DUPLICATE");
        }
        if (shares.size() < first.k) throw new IOException("TRESOR_ERSATZ_INCOMPLETE");
        List<Share> used = shares.subList(0, first.k);
        byte[] out = new byte[first.data.length];
        for (int b = 0; b < out.length; b++) {
            int acc = 0;
            for (int i = 0; i < used.size(); i++) {
                int num = 1, den = 1;
                for (int j = 0; j < used.size(); j++) if (i != j) { num = mul(num, used.get(j).x); den = mul(den, used.get(j).x ^ used.get(i).x); }
                acc ^= mul(used.get(i).data[b] & 255, mul(num, inv(den)));
            }
            out[b] = (byte) acc;
        }
        return out;
    }

    private static byte[] checksum(byte[] payload, int length) throws IOException {
        try { MessageDigest d = MessageDigest.getInstance("SHA-256"); d.update(payload, 0, length); byte[] h = d.digest(); return new byte[] {h[0], h[1]}; }
        catch (Exception error) { throw new IOException("TRESOR_NICHT_VERFUEGBAR"); }
    }

    static String encode(Share share) throws IOException {
        byte[] payload = new byte[1 + 4 + 1 + 1 + share.data.length + 2];
        payload[0] = 1; System.arraycopy(share.set, 0, payload, 1, 4); payload[5] = (byte) share.k; payload[6] = (byte) share.x;
        System.arraycopy(share.data, 0, payload, 7, share.data.length);
        byte[] check = checksum(payload, payload.length - 2);
        payload[payload.length - 2] = check[0]; payload[payload.length - 1] = check[1];
        StringBuilder body = new StringBuilder(); int buffer = 0, bits = 0;
        for (byte value : payload) { buffer = (buffer << 8) | (value & 255); bits += 8; while (bits >= 5) { bits -= 5; body.append(ALPHABET[(buffer >> bits) & 31]); } }
        if (bits > 0) body.append(ALPHABET[(buffer << (5 - bits)) & 31]);
        Arrays.fill(payload, (byte) 0);
        StringBuilder out = new StringBuilder(PREFIX);
        for (int i = 0; i < body.length(); i += 5) out.append('-').append(body, i, Math.min(body.length(), i + 5));
        return out.toString();
    }

    static Share decode(String text) throws IOException {
        StringBuilder cleaned = new StringBuilder();
        for (char c : text.toCharArray()) if (!Character.isWhitespace(c) && c != '-') cleaned.append(Character.toUpperCase(c));
        if (cleaned.length() < 4 || !cleaned.substring(0, 4).equals(PREFIX)) throw new IOException("TRESOR_ERSATZ_TYPO");
        ByteArrayBuilder out = new ByteArrayBuilder(); int buffer = 0, bits = 0;
        for (int i = 4; i < cleaned.length(); i++) {
            char c = cleaned.charAt(i); if (c == 'O') c = '0'; if (c == 'I' || c == 'L') c = '1';
            int v = -1; for (int a = 0; a < 32; a++) if (ALPHABET[a] == c) v = a;
            if (v < 0) throw new IOException("TRESOR_ERSATZ_TYPO");
            buffer = (buffer << 5) | v; bits += 5;
            if (bits >= 8) { bits -= 8; out.add((buffer >> bits) & 255); }
        }
        byte[] bytes = out.bytes();
        if (bytes.length != 1 + 4 + 1 + 1 + SECRET + 2 || bytes[0] != 1) throw new IOException("TRESOR_ERSATZ_TYPO");
        byte[] check = checksum(bytes, bytes.length - 2);
        if (check[0] != bytes[bytes.length - 2] || check[1] != bytes[bytes.length - 1]) throw new IOException("TRESOR_ERSATZ_TYPO");
        int k = bytes[5] & 255, x = bytes[6] & 255;
        if (k < 2 || x == 0) throw new IOException("TRESOR_ERSATZ_TYPO");
        return new Share(Arrays.copyOfRange(bytes, 1, 5), k, x, Arrays.copyOfRange(bytes, 7, 7 + SECRET));
    }

    private static final class ByteArrayBuilder {
        private byte[] data = new byte[48]; private int size;
        void add(int value) { if (size == data.length) data = Arrays.copyOf(data, size * 2); data[size++] = (byte) value; }
        byte[] bytes() { return Arrays.copyOf(data, size); }
    }
}
