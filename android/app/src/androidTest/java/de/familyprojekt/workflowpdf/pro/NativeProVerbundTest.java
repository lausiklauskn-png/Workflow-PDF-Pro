package de.familyprojekt.workflowpdf.pro;

import android.content.Context;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import de.familyprojekt.tresor.SafAblage;
import de.familyprojekt.tresor.TresorOrdner;
import de.familyprojekt.tresor.Uebergaben;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real SAF, canonical FPT1 and Android Keystore. Canonical Family actor; not a second installed app.
 * Adapted from Private Brain Pro NativeProVerbundTest (PR #124); Workflow bridge and state are real. */
@RunWith(AndroidJUnit4.class)
public class NativeProVerbundTest {
    @Test public void optionalCommonVaultReceivesAndReturnsWithoutOwnVaultSetup() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        String authority=context.getPackageName()+".fixture.documents";
        context.getContentResolver().call(Uri.parse("content://"+authority),"fixture-reset",null,null);
        Uri tree=DocumentsContract.buildTreeDocumentUri(authority,"vaultA");
        ProTresorordner adapter=new ProTresorordner(context);
        adapter.sperren(true);context.getSharedPreferences("workflow-tresorordner-v1",0).edit().clear().commit();
        context.getSharedPreferences("vault-test-pro-optional",0).edit().clear().commit();
        DocumentVault own=new DocumentVault(context,"vault-test-pro-optional","workflow-vault-test-pro-optional");
        String password="CI-Pro-Verbund-ä-2026";
        try(TresorOrdner family=TresorOrdner.anlegen(new SafAblage(context.getContentResolver(),tree),"familienakte",password)){
            Uebergaben sender=new Uebergaben(family);byte[] bytes="Erfundener Android-Brief für Workflow PDF".getBytes(StandardCharsets.UTF_8);
            var sent=sender.senden("workflow-pdf-pro","android-family-17","akte-17","","Android-Brief.txt","text/plain",new ByteArrayInputStream(bytes));
            adapter.pruefenVerbindung(tree);adapter.baumSetzen(tree);adapter.mitPasswort(password,false,true,own,true);
            JSONObject state=adapter.zustand(own);assertTrue(state.getBoolean("offen"));assertFalse(own.configured());assertFalse(state.getBoolean("eingezogen"));
            JSONObject base=new JSONObject().put("vaultId",family.id()).put("entryId",sent.id);
            assertEquals(1,adapter.uebergabe(new JSONObject(base.toString()).put("aktion","eingang")).getJSONArray("items").length());
            JSONObject read=adapter.uebergabe(new JSONObject(base.toString()).put("aktion","lesen"));
            assertEquals(sent.sha256,read.getJSONObject("vertrag").getString("sha256"));assertArrayEquals(bytes,java.util.Base64.getDecoder().decode(read.getString("dataBase64")));
            assertFalse("native file reading is not catalog acceptance",sender.bestaetigt("workflow-pdf-pro",sent.id));
            adapter.schliessen();assertTrue("Keystore remembered key reopens after losing in-memory state",adapter.zustand(own).getBoolean("offen"));
            try{adapter.uebergabe(new JSONObject(base.toString()).put("aktion","quittieren").put("sha256","0".repeat(64)));fail("wrong hash acknowledged");}
            catch(java.io.IOException expected){assertEquals("TRESOR_UEBERGABE_PRUEFSUMME",expected.getMessage());}
            assertFalse(sender.bestaetigt("workflow-pdf-pro",sent.id));
            JSONObject receipt=new JSONObject(base.toString()).put("aktion","quittieren").put("sha256",sent.sha256);
            adapter.uebergabe(receipt);adapter.uebergabe(receipt);assertTrue(sender.bestaetigt("workflow-pdf-pro",sent.id));
            assertTrue(family.verzeichnis("eingang-workflowpdf").stream().anyMatch(e->e.id.equals(sent.id)));
            JSONObject contract=new JSONObject().put("vertrag",Uebergaben.VERTRAG).put("quelle","workflow-pdf-pro").put("ziel","familienakte").put("id","android-wfp-return-17")
                .put("dokumentId",sent.sha256).put("bezug","android-family-17").put("name","Android-Brief.txt").put("mime","text/plain").put("groesse",bytes.length).put("sha256",sent.sha256);
            JSONObject request=new JSONObject().put("aktion","senden").put("vaultId",family.id()).put("vertrag",contract).put("dataBase64",java.util.Base64.getEncoder().encodeToString(bytes));
            String back=adapter.uebergabe(request).getString("id");assertEquals(back,adapter.uebergabe(request).getString("id"));assertArrayEquals(bytes,sender.lesen(back));
            assertEquals("android-family-17",sender.beschreibung(back).get("bezug"));
            JSONObject confirm=new JSONObject().put("aktion","stand").put("vaultId",family.id()).put("ziel","familienakte").put("entryId",back);
            assertFalse(adapter.uebergabe(confirm).getBoolean("bestaetigt"));sender.quittieren(back,sent.sha256);assertTrue(adapter.uebergabe(confirm).getBoolean("bestaetigt"));
            adapter.sperren(false);assertFalse(adapter.zustand(own).getBoolean("offen"));
            try{adapter.uebergabe(confirm);fail("manual lock reopened");}catch(java.io.IOException expected){assertEquals("TRESOR_GESPERRT",expected.getMessage());}
        }finally{adapter.sperren(true);context.getSharedPreferences("workflow-tresorordner-v1",0).edit().clear().commit();}
    }
}
