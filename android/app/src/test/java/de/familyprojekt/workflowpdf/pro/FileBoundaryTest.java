package de.familyprojekt.workflowpdf.pro;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.util.Arrays;

public final class FileBoundaryTest {
    @Test public void exportsCannotEscapeTheirTicketDirectoryAndUnicodeIsPreserved() {
        for (String input : new String[] {"../../key", "a\\b", "\u0000x\n", ".", "..", "", "   "}) {
            String output = ProFilesPlugin.filename(input);
            assertFalse(output.contains("/")); assertFalse(output.contains("\\"));
            assertFalse(output.equals(".")); assertFalse(output.equals(".."));
            assertFalse(output.isEmpty()); assertFalse(output.contains("\u0000"));
        }
        assertEquals("Müller — Документ.pdf", ProFilesPlugin.filename("Müller — Документ.pdf"));
    }
    @Test public void verificationHashDetectsChangedContentAcrossChunkBoundaries() throws Exception {
        byte[] data = new byte[600001];
        for (int i = 0; i < data.length; i++) data[i] = (byte) (i * 31);
        byte[] hash = ProFilesPlugin.hash(new ByteArrayInputStream(data));
        assertArrayEquals(java.security.MessageDigest.getInstance("SHA-256").digest(data), hash);
        data[262144] ^= 1;
        assertFalse(Arrays.equals(hash, ProFilesPlugin.hash(new ByteArrayInputStream(data))));
    }
}
