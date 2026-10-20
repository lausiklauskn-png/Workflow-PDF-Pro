package de.familyprojekt.workflowpdf.pro;

import android.database.*;
import android.os.*;
import android.provider.DocumentsContract.Document;
import android.provider.DocumentsProvider;
import java.io.*;

/** Debug-only, app-private SAF provider for deterministic native file tests. */
public class FixtureDocuments extends DocumentsProvider {
    private File root;private boolean broken;
    @Override public boolean onCreate(){root=new File(getContext().getCacheDir(),"fixture-documents");root.mkdirs();return true;}
    private File file(String id)throws FileNotFoundException{try{File f=new File(root,id).getCanonicalFile();if(!f.getPath().startsWith(root.getCanonicalPath()+File.separator))throw new IOException();return f;}catch(Exception error){throw new FileNotFoundException();}}
    private static final String[] DEFAULT={Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,Document.COLUMN_MIME_TYPE,Document.COLUMN_SIZE,Document.COLUMN_FLAGS};
    private void row(MatrixCursor c,String id)throws FileNotFoundException{
        File f=file(id);if(!f.exists())throw new FileNotFoundException();MatrixCursor.RowBuilder row=c.newRow();
        for(String col:c.getColumnNames())switch(col){case Document.COLUMN_DOCUMENT_ID:row.add(id);break;case Document.COLUMN_DISPLAY_NAME:row.add(f.getName());break;case Document.COLUMN_MIME_TYPE:row.add(f.isDirectory()?Document.MIME_TYPE_DIR:"text/plain");break;case Document.COLUMN_SIZE:row.add(f.length());break;case Document.COLUMN_FLAGS:row.add(f.isDirectory()?Document.FLAG_DIR_SUPPORTS_CREATE:Document.FLAG_SUPPORTS_WRITE|Document.FLAG_SUPPORTS_DELETE);break;default:row.add(null);}
    }
    @Override public Cursor queryRoots(String[] projection){return new MatrixCursor(projection==null?new String[]{"root_id"}:projection);}
    @Override public Cursor queryDocument(String id,String[] projection)throws FileNotFoundException{MatrixCursor c=new MatrixCursor(projection==null?DEFAULT:projection);row(c,id);return c;}
    @Override public Cursor queryChildDocuments(String parent,String[] projection,String sort)throws FileNotFoundException{MatrixCursor c=new MatrixCursor(projection==null?DEFAULT:projection);File[] list=file(parent).listFiles();if(list==null)throw new FileNotFoundException();for(File f:list)row(c,parent+"/"+f.getName());return c;}
    @Override public ParcelFileDescriptor openDocument(String id,String mode,CancellationSignal signal)throws FileNotFoundException{return ParcelFileDescriptor.open(file(id),ParcelFileDescriptor.parseMode(mode));}
    @Override public String createDocument(String parent,String mime,String name)throws FileNotFoundException{if(broken||name.contains("/")||name.contains("\\"))throw new FileNotFoundException();String id=parent+"/"+name;File f=file(id);try{if(Document.MIME_TYPE_DIR.equals(mime)?!f.mkdir():!f.createNewFile())throw new IOException();}catch(Exception error){throw new FileNotFoundException();}return id;}
    @Override public void deleteDocument(String id)throws FileNotFoundException{if(!file(id).delete())throw new FileNotFoundException();}
    @Override public boolean isChildDocument(String parent,String child){return child.startsWith(parent+"/");}
    private void clear(File f){File[] children=f.listFiles();if(children!=null)for(File child:children)clear(child);f.delete();}
    @Override public Bundle call(String method,String arg,Bundle extras){
        if(method.equals("fixture-reset")){
            clear(root);root.mkdirs();broken=false;
            try{for(String dir:new String[]{"sourceA","sourceB","libraryA","libraryB","vaultA"})new File(root,dir).mkdirs();
                try(FileOutputStream output=new FileOutputStream(new File(root,"sourceA/one.txt"))){byte[] bytes=new byte[300000];for(int i=0;i<bytes.length;i++)bytes[i]=(byte)(i%251);output.write(bytes);}
                try(FileOutputStream output=new FileOutputStream(new File(root,"sourceB/two.txt"))){output.write("second folder".getBytes(java.nio.charset.StandardCharsets.UTF_8));}
            }catch(Exception error){throw new IllegalStateException(error);}return Bundle.EMPTY;
        }
        if(method.equals("fixture-broken")){broken=true;return Bundle.EMPTY;}
        return super.call(method,arg,extras);
    }
}
