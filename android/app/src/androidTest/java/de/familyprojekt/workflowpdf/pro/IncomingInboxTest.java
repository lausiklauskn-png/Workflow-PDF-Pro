package de.familyprojekt.workflowpdf.pro;

import android.content.*;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.util.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public final class IncomingInboxTest {
    private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    private String authority;
    private void remove(File file){File[] children=file.listFiles();if(children!=null)for(File child:children)remove(child);file.delete();}
    @Before public void setup(){authority=context.getPackageName()+".fixture.documents";context.getContentResolver().call(Uri.parse("content://"+authority),"fixture-reset",null,null);remove(new File(context.getNoBackupFilesDir(),"incoming-v1"));}
    @After public void clean(){remove(new File(context.getNoBackupFilesDir(),"incoming-v1"));}
    private Intent send(String source){return new Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM,DocumentsContract.buildDocumentUri(authority,source));}
    @Test public void twoStagedBatchesSurviveNewInboxWithoutProviderAndAcknowledgedCopiesCanBeExplicitlyRestored()throws Exception{
        String first=UUID.randomUUID().toString(),second=UUID.randomUUID().toString();
        try(IncomingInbox inbox=new IncomingInbox(context)){inbox.add(first,send("sourceA/one.txt"));inbox.add(second,send("sourceB/two.txt"));assertEquals(first,inbox.pending().getString("id"));}
        try(IncomingInbox inbox=new IncomingInbox(context)){
            JSONObject batch=inbox.pending();String ticket=batch.getJSONArray("files").getJSONObject(0).getString("id");
            assertTrue(new File(context.getCacheDir(),"fixture-documents/sourceA/one.txt").delete());
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();long offset=0;do{byte[] part=inbox.read(first,ticket,offset);bytes.write(part);offset+=part.length;}while(!inbox.done());
            assertEquals(300000,bytes.size());byte[] all=bytes.toByteArray();for(int i=0;i<all.length;i++)assertEquals((byte)(i%251),all[i]);
            inbox.acknowledge(first,false);assertEquals(second,inbox.pending().getString("id"));inbox.acknowledge(second,false);assertTrue(inbox.pending().getBoolean("empty"));assertEquals(2,inbox.history().length());
        }
        try(IncomingInbox inbox=new IncomingInbox(context)){assertTrue(inbox.pending().getBoolean("empty"));inbox.restore(first);assertEquals(first,inbox.pending().getString("id"));inbox.acknowledge(first,true);assertEquals(1,inbox.history().length());inbox.discardArchived(second);assertEquals(0,inbox.history().length());}
    }
    @Test public void corruptedPrivateCopyNeverReachesCoreAndCannotBeMistakenForAnEmptyFile()throws Exception{
        String id=UUID.randomUUID().toString();
        try(IncomingInbox inbox=new IncomingInbox(context)){
            inbox.add(id,send("sourceA/one.txt"));JSONObject batch=inbox.pending();String ticket=batch.getJSONArray("files").getJSONObject(0).getString("id");
            File file=new File(context.getNoBackupFilesDir(),"incoming-v1/"+id+"/"+ticket+".bin");try(RandomAccessFile out=new RandomAccessFile(file,"rw")){out.write(255);}
            try{inbox.read(id,ticket,0);fail("Corrupted copy accepted");}catch(IOException expected){}
            assertEquals(id,inbox.pending().getString("id"));inbox.acknowledge(id,true);
        }
    }
    @Test public void failedLaterFileNeverExposesPartialBatchAndCanRetryWithoutDeletingEarlierCopy()throws Exception{
        String id=UUID.randomUUID().toString();ArrayList<Uri> uris=new ArrayList<>();uris.add(DocumentsContract.buildDocumentUri(authority,"sourceA/one.txt"));uris.add(DocumentsContract.buildDocumentUri(authority,"sourceB/two.txt"));
        try(IncomingInbox inbox=new IncomingInbox(context)){
            inbox.add(id,new Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM,uris));
            File file=new File(context.getCacheDir(),"fixture-documents/sourceB/two.txt");assertTrue(file.delete());assertTrue(inbox.pending().getBoolean("problem"));
            try(FileOutputStream out=new FileOutputStream(file)){out.write("restored".getBytes(java.nio.charset.StandardCharsets.UTF_8));}
            assertEquals(2,inbox.pending().getJSONArray("files").length());inbox.acknowledge(id,true);
        }
    }
}
