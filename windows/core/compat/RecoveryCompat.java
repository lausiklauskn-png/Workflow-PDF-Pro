package de.familyprojekt.workflowpdf.pro;

import java.util.*;

/** Gegenprobe Ersatzschlüssel Android <-> Windows.
 *  split <geheimnis-hex>       : gibt 5 Teile aus (je Zeile)
 *  combine <teil> <teil> <teil> : gibt das Geheimnis als Hex aus */
public final class RecoveryCompat {
    public static void main(String[] args) throws Exception {
        if (args[0].equals("split")) {
            byte[] secret = new byte[32];
            for (int i = 0; i < 32; i++) secret[i] = (byte) Integer.parseInt(args[1].substring(2 * i, 2 * i + 2), 16);
            for (VaultRecovery.Share s : VaultRecovery.split(secret, new byte[] {1, 2, 3, 4}, 5, 3)) System.out.println(VaultRecovery.encode(s));
        } else {
            List<VaultRecovery.Share> shares = new ArrayList<>();
            for (int i = 1; i < args.length; i++) shares.add(VaultRecovery.decode(args[i]));
            System.out.println(VaultCrypto.hex(VaultRecovery.combine(shares)));
        }
    }
}
