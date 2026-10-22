package de.familyprojekt.workflowpdf.pro;

import java.io.*;
import java.nio.channels.FileChannel;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

/** Test-only entry to the unmodified Android codec; all keys/data are synthetic. */
public final class VaultCodecCompat {
    private static final String NAME = "workflow-pdf-pro-vault:compat:files:Мюллер";
    public static void main(String[] args) throws Exception {
        byte[] key = new byte[32]; for (int i=0; i<key.length; i++) key[i]=(byte)i;
        switch(args[0]) {
        case "write":
            try (InputStream in = Files.newInputStream(Paths.get(args[1]));
                 VaultCrypto.Writer out = new VaultCrypto.Writer(Files.newOutputStream(Paths.get(args[2]), StandardOpenOption.CREATE_NEW), key, NAME, Long.MAX_VALUE)) {
                byte[] block = new byte[262144]; int n;
                while ((n=in.read(block))!=-1) out.write(block,0,n);
            }
            break;
        case "read":
            try (VaultCrypto.Reader reader = new VaultCrypto.Reader(FileChannel.open(Paths.get(args[1]), StandardOpenOption.READ), null, key, NAME)) {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                // Include the mandatory authentication block even for empty input.
                for (long i=0; i<Math.max(1,(reader.size()+262143)/262144); i++) digest.update(reader.chunk(i));
                System.out.println(VaultCrypto.hex(digest.digest()));
            }
            break;
        case "derive":
            byte[] salt = new byte[16]; for (int i=0; i<salt.length; i++) salt[i]=(byte)i;
            System.out.println(VaultCrypto.hex(VaultCrypto.pbkdf2(VaultCrypto.passwordBytes("Gemäßigtes Passwort €"), salt, 600000)));
            break;
        default: throw new IllegalArgumentException("Unknown operation");
        }
    }
}
