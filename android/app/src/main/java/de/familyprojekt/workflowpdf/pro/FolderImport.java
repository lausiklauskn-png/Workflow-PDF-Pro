package de.familyprojekt.workflowpdf.pro;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import java.io.*;
import java.util.*;
import org.json.*;

/** One user-selected tree, read-only. Opaque tickets never accept caller-supplied URIs. */
final class FolderImport implements AutoCloseable {
    static final int CHUNK = 262144;
    private final ContentResolver resolver;
    private final Map<String, Item> items = new LinkedHashMap<>();
    private static final class Item { Uri uri; InputStream input; long offset; boolean done; }
    private static final class Directory { String id, path; Directory(String id,String path){this.id=id;this.path=path;} }
    FolderImport(ContentResolver resolver) { this.resolver=resolver; }
    JSONArray inspect(Uri tree) throws Exception {
        if(!items.isEmpty())throw new IOException("IMPORT_BUSY");
        if(tree==null||!"content".equals(tree.getScheme()))throw new SecurityException();
        String root=DocumentsContract.getTreeDocumentId(tree), name;
        try(Cursor c=resolver.query(DocumentsContract.buildDocumentUriUsingTree(tree,root),new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)){
            if(c==null||!c.moveToFirst())throw new IOException("IMPORT_FOLDER_UNAVAILABLE");
            name=ProFilesPlugin.filename(c.getString(0));
        }
        JSONArray result=new JSONArray();ArrayDeque<Directory> todo=new ArrayDeque<>();Set<String> seen=new HashSet<>();
        todo.add(new Directory(root,name));
        try {
            while(!todo.isEmpty()){
                Directory directory=todo.removeFirst();
                if(!seen.add(directory.id))throw new IOException("IMPORT_FOLDER_CYCLE");
                String[] columns={DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_DISPLAY_NAME,DocumentsContract.Document.COLUMN_MIME_TYPE};
                try(Cursor c=resolver.query(DocumentsContract.buildChildDocumentsUriUsingTree(tree,directory.id),columns,null,null,null)){
                    if(c==null)throw new IOException("IMPORT_FOLDER_UNAVAILABLE");
                    while(c.moveToNext()){
                        String id=c.getString(0),filename=ProFilesPlugin.filename(c.getString(1)),mime=c.getString(2),path=directory.path+"/"+filename;
                        if(DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)){todo.addLast(new Directory(id,path));continue;}
                        String ticket=UUID.randomUUID().toString();Item item=new Item();item.uri=DocumentsContract.buildDocumentUriUsingTree(tree,id);items.put(ticket,item);
                        result.put(new JSONObject().put("id",ticket).put("name",filename).put("path",path).put("mime",mime==null?"application/octet-stream":mime));
                    }
                }
            }
            return result;
        }catch(Exception error){close();throw error;}
    }
    byte[] read(String ticket,long offset) throws Exception {
        Item item=items.get(ticket);
        if(item==null||offset!=item.offset||item.done)throw new IOException("IMPORT_INVALID_TRANSFER");
        if(item.input==null){item.input=resolver.openInputStream(item.uri);if(item.input==null)throw new IOException("IMPORT_FILE_UNAVAILABLE");}
        ByteArrayOutputStream out=new ByteArrayOutputStream(CHUNK);byte[] buffer=new byte[8192];
        while(out.size()<CHUNK){int n=item.input.read(buffer,0,Math.min(buffer.length,CHUNK-out.size()));if(n<0){item.done=true;item.input.close();item.input=null;break;}if(n==0)throw new IOException("IMPORT_READ_INTERRUPTED");out.write(buffer,0,n);}
        item.offset+=out.size();return out.toByteArray();
    }
    boolean done(String ticket)throws IOException{Item item=items.get(ticket);if(item==null)throw new IOException("IMPORT_INVALID_TRANSFER");return item.done;}
    @Override public void close(){for(Item item:items.values())if(item.input!=null)try{item.input.close();}catch(IOException ignored){}items.clear();}
}
