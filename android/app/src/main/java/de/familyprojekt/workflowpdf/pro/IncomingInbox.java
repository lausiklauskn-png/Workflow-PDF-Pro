package de.familyprojekt.workflowpdf.pro;

import android.content.*;
import android.net.Uri;
import android.util.AtomicFile;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import org.json.*;

/** App-private durable intake, separate from the library. Whole batches are
 * staged before exposure; only explicit discard removes recovery copies. */
final class IncomingInbox implements AutoCloseable {
    private final Context context;
    private final File root;
    private final ArrayList<JSONObject> entries=new ArrayList<>();
    private InputStream input;private String reading;private long offset;private boolean done;
    IncomingInbox(Context context)throws Exception{
        this.context=context.getApplicationContext();root=new File(context.getNoBackupFilesDir(),"incoming-v1");
        if(!root.isDirectory()&&!root.mkdirs())throw new IOException("INCOMING_STORAGE_UNAVAILABLE");
        File[] directories=root.listFiles();if(directories==null)throw new IOException();
        for(File directory:directories){
            try{UUID.fromString(directory.getName());}catch(Exception unowned){continue;}
            AtomicFile manifest=new AtomicFile(new File(directory,"receipt.json"));
            try(InputStream in=manifest.openRead()){
                ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] block=new byte[8192];int n;while((n=in.read(block))!=-1)out.write(block,0,n);
                JSONObject entry=new JSONObject(out.toString("UTF-8"));if(!directory.getName().equals(entry.getString("id")))throw new IOException();entries.add(entry);
            }catch(Exception damaged){
                // Keep unknown or damaged bytes. An explicit dismiss is needed.
                entries.add(new JSONObject().put("id",directory.getName()).put("at",directory.lastModified()).put("problem",true).put("ready",false));
            }
        }
        entries.sort(Comparator.comparingLong(e->e.optLong("at",0)));
    }
    private File directory(JSONObject entry)throws Exception{String id=entry.getString("id");UUID.fromString(id);return new File(root,id);}
    private void save(JSONObject entry)throws Exception{
        File dir=directory(entry);if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException();
        AtomicFile manifest=new AtomicFile(new File(dir,"receipt.json"));FileOutputStream out=null;
        try{out=manifest.startWrite();out.write(entry.toString().getBytes(StandardCharsets.UTF_8));manifest.finishWrite(out);}
        catch(Exception error){if(out!=null)manifest.failWrite(out);throw error;}
    }
    void add(String id,Intent intent)throws Exception{
        for(JSONObject entry:entries)if(id.equals(entry.getString("id")))return;
        JSONObject entry=new JSONObject().put("id",id).put("at",System.currentTimeMillis()).put("ready",false);
        try(IncomingFiles files=new IncomingFiles(context.getContentResolver(),intent)){entry.put("sources",files.sources());}
        catch(Exception invalid){entry.put("problem",true);}
        save(entry);entries.add(entry);
    }
    private void stage(JSONObject entry)throws Exception{
        if(entry.optBoolean("ready"))return;
        JSONArray sources=entry.optJSONArray("sources");if(sources==null||sources.length()==0)throw new IOException("INCOMING_UNAVAILABLE");
        JSONArray files=new JSONArray();File dir=directory(entry);
        for(int i=0;i<sources.length();i++){
            JSONObject source=sources.getJSONObject(i);Uri uri=Uri.parse(source.getString("uri"));if(!"content".equals(uri.getScheme()))throw new IOException();
            String id=source.getString("id");UUID.fromString(id);File file=new File(dir,id+".bin");MessageDigest hash=MessageDigest.getInstance("SHA-256");long size=0;
            try(InputStream in=context.getContentResolver().openInputStream(uri);FileOutputStream out=new FileOutputStream(file)){
                if(in==null)throw new IOException();byte[] bytes=new byte[65536];int count;
                while((count=in.read(bytes))!=-1){if(count==0)throw new IOException();out.write(bytes,0,count);hash.update(bytes,0,count);size+=count;}out.getFD().sync();
            }
            files.put(new JSONObject().put("id",id).put("name",source.getString("name")).put("mime",source.getString("mime")).put("size",size).put("sha256",VaultCrypto.hex(hash.digest())));
        }
        JSONObject next=new JSONObject(entry.toString()).put("files",files).put("ready",true);next.remove("sources");next.remove("problem");
        save(next);int index=entries.indexOf(entry);entries.set(index,next);
    }
    void stageReceipt(String id)throws Exception{for(JSONObject entry:entries)if(entry.getString("id").equals(id)){stage(entry);return;}throw new IOException();}
    private JSONObject first(){for(JSONObject entry:entries)if(!entry.optBoolean("archived"))return entry;return null;}
    JSONObject pending()throws Exception{
        rewind();JSONObject entry=first();if(entry==null)return new JSONObject().put("empty",true);
        try{stage(entry);entry=first();return new JSONObject().put("id",entry.getString("id")).put("files",entry.getJSONArray("files"));}
        catch(Exception error){return new JSONObject().put("id",entry.getString("id")).put("problem",true);}
    }
    byte[] read(String batch,String id,long requested)throws Exception{
        JSONObject entry=first();if(entry==null||!entry.getString("id").equals(batch)||!entry.optBoolean("ready"))throw new IOException();
        JSONObject item=null;JSONArray files=entry.getJSONArray("files");for(int i=0;i<files.length();i++)if(files.getJSONObject(i).getString("id").equals(id))item=files.getJSONObject(i);
        if(item==null)throw new IOException();String ticket=batch+":"+id;
        if(!ticket.equals(reading)){
            if(requested!=0||reading!=null&&!done)throw new IOException();rewind();
            File file=new File(directory(entry),id+".bin");if(file.length()!=item.getLong("size"))throw new IOException();
            MessageDigest hash=MessageDigest.getInstance("SHA-256");try(InputStream verify=new FileInputStream(file)){byte[] block=new byte[65536];int n;while((n=verify.read(block))!=-1)hash.update(block,0,n);}
            if(!VaultCrypto.hex(hash.digest()).equals(item.getString("sha256")))throw new IOException();
            input=new FileInputStream(file);reading=ticket;
        }
        if(done||requested!=offset)throw new IOException();ByteArrayOutputStream out=new ByteArrayOutputStream(FolderImport.CHUNK);byte[] bytes=new byte[8192];
        while(out.size()<FolderImport.CHUNK){int n=input.read(bytes,0,Math.min(bytes.length,FolderImport.CHUNK-out.size()));if(n<0){input.close();input=null;done=true;break;}if(n==0)throw new IOException();out.write(bytes,0,n);}
        offset+=out.size();return out.toByteArray();
    }
    boolean done(){return done;}
    void acknowledge(String id,boolean discard)throws Exception{
        JSONObject entry=first();if(entry==null||!entry.getString("id").equals(id))throw new IOException();rewind();
        if(discard){remove(entry);return;}
        JSONObject archived=new JSONObject(entry.toString()).put("archived",true);save(archived);entries.set(entries.indexOf(entry),archived);
    }
    JSONArray history()throws Exception{JSONArray out=new JSONArray();for(JSONObject entry:entries)if(entry.optBoolean("archived"))out.put(new JSONObject().put("id",entry.getString("id")).put("at",entry.optLong("at")).put("files",entry.optJSONArray("files")));return out;}
    void restore(String id)throws Exception{for(JSONObject entry:entries)if(entry.getString("id").equals(id)&&entry.optBoolean("archived")){entry.put("archived",false);save(entry);return;}throw new IOException();}
    void discardArchived(String id)throws Exception{for(JSONObject entry:entries)if(entry.getString("id").equals(id)&&entry.optBoolean("archived")){remove(entry);return;}throw new IOException();}
    private void remove(JSONObject entry)throws Exception{
        File dir=directory(entry);File[] children=dir.listFiles();if(children==null)throw new IOException();for(File file:children)if(!file.delete())throw new IOException();if(!dir.delete())throw new IOException();entries.remove(entry);
    }
    private void rewind()throws IOException{if(input!=null)input.close();input=null;reading=null;offset=0;done=false;}
    @Override public void close(){try{rewind();}catch(IOException ignored){}}
}
