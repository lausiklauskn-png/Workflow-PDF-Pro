package de.familyprojekt.workflowpdf.pro;

import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import java.io.*;
import java.util.*;
import org.json.*;

/** Only content URIs explicitly supplied by a SEND/VIEW intent. Never accepts a
 * URI from JavaScript; tickets expire when the batch is acknowledged. */
final class IncomingFiles implements AutoCloseable {
    private final ContentResolver resolver;
    private final LinkedHashMap<String,Uri> uris=new LinkedHashMap<>();
    private InputStream input;
    private String reading;
    private long offset;
    private boolean done;
    IncomingFiles(ContentResolver resolver,Intent intent)throws IOException {
        this.resolver=resolver;
        LinkedHashSet<Uri> selected=new LinkedHashSet<>();
        String action=intent.getAction();
        if(Intent.ACTION_VIEW.equals(action)){if(intent.getData()!=null)selected.add(intent.getData());}
        else if(Intent.ACTION_SEND.equals(action)){
            Object uri=intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if(uri instanceof Uri)selected.add((Uri)uri);
        }else if(Intent.ACTION_SEND_MULTIPLE.equals(action)){
            ArrayList<?> list=intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if(list!=null)for(Object uri:list){if(!(uri instanceof Uri))throw new IOException("INCOMING_INVALID");selected.add((Uri)uri);}
        }else throw new IOException("INCOMING_INVALID");
        // Some senders put their stream only in ClipData. Do not mix unrelated
        // ClipData into a complete EXTRA_STREAM list or a VIEW request.
        if(selected.isEmpty()&&!Intent.ACTION_VIEW.equals(action)&&intent.getClipData()!=null)
            for(int i=0;i<intent.getClipData().getItemCount();i++){
                Uri uri=intent.getClipData().getItemAt(i).getUri();
                if(uri==null)throw new IOException("INCOMING_INVALID");selected.add(uri);
            }
        if(selected.isEmpty())throw new IOException("INCOMING_EMPTY");
        for(Uri uri:selected){
            if(!"content".equals(uri.getScheme())||uri.getAuthority()==null)throw new IOException("INCOMING_INVALID");
            uris.put(UUID.randomUUID().toString(),uri);
        }
    }
    static Intent sanitize(Intent intent)throws IOException {
        // Retain only our routing fields and content URIs, never arbitrary
        // sender parcelables, text, nested intents or other private extras.
        try(IncomingFiles files=new IncomingFiles(null,intent)){
            ArrayList<Uri> selected=new ArrayList<>(files.uris.values());
            Intent clean=new Intent(intent.getAction()).setType(intent.getType()).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if(Intent.ACTION_VIEW.equals(intent.getAction()))clean.setDataAndType(selected.get(0),intent.getType());
            else if(Intent.ACTION_SEND.equals(intent.getAction())&&selected.size()==1)clean.putExtra(Intent.EXTRA_STREAM,selected.get(0));
            else { clean.setAction(Intent.ACTION_SEND_MULTIPLE);clean.putParcelableArrayListExtra(Intent.EXTRA_STREAM,selected); }
            return clean;
        }
    }
    JSONArray describe()throws Exception {
        JSONArray out=new JSONArray();
        for(Map.Entry<String,Uri> entry:uris.entrySet()){
            String name="Datei";
            try(Cursor cursor=resolver.query(entry.getValue(),new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){
                if(cursor==null||!cursor.moveToFirst())throw new IOException("INCOMING_UNAVAILABLE");
                name=ProFilesPlugin.filename(cursor.getString(0));
            }
            String mime=resolver.getType(entry.getValue());
            out.put(new JSONObject().put("id",entry.getKey()).put("name",name).put("mime",mime==null?"application/octet-stream":mime));
        }
        return out;
    }
    void rewind()throws IOException { if(input!=null)input.close();input=null;reading=null;offset=0;done=false; }
    byte[] read(String ticket,long requested)throws Exception {
        Uri uri=uris.get(ticket);
        if(uri==null||requested<0)throw new IOException("INCOMING_INVALID_TRANSFER");
        if(!ticket.equals(reading)){
            if(requested!=0||reading!=null&&!done)throw new IOException("INCOMING_INVALID_TRANSFER");
            rewind();reading=ticket;input=resolver.openInputStream(uri);
            if(input==null)throw new IOException("INCOMING_UNAVAILABLE");
        }
        if(done||requested!=offset)throw new IOException("INCOMING_INVALID_TRANSFER");
        ByteArrayOutputStream out=new ByteArrayOutputStream(FolderImport.CHUNK);byte[] buffer=new byte[8192];
        while(out.size()<FolderImport.CHUNK){
            int n=input.read(buffer,0,Math.min(buffer.length,FolderImport.CHUNK-out.size()));
            if(n<0){done=true;input.close();input=null;break;}
            if(n==0)throw new IOException("INCOMING_READ_INTERRUPTED");out.write(buffer,0,n);
        }
        offset+=out.size();return out.toByteArray();
    }
    boolean done(){return done;}
    @Override public void close(){try{rewind();}catch(IOException ignored){}uris.clear();}
}
