package de.familyprojekt.workflowpdf.pro;

import static org.junit.Assert.*;
import org.junit.Test;

public class ScanDirektTest {
    @Test public void nurDieEigeneAktion() {
        assertTrue(ScanDirekt.istScan("de.familyprojekt.workflowpdf.pro.SCANNEN"));
        assertFalse(ScanDirekt.istScan("android.intent.action.SEND"));
        assertFalse(ScanDirekt.istScan(null));
        assertFalse(ScanDirekt.istScan("de.familyprojekt.workflowpdf.pro.SCANNEN.x"));
    }
    @Test public void absenderWirdGesaeubert() {
        assertEquals("BookLedgerPro", ScanDirekt.von("BookLedgerPro"));
        assertEquals("", ScanDirekt.von(null));
        assertEquals("abcalert1", ScanDirekt.von("<a>b'c\"alert(1)"));
        assertEquals("Private Brain Pro", ScanDirekt.von("  Private Brain Pro  "));
        assertEquals(ScanDirekt.VON_MAX, ScanDirekt.von("x".repeat(100)).length());
    }
}
