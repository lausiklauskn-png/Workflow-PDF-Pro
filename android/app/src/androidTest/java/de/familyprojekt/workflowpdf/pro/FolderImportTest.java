package de.familyprojekt.workflowpdf.pro;

import android.content.Context;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import java.io.*;
import static org.junit.Assert.*;

/** Real DocumentsProvider and streaming reads, synthetic data only; no physical SD claim. */
@RunWith(AndroidJUnit4.class)
public final class FolderImportTest {
    private Context context; private Uri provider,tree;
    @Before public void setup(){
        context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        String authority=context.getPackageName()+".fixture.documents";
        provider=Uri.parse("content://"+authority);context.getContentResolver().call(provider,"fixture-reset",null,null);
        tree=DocumentsContract.buildTreeDocumentUri(authority,"sourceA");
    }
    @Test public void realProviderStreamsOriginalAcrossChunkBoundary()throws Exception{
        try(FolderImport folder=new FolderImport(context.getContentResolver())){
            JSONArray files=folder.inspect(tree);assertEquals(1,files.length());JSONObject file=files.getJSONObject(0);
            assertEquals("one.txt",file.getString("name"));assertEquals("sourceA/one.txt",file.getString("path"));
            ByteArrayOutputStream out=new ByteArrayOutputStream();String ticket=file.getString("id");
            do{out.write(folder.read(ticket,out.size()));}while(!folder.done(ticket));
            byte[] bytes=out.toByteArray();assertEquals(300000,bytes.length);
            for(int i=0;i<bytes.length;i++)assertEquals((byte)(i%251),bytes[i]);
            try{folder.read(ticket,out.size());fail("Completed ticket reused");}catch(IOException expected){}
        }
    }
    @Test public void nestedUnicodeNamesAndEmptyFilesArePreserved()throws Exception{
        File root=new File(context.getCacheDir(),"fixture-documents/sourceA/Unterordner");assertTrue(root.mkdir());
        assertTrue(new File(root,"Мüller.txt").createNewFile());
        try(FolderImport folder=new FolderImport(context.getContentResolver())){
            JSONArray files=folder.inspect(tree);assertEquals(2,files.length());JSONObject nested=null;
            for(int i=0;i<files.length();i++)if(files.getJSONObject(i).getString("name").equals("Мüller.txt"))nested=files.getJSONObject(i);
            assertNotNull(nested);assertEquals("sourceA/Unterordner/Мüller.txt",nested.getString("path"));
            assertEquals(0,folder.read(nested.getString("id"),0).length);assertTrue(folder.done(nested.getString("id")));
        }
    }
    @Test public void callerCannotReadArbitraryUriOrSkipChunksAndCloseRevokesTickets()throws Exception{
        FolderImport folder=new FolderImport(context.getContentResolver());String ticket=folder.inspect(tree).getJSONObject(0).getString("id");
        for(String invalid:new String[]{"content://another/private",ticket}){
            try{folder.read(invalid,12);fail("Invalid read accepted");}catch(IOException expected){}
        }
        assertEquals(262144,folder.read(ticket,0).length);folder.close();
        try{folder.read(ticket,262144);fail("Closed ticket accepted");}catch(IOException expected){}
        try{folder.inspect(Uri.parse("file:///private"));fail("File URI accepted");}catch(SecurityException expected){}
    }
    @Test public void fileRemovedAfterSelectionFailsInsteadOfReturningEmptySuccess()throws Exception{
        try(FolderImport folder=new FolderImport(context.getContentResolver())){
            String ticket=folder.inspect(tree).getJSONObject(0).getString("id");
            assertTrue(new File(context.getCacheDir(),"fixture-documents/sourceA/one.txt").delete());
            try{folder.read(ticket,0);fail("Missing file accepted");}catch(FileNotFoundException expected){}
        }
    }
}
