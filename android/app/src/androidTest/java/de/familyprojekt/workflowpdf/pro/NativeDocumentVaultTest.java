package de.familyprojekt.workflowpdf.pro;

import android.content.Context;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real SAF/Keystore/crypto; local debug provider, no actual removable SD card. */
@RunWith(AndroidJUnit4.class)
public final class NativeDocumentVaultTest {
    private static final String PASSWORD = "Workflow Passwort Ä 2026";
    private Context context() { return InstrumentationRegistry.getInstrumentation().getTargetContext(); }
    private Uri tree() { return DocumentsContract.buildTreeDocumentUri(context().getPackageName()+".fixture.documents", "vaultA"); }
    private File folder() { return new File(context().getCacheDir(), "fixture-documents/vaultA/Workflow PDF Pro"); }
    private DocumentVault fresh(String name) throws Exception {
        context().getSharedPreferences("test-vault-"+name,0).edit().clear().commit();
        return new DocumentVault(context(),"test-vault-"+name,"test-workflow-vault-"+name);
    }
    private void reset() { context().getContentResolver().call(Uri.parse("content://"+context().getPackageName()+".fixture.documents"),"fixture-reset",null,null); }
    private static void write(DocumentVault vault, String id, byte[] value) throws Exception {
        String ticket=vault.begin("files",id);
        for(int offset=0;offset<value.length;offset+=262144) vault.append(ticket,offset,Arrays.copyOfRange(value,offset,Math.min(value.length,offset+262144)));
        vault.finish(ticket,value.length);
    }
    private static byte[] read(DocumentVault vault,String id)throws Exception {
        int length=(int)vault.info("files",id).getLong("size");ByteArrayOutputStream out=new ByteArrayOutputStream();
        for(long offset=0;offset<length;){byte[] data=vault.read("files",id,offset);assertTrue(data.length>0);out.write(data);offset+=data.length;}
        return out.toByteArray();
    }
    private static byte[] fileBytes(File file)throws Exception {
        try(InputStream in=new FileInputStream(file);ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);return out.toByteArray();
        }
    }
    private static void deleteTree(File file){File[] list=file.listFiles();if(list!=null)for(File child:list)deleteTree(child);file.delete();}
    @Test public void realFolderRoundTripAndPasswordRecoveryOnAnotherDevice() throws Exception {
        reset();DocumentVault a=fresh("a");
        a.initialize(a.inspect(tree()),PASSWORD,false);
        byte[] value=new byte[600001];new Random(4).nextBytes(value);write(a,"Документ",value);
        assertArrayEquals(value,read(a,"Документ"));a.closeWorking();
        DocumentVault b=fresh("b");
        try { b.open(b.inspect(tree()),"wrong password",false);fail("Wrong password accepted"); }
        catch(IOException expected){assertEquals("VAULT_PASSWORD",expected.getMessage());}
        assertFalse(b.configured());b.open(b.inspect(tree()),PASSWORD,false);
        assertArrayEquals(value,read(b,"Документ"));
        String header=new String(fileBytes(new File(folder(),DocumentVault.HEADER)),StandardCharsets.UTF_8);
        assertFalse(header.contains(PASSWORD));assertFalse(header.contains("Документ"));
    }
    @Test public void copiedEncryptedFolderWorksWithDifferentProviderDocumentIds() throws Exception {
        reset();DocumentVault a=fresh("a");a.initialize(a.inspect(tree()),PASSWORD,false);write(a,"move",new byte[]{7,8,9});a.closeWorking();
        File copy=new File(context().getCacheDir(),"fixture-documents/libraryB/Workflow PDF Pro");assertTrue(copy.mkdir());
        for(File source:Objects.requireNonNull(folder().listFiles()))try(FileOutputStream out=new FileOutputStream(new File(copy,source.getName()))){out.write(fileBytes(source));}
        deleteTree(folder());DocumentVault b=fresh("b");
        Uri newTree=DocumentsContract.buildTreeDocumentUri(context().getPackageName()+".fixture.documents","libraryB");
        b.open(b.inspect(newTree),PASSWORD,false);assertArrayEquals(new byte[]{7,8,9},read(b,"move"));
    }
    @Test public void rememberUsesRealKeystoreAndLockActuallyRequiresPasswordAgain() throws Exception {
        reset();DocumentVault a=fresh("remember");a.initialize(a.inspect(tree()),PASSWORD,true);write(a,"x",new byte[]{1,2,3});a.closeWorking();
        DocumentVault resumed=new DocumentVault(context(),"test-vault-remember","test-workflow-vault-remember");
        assertArrayEquals(new byte[]{1,2,3},read(resumed,"x"));resumed.lock();
        assertEquals("VAULT_LOCKED",resumed.state().getString("problem"));
        resumed.open(resumed.inspect(tree()),PASSWORD,false);assertArrayEquals(new byte[]{1,2,3},read(resumed,"x"));
    }
    @Test public void interruptedAndOutOfOrderTransfersDoNotReplaceCommittedData() throws Exception {
        reset();DocumentVault a=fresh("a");a.initialize(a.inspect(tree()),PASSWORD,false);write(a,"x",new byte[]{1,2,3});
        String ticket=a.begin("files","x");
        try {a.append(ticket,5,new byte[]{9});fail("Out-of-order chunk accepted");}catch(IOException expected){assertEquals("VAULT_INVALID_TRANSFER",expected.getMessage());}
        a.append(ticket,0,new byte[]{9});a.abort(ticket);assertArrayEquals(new byte[]{1,2,3},read(a,"x"));
        ticket=a.begin("files","x");a.append(ticket,0,new byte[]{9});
        try {a.finish(ticket,99);fail("Incomplete write accepted");}catch(IOException expected){assertEquals("VAULT_INVALID_TRANSFER",expected.getMessage());}
        a.abort(ticket);assertArrayEquals(new byte[]{1,2,3},read(a,"x"));
    }
    @Test public void corruptCiphertextIsRejectedBeforeReturningPlaintext() throws Exception {
        reset();DocumentVault a=fresh("a");a.initialize(a.inspect(tree()),PASSWORD,false);byte[] value=new byte[600001];write(a,"x",value);
        File target=Arrays.stream(Objects.requireNonNull(folder().listFiles())).filter(f->f.getName().endsWith(".wpv")&&f.length()>500000).findFirst().get();
        try(RandomAccessFile file=new RandomAccessFile(target,"rw")){file.seek(VaultCrypto.HEADER+10);int b=file.read();file.seek(VaultCrypto.HEADER+10);file.write(b^1);}
        try {read(a,"x");fail("Changed encrypted data accepted");}catch(IOException expected){assertEquals("VAULT_DAMAGED",expected.getMessage());}
    }
    @Test public void replacingRecordsKeepsOnlyThreeGenerationsAndPreservesUnrelatedFiles() throws Exception {
        reset();DocumentVault a=fresh("a");a.initialize(a.inspect(tree()),PASSWORD,false);
        File unknown=new File(folder(),"Eigene Notiz.txt");try(FileOutputStream out=new FileOutputStream(unknown)){out.write(7);}
        for(int i=0;i<8;i++)write(a,"x",new byte[]{(byte)i});
        assertArrayEquals(new byte[]{7},read(a,"x"));assertTrue(unknown.isFile());
        long commits=Arrays.stream(Objects.requireNonNull(folder().listFiles())).filter(f->f.getName().startsWith("commit-")).count();assertEquals(3,commits);
        assertTrue(Arrays.stream(Objects.requireNonNull(folder().listFiles())).filter(f->f.getName().endsWith(".wpv")).count()<=6);
    }
    @Test public void failedNewWriteKeepsExistingRecordAndLibraryState() throws Exception {
        reset();DocumentVault a=fresh("a");a.initialize(a.inspect(tree()),PASSWORD,false);write(a,"x",new byte[]{1,2,3});
        context().getContentResolver().call(Uri.parse("content://"+context().getPackageName()+".fixture.documents"),"fixture-broken",null,null);
        try{write(a,"x",new byte[]{9});fail("Failed provider accepted a write");}catch(IOException expected){}
        assertArrayEquals(new byte[]{1,2,3},read(a,"x"));assertTrue(a.configured());
    }
    @Test public void internalStorageIsDefaultAndSelectingItKeepsPreviousVaultAccessible() throws Exception {
        reset();String name="test-locations-internal";context().getSharedPreferences(name,0).edit().clear().commit();
        VaultLocations places=new VaultLocations(context(),name,"test-location-key");
        assertTrue(places.state(null).getBoolean("internal"));assertFalse(places.state(null).getBoolean("configured"));
        DocumentVault a=places.candidate();a.initialize(a.inspect(tree()),PASSWORD,true);write(a,"old",new byte[]{4,5});
        String id=places.adopt(a);places.select(id);assertEquals(id,places.primary());
        places.select(null);assertTrue(places.state(null).getBoolean("internal"));assertArrayEquals(new byte[]{4,5},read(places.get(id),"old"));
        places.close();VaultLocations resumed=new VaultLocations(context(),name,"test-location-key");
        assertTrue(resumed.state(null).getBoolean("internal"));assertArrayEquals(new byte[]{4,5},read(resumed.get(id),"old"));
    }
    @Test public void missingPrimaryNeverSilentlyFallsBackToAnEmptyInternalLibrary() throws Exception {
        reset();String name="test-locations-missing";context().getSharedPreferences(name,0).edit().clear().commit();
        VaultLocations places=new VaultLocations(context(),name,"test-location-key");DocumentVault a=places.candidate();
        a.initialize(a.inspect(tree()),PASSWORD,true);String id=places.adopt(a);places.select(id);deleteTree(folder());
        org.json.JSONObject state=places.state(null);assertEquals(id,state.getString("location"));
        assertTrue(state.getBoolean("configured"));assertFalse(state.getBoolean("unlocked"));assertFalse(state.optBoolean("internal"));
        assertTrue(state.has("problem"));assertEquals(id,places.primary());
    }
    @Test public void switchingPrimaryDuringWriteIsRejectedWithoutDroppingExistingGrants() throws Exception {
        reset();String name="test-locations-busy";context().getSharedPreferences(name,0).edit().clear().commit();
        VaultLocations places=new VaultLocations(context(),name,"test-location-key");DocumentVault a=places.candidate();a.initialize(a.inspect(tree()),PASSWORD,false);
        String id=places.adopt(a);places.select(id);String ticket=a.begin("files","active");
        try{places.select(null);fail("Storage switched during active write");}catch(IOException expected){assertEquals("VAULT_BUSY",expected.getMessage());}
        assertEquals(id,places.primary());a.append(ticket,0,new byte[]{1});a.finish(ticket,1);assertArrayEquals(new byte[]{1},read(a,"active"));
        places.select(null);assertArrayEquals(new byte[]{1},read(places.get(id),"active"));
    }
}
