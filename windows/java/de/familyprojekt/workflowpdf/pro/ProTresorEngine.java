package de.familyprojekt.workflowpdf.pro;

import de.familyprojekt.tresor.*;
import java.io.*;
import java.nio.CharBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Kanonischer Java-Tresor in einer eigenen gebündelten Laufzeit. Dialoge und DPAPI
 * liegen im Windows-Host; Austausch ausschließlich über dessen private Prozess-Pipes. */
public final class ProTresorEngine implements Closeable {
    public interface Host { Map<String,Object> call(String method,Map<String,Object> args)throws IOException; }
    private final Path config;
    private final Host host;
    private Path folder;
    private String id,remembered;
    private TresorOrdner open;
    private boolean damaged,manualLock;
    public static final int MAX_LINE=30*1024*1024;

    public ProTresorEngine(Path config,Host host)throws IOException {
        this.config=config.toAbsolutePath().normalize();this.host=host;
        if(Files.exists(this.config)) {
            try {
                if(Files.size(this.config)>256*1024)throw new IOException();
                Map<String,Object> data=Json.objekt(Files.readString(this.config));
                folder=Path.of(Json.text(data,"folder"));id=Json.text(data,"id");remembered=Json.textOder(data,"remembered","");
                if(!folder.isAbsolute()||id.isEmpty()||id.length()>160)throw new IOException();
            } catch(Exception error){damaged=true;folder=null;id=null;remembered=null;}
        } else if(Files.isDirectory(this.config.getParent())) {
            try(var files=Files.list(this.config.getParent())) {
                damaged=files.anyMatch(p->p.getFileName().toString().startsWith(this.config.getFileName()+".beschaedigt-"));
            }
        }
    }
    private DateiAblage storage(Path path,String expected)throws IOException {
        if(path==null||!Files.isDirectory(path))throw new IOException("TRESOR_ORDNER_NICHT_ERREICHBAR");
        DateiAblage a=new DateiAblage(path.toFile());
        if(!TresorOrdner.vorhanden(a))throw new IOException("TRESOR_NICHT_VORHANDEN");
        if(expected!=null&&!expected.equals(TresorOrdner.kennung(a)))throw new IOException("TRESOR_FREMDE_KENNUNG");
        if(a.gibtEs(Umzug.VERMERK))throw new IOException("TRESOR_UMGEZOGEN");
        return a;
    }
    private static String binding(String id){return "familyprojekt-tresorordner|"+id+"|geraet|"+Fach.WORKFLOW_PDF_APP;}
    private void rememberedOpen(DateiAblage a)throws IOException {
        if(open!=null||manualLock||remembered==null||remembered.isEmpty())return;
        byte[] key=null;
        try {
            String data=Json.text(host.call("unprotect",Map.of("data",remembered,"binding",binding(id))),"data");
            key=Base64.getDecoder().decode(data);
            if(key.length!=32)throw new IOException("TRESOR_GESPERRT");
            open=TresorOrdner.mitHauptschluessel(a,Fach.WORKFLOW_PDF_APP,key);
        } catch(Exception cannotOpen){close();}
        finally {if(key!=null)Arrays.fill(key,(byte)0);}
    }
    private Map<String,Object> state() {
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("gewaehlt",folder!=null||damaged);out.put("offen",false);out.put("eingezogen",false);out.put("uebergaben",true);
        out.put("gemerkt",remembered!=null&&!remembered.isEmpty());
        if(damaged){out.put("erreichbar",false);out.put("problem","TRESOR_ZUSTAND_BESCHAEDIGT");return out;}
        if(folder==null)return out;
        out.put("pfad",folder.toString());out.put("ordner",folder.getFileName()==null?folder.toString():folder.getFileName().toString());out.put("kennung",id);
        try {
            DateiAblage a=storage(folder,id);rememberedOpen(a);
            out.put("offen",open!=null);out.put("erreichbar",true);out.put("vorhanden",true);
        } catch(IOException error){close();out.put("erreichbar",false);out.put("problem",error.getMessage());}
        return out;
    }
    private void save(Path next,String nextId,String secret)throws IOException {
        Files.createDirectories(config.getParent());
        Path temp=Files.createTempFile(config.getParent(),"pro-tresor-",".tmp");
        try {
            Files.writeString(temp,Json.schreiben(Map.of("folder",next.toString(),"id",nextId,"remembered",secret)),StandardCharsets.UTF_8);
            try(FileChannel file=FileChannel.open(temp,StandardOpenOption.WRITE)){file.force(true);}
            Path backup=null;
            if(damaged&&Files.exists(config)) {
                backup=config.resolveSibling(config.getFileName()+".beschaedigt-"+UUID.randomUUID());
                Files.move(config,backup,StandardCopyOption.ATOMIC_MOVE);
            }
            try {Files.move(temp,config,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}
            catch(IOException error) {
                if(backup!=null&&!Files.exists(config))try{Files.move(backup,config,StandardCopyOption.ATOMIC_MOVE);}catch(IOException restore){error.addSuppressed(restore);}
                throw error;
            }
        } finally {Files.deleteIfExists(temp);}
    }
    private Map<String,Object> connect(Map<String,Object> args)throws IOException {
        boolean choose=folder==null||Boolean.TRUE.equals(args.get("neuWaehlen"));
        Path next=folder;
        if(choose) {
            Map<String,Object> chosen=host.call("folder",Map.of());
            if(Boolean.TRUE.equals(chosen.get("cancelled")))return Map.of("abgebrochen",true);
            next=Path.of(Json.text(chosen,"path")).toAbsolutePath().normalize();
        }
        if(damaged&&!choose)throw new IOException("TRESOR_ZUSTAND_BESCHAEDIGT");
        DateiAblage a=storage(next,choose?null:id);
        String nextId=TresorOrdner.kennung(a);
        if(!choose) {manualLock=false;rememberedOpen(a);if(open!=null)return state();}
        for(;;) {
            Map<String,Object> answer=host.call("password",Map.of("language",Json.textOder(args,"language","de")));
            if(Boolean.TRUE.equals(answer.get("cancelled")))return Map.of("abgebrochen",true);
            char[] password=Json.text(answer,"password").toCharArray();answer.remove("password");
            TresorOrdner candidate;
            try {candidate=TresorOrdner.oeffnen(storage(next,nextId),Fach.WORKFLOW_PDF_APP,CharBuffer.wrap(password));}
            catch(IOException error) {
                host.call("passwordResult",Map.of("done",false));
                if("TRESOR_PASSWORT".equals(error.getMessage())||"TRESOR_PASSWORT_FALSCH".equals(error.getMessage()))continue;
                throw error;
            } finally {Arrays.fill(password,'\0');}
            String cipher="";
            try {
                if(Boolean.TRUE.equals(answer.get("remember"))) {
                    byte[] key=candidate.hauptschluesselKopie();
                    try {cipher=Json.text(host.call("protect",Map.of("data",Base64.getEncoder().encodeToString(key),"binding",binding(nextId))),"data");}
                    finally {Arrays.fill(key,(byte)0);}
                }
                save(next,nextId,cipher);
            } catch(IOException error){candidate.close();host.call("passwordResult",Map.of("done",false));throw error;}
            close();folder=next;id=nextId;remembered=cipher;open=candidate;damaged=false;manualLock=false;
            host.call("passwordResult",Map.of("done",true));return state();
        }
    }
    private TresorOrdner opened()throws IOException {
        try {DateiAblage a=storage(folder,id);rememberedOpen(a);}
        catch(IOException error){close();throw error;}
        if(open==null)throw new IOException("TRESOR_GESPERRT");
        return open;
    }
    public synchronized Map<String,Object> call(String method,Map<String,Object> args)throws IOException {
        switch(method) {
            case "tresorZustand": return state();
            case "tresorVerbinden": return connect(args);
            case "tresorSperren":
                close();manualLock=true;
                if(Boolean.TRUE.equals(args.get("vergessen"))&&folder!=null){save(folder,id,"");remembered="";}
                return state();
            case "tresorUebergabe": return ProVerbund.call(opened(),args);
            case "tresorFach": {
                TresorOrdner vault=opened();String slug=Json.text(args,"fach");Fach.nachSlug(slug);
                List<Object> rows=new ArrayList<>();for(Eintrag e:vault.verzeichnis(slug))rows.add(e.alsMap());
                return Map.of("fach",slug,"eintraege",rows);
            }
            default: throw new IOException("TRESOR_AKTION_UNGUELTIG");
        }
    }
    @Override public void close(){if(open!=null)open.close();open=null;}
    private static String readLine(Reader in)throws IOException {
        StringBuilder out=new StringBuilder();int c;
        while((c=in.read())!=-1){if(c=='\n')return out.toString();if(out.length()>=MAX_LINE)throw new IOException("TRESOR_ENGINE_ZEILE");out.append((char)c);}
        if(out.length()!=0)throw new IOException("TRESOR_ENGINE_ZEILE");return null;
    }
    public static String errorCode(Exception error) {
        String code=error.getMessage();
        return code!=null&&code.matches("TRESOR_[A-Z_]{1,80}")?code:"TRESOR_NICHT_VERFUEGBAR";
    }
    public static void main(String[] args)throws Exception {
        if(args.length!=1)throw new IOException("TRESOR_ENGINE_CONFIG");
        try(Reader in=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.UTF_8));
            PrintWriter out=new PrintWriter(new OutputStreamWriter(System.out,StandardCharsets.UTF_8),true)) {
            Host host=(method,options)->{
                out.println(Json.schreiben(Map.of("host",method,"options",options)));
                String line=readLine(in);if(line==null)throw new IOException("TRESOR_ENGINE_PIPE");
                Map<String,Object> reply=Json.objekt(line);
                if(reply.containsKey("error"))throw new IOException("TRESOR_NICHT_VERFUEGBAR");
                return Json.objekt(Json.schreiben(reply.get("ok")));
            };
            try(ProTresorEngine engine=new ProTresorEngine(Path.of(args[0]),host)) {
                String line;
                while((line=readLine(in))!=null) {
                    try {
                        Map<String,Object> request=Json.objekt(line);
                        out.println(Json.schreiben(Map.of("ok",engine.call(Json.text(request,"method"),Json.objekt(Json.schreiben(request.get("options")))))));
                    } catch(Exception error){out.println(Json.schreiben(Map.of("error",errorCode(error))));}
                }
            }
        }
    }
}
