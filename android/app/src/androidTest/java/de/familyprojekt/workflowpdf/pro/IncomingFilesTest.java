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
public final class IncomingFilesTest {
    private Context context;private Uri first,second;
    @Before public void setup(){
        context=InstrumentationRegistry.getInstrumentation().getTargetContext();String authority=context.getPackageName()+".fixture.documents";
        context.getContentResolver().call(Uri.parse("content://"+authority),"fixture-reset",null,null);
        first=DocumentsContract.buildDocumentUri(authority,"sourceA/one.txt");second=DocumentsContract.buildDocumentUri(authority,"sourceB/two.txt");
    }
    @Test public void sendViewAndClipOnlyPreserveBytesWithoutAcceptingWebUris()throws Exception{
        Intent clip=new Intent(Intent.ACTION_SEND);clip.setClipData(ClipData.newRawUri("file",first));
        for(Intent intent:new Intent[]{new Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM,first),new Intent(Intent.ACTION_VIEW,first),clip}){
            try(IncomingFiles files=new IncomingFiles(context.getContentResolver(),intent)){
                JSONObject item=files.describe().getJSONObject(0);assertEquals("one.txt",item.getString("name"));String id=item.getString("id");
                ByteArrayOutputStream out=new ByteArrayOutputStream();do{out.write(files.read(id,out.size()));}while(!files.done());
                assertEquals(300000,out.size());byte[] bytes=out.toByteArray();for(int i=0;i<bytes.length;i++)assertEquals((byte)(i%251),bytes[i]);
                files.rewind();assertEquals(262144,files.read(id,0).length);
            }
        }
        for(String uri:new String[]{"file:///data/private","https://example.com/file.pdf"}){
            try{new IncomingFiles(context.getContentResolver(),new Intent(Intent.ACTION_VIEW,Uri.parse(uri)));fail("Untrusted URI accepted");}catch(IOException expected){}
        }
    }
    @Test public void multipleDeduplicatesOnlySameUriAndRejectsSkippedOffsetsAndForeignTickets()throws Exception{
        ArrayList<Uri> uris=new ArrayList<>(Arrays.asList(first,second,first));
        try(IncomingFiles files=new IncomingFiles(context.getContentResolver(),new Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM,uris))){
            JSONArray items=files.describe();assertEquals(2,items.length());String id=items.getJSONObject(0).getString("id");
            for(String ticket:new String[]{id,"content://private"})try{files.read(ticket,12);fail("Invalid offset/ticket accepted");}catch(IOException expected){}
            assertEquals(262144,files.read(id,0).length);
            try{files.read(items.getJSONObject(1).getString("id"),0);fail("Unfinished file abandoned");}catch(IOException expected){}
            files.close();try{files.read(id,262144);fail("Closed ticket reused");}catch(IOException expected){}
        }
    }
    @Test public void missingOrEmptyStreamCannotMasqueradeAsSuccessfulRead()throws Exception{
        try{new IncomingFiles(context.getContentResolver(),new Intent(Intent.ACTION_SEND));fail("Empty intent accepted");}catch(IOException expected){}
        try(IncomingFiles files=new IncomingFiles(context.getContentResolver(),new Intent(Intent.ACTION_VIEW,first))){
            String ticket=files.describe().getJSONObject(0).getString("id");
            assertTrue(new File(context.getCacheDir(),"fixture-documents/sourceA/one.txt").delete());
            try{files.read(ticket,0);fail("Removed file accepted");}catch(FileNotFoundException expected){}
        }
    }
}
