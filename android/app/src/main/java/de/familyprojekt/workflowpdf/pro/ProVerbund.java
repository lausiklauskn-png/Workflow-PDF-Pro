package de.familyprojekt.workflowpdf.pro;

import de.familyprojekt.tresor.*;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.*;

/** Identischer Geräteadapter auf Android und Windows; das FPT1-Paket bleibt unverändert.
 * Lesen ist keine Empfangsbestätigung. Erst der dauerhaft gespeicherte App-Eingang quittiert. */
public final class ProVerbund {
    private ProVerbund() { }
    public static Map<String,Object> call(TresorOrdner vault, Map<String,Object> args) throws IOException {
        if(vault==null)throw new IOException("TRESOR_GESPERRT");
        if(!Fach.WORKFLOW_PDF_APP.equals(vault.app())||!vault.id().equals(Json.text(args,"vaultId")))
            throw new IOException("TRESOR_UEBERGABE_FREMD");
        Uebergaben transfers=new Uebergaben(vault);
        switch(Json.text(args,"aktion")) {
            case "eingang": return result("items",transfers.offen());
            case "lesen": {
                String entry=Json.text(args,"entryId");
                Map<String,Object> contract=transfers.beschreibung(entry);
                byte[] bytes=transfers.lesen(entry);
                try {
                    if(bytes.length==0)throw new IOException("TRESOR_UEBERGABE_VERTRAG");
                    return result("entryId",entry,"vertrag",contract,"dataBase64",Base64.getEncoder().encodeToString(bytes));
                } finally {Arrays.fill(bytes,(byte)0);}
            }
            case "quittieren":
                transfers.quittieren(Json.text(args,"entryId"),Json.text(args,"sha256"));
                return result("stand","im-eingang");
            case "stand": return result("bestaetigt",transfers.bestaetigt(Json.text(args,"ziel"),Json.text(args,"entryId")));
            case "senden": return senden(vault,transfers,args);
            default: throw new IOException("TRESOR_UEBERGABE_VERTRAG");
        }
    }
    private static Map<String,Object> result(Object... values) {
        Map<String,Object> out=new LinkedHashMap<>();
        for(int i=0;i<values.length;i+=2)out.put((String)values[i],values[i+1]);
        return out;
    }
    private static Map<String,Object> senden(TresorOrdner vault,Uebergaben transfers,Map<String,Object> args)throws IOException {
        Object raw=args.get("vertrag");
        if(!(raw instanceof Map))throw new IOException("TRESOR_UEBERGABE_VERTRAG");
        Map<String,Object> m=Json.objekt(Json.schreiben(raw));
        String target=Json.text(m,"ziel"),hash=Json.text(m,"sha256"),data=Json.text(args,"dataBase64");
        long size=Json.zahl(m,"groesse");
        if(!Uebergaben.VERTRAG.equals(Json.text(m,"vertrag"))||!vault.app().equals(Json.text(m,"quelle"))||
            !Arrays.asList(Fach.FAMILIENAKTE_APP,Fach.PRIVATE_BRAIN_APP,Fach.BOOKLEDGER_APP).contains(target))
            throw new IOException("TRESOR_UEBERGABE_VERTRAG");
        if(size<=0||size>Uebergaben.MAX_BYTES||data.length()>((Uebergaben.MAX_BYTES+2L)/3)*4)
            throw new IOException("TRESOR_UEBERGABE_ZU_GROSS");
        String name=Json.text(m,"name"),mime=Json.text(m,"mime");
        boolean pdf=mime.equals("application/pdf")||name.toLowerCase(Locale.ROOT).endsWith(".pdf");
        if(target.equals(Fach.BOOKLEDGER_APP)&&!pdf&&!mime.startsWith("image/")&&!name.toLowerCase(Locale.ROOT).endsWith(".eml"))
            throw new IOException("TRESOR_UEBERGABE_TYP");
        byte[] bytes;
        try {bytes=Base64.getDecoder().decode(data);}catch(IllegalArgumentException invalid){throw new IOException("TRESOR_UEBERGABE_VERTRAG");}
        try {
            if(bytes.length!=size||!sha(bytes).equals(hash))throw new IOException("TRESOR_UEBERGABE_PRUEFSUMME");
            Eintrag result=transfers.senden(target,Json.text(m,"id"),Json.text(m,"dokumentId"),Json.textOder(m,"bezug",""),name,mime,new ByteArrayInputStream(bytes));
            if(result.groesse!=size||!result.sha256.equals(hash))throw new IOException("TRESOR_UEBERGABE_PRUEFSUMME");
            return result.alsMap();
        } finally {Arrays.fill(bytes,(byte)0);}
    }
    public static String sha(byte[] bytes)throws IOException {
        try {
            byte[] hash=MessageDigest.getInstance("SHA-256").digest(bytes);char[] hex=new char[hash.length*2];
            for(int i=0;i<hash.length;i++){int b=hash[i]&255;hex[2*i]="0123456789abcdef".charAt(b>>>4);hex[2*i+1]="0123456789abcdef".charAt(b&15);}
            return new String(hex);
        }
        catch(java.security.NoSuchAlgorithmException impossible){throw new IOException(impossible);}
    }
}
