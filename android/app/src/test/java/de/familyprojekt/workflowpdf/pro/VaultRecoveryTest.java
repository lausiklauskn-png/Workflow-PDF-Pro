package de.familyprojekt.workflowpdf.pro;

import java.util.*;
import org.junit.Test;
import static org.junit.Assert.*;

/** Ersatzschlüssel: Aufteilung 3 von 5, abtippbare Teile mit Prüfsumme. */
public final class VaultRecoveryTest {
    @Test public void everyThreeOfFiveRestoreAndTwoDoNot() throws Exception {
        byte[] secret = VaultCrypto.random(32);
        List<VaultRecovery.Share> shares = VaultRecovery.split(secret, new byte[] {1, 2, 3, 4}, 5, 3);
        int combos = 0;
        for (int a = 0; a < 5; a++) for (int b = a + 1; b < 5; b++) for (int c = b + 1; c < 5; c++) {
            assertArrayEquals(secret, VaultRecovery.combine(Arrays.asList(shares.get(a), shares.get(b), shares.get(c)))); combos++;
        }
        assertEquals(10, combos);
        try { VaultRecovery.combine(shares.subList(0, 2)); fail("Zwei Teile genügten"); }
        catch (java.io.IOException expected) { assertEquals("VAULT_RECOVERY_INCOMPLETE", expected.getMessage()); }
        try { VaultRecovery.combine(Arrays.asList(shares.get(0), shares.get(0), shares.get(1))); fail("Doppelter Teil angenommen"); }
        catch (java.io.IOException expected) { assertEquals("VAULT_RECOVERY_DUPLICATE", expected.getMessage()); }
    }
    @Test public void encodingToleratesCaseAndSpacesButDetectsTypos() throws Exception {
        for (VaultRecovery.Share share : VaultRecovery.split(VaultCrypto.random(32), new byte[] {9, 8, 7, 6}, 5, 3)) {
            String text = VaultRecovery.encode(share);
            assertTrue(text.startsWith("WFP1-"));
            VaultRecovery.Share back = VaultRecovery.decode(text.toLowerCase(Locale.ROOT).replace('-', ' ').replace('0', 'o'));
            assertArrayEquals(share.data, back.data); assertEquals(share.x, back.x); assertEquals(share.k, back.k);
            char[] chars = text.toCharArray(); chars[12] = chars[12] == 'A' ? 'B' : 'A';
            try { VaultRecovery.decode(new String(chars)); fail("Tippfehler angenommen"); }
            catch (java.io.IOException expected) { assertEquals("VAULT_RECOVERY_TYPO", expected.getMessage()); }
        }
    }
}
