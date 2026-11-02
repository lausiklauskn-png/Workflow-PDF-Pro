package de.familyprojekt.workflowpdf.pro;

import de.familyprojekt.tresor.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Wirkliche verschlüsselte Dateien und frische Engine-Instanzen. Host-Dialog/DPAPI hier
 * ausdrücklich gestellt; deren Windows-Nachweis folgt in der installierten WebView2-App. */
public final class ProVerbundProbe {
    public static final String PASSWORD="Erfundene Pro-Probe ä 2026";
    public static final byte[] BYTES="Erfundener Pro-Verbund-Brief 2026\n".getBytes(StandardCharsets.UTF_8);
    private static int checks;
    static void check(boolean ok,String title){if(!ok)throw new AssertionError(title);checks++;System.out.println("PASS "+title);}
    interface Work{void run()throws Exception;}
    static void rejects(String code,Work work)throws Exception {
        try{work.run();throw new AssertionError("accepted "+code);}catch(IOException expected){check(code.equals(expected.getMessage()),"reject "+code);}
    }
    static Map<String,Object> m(Object... values){Map<String,Object> out=new LinkedHashMap<>();for(int i=0;i<values.length;i+=2)out.put((String)values[i],values[i+1]);return out;}
    static class Fixture implements ProTresorEngine.Host {
        Path folder;boolean remember=true,cancel;int passwords;String firstPassword;
        final Map<String,String> protectedKeys=new HashMap<>();
        Fixture(Path folder){this.folder=folder;}
        public Map<String,Object> call(String method,Map<String,Object> args)throws IOException {
            switch(method){
                case "folder": return cancel?m("cancelled",true):m("path",folder.toString());
                case "password": passwords++;return m("password",passwords==1&&firstPassword!=null?firstPassword:PASSWORD,"remember",remember);
                case "passwordResult": return m();
                case "protect": {
                    String token=UUID.randomUUID().toString();protectedKeys.put(token,args.get("binding")+":"+args.get("data"));return m("data",token);
                }
                case "unprotect": {
                    String value=protectedKeys.get(args.get("data")),prefix=args.get("binding")+":";
                    if(value==null||!value.startsWith(prefix))throw new IOException("TRESOR_GESPERRT");return m("data",value.substring(prefix.length()));
                }
                default: throw new IOException("TRESOR_ENGINE_HOST");
            }
        }
    }
    static Map<String,Object> request(String id,String action,Object... extra) {
        Map<String,Object> out=m("aktion",action,"vaultId",id);out.putAll(m(extra));return out;
    }
    public static void main(String[] args)throws Exception {
        if(args.length==3&&args[0].equals("ui-seed")){uiSeed(Path.of(args[1]),Path.of(args[2]));return;}
        if(args.length==3&&args[0].equals("ui-confirm")){uiConfirm(Path.of(args[1]),Path.of(args[2]));return;}
        if(args.length==2&&args[0].equals("seed")){seed(Path.of(args[1]));return;}
        if(args.length==2&&args[0].equals("confirm")){confirm(Path.of(args[1]));return;}
        Path root=Files.createTempDirectory("wfp-common-probe-");
        try {
            Path folder=Files.createDirectory(root.resolve("Gemeinsamer Tresor Ж")),config=root.resolve("state/connection.json");
            Fixture host=new Fixture(folder);host.firstPassword="falsches Kennwort";
            try(TresorOrdner family=TresorOrdner.anlegen(new DateiAblage(folder.toFile()),Fach.FAMILIENAKTE_APP,PASSWORD)) {
                String id=family.id();Uebergaben sender=new Uebergaben(family);
                Eintrag sent=sender.senden(Fach.WORKFLOW_PDF_APP,"family-17","doc-17","","Probe.txt","text/plain",new ByteArrayInputStream(BYTES));
                Map<String,Object> read=request(id,"lesen","entryId",sent.id);
                try(ProTresorEngine engine=new ProTresorEngine(config,host)) {
                    check(Boolean.FALSE.equals(engine.call("tresorZustand",m()).get("gewaehlt"))&&!Files.exists(config),"status creates no connection");
                    Map<String,Object> state=engine.call("tresorVerbinden",m());
                    check(Boolean.TRUE.equals(state.get("offen"))&&Boolean.FALSE.equals(state.get("eingezogen")),"connect without own document vault");
                    check(host.passwords==2,"wrong password can retry");
                    check(!Files.readString(config).contains(PASSWORD),"configuration contains no password");
                    check(((List<?>)engine.call("tresorUebergabe",request(id,"eingang")).get("items")).size()==1,"canonical sender visible");
                    Map<String,Object> result=engine.call("tresorUebergabe",read);
                    check(Arrays.equals(BYTES,Base64.getDecoder().decode((String)result.get("dataBase64"))),"native read verifies original bytes");
                    check(!sender.bestaetigt(Fach.WORKFLOW_PDF_APP,sent.id),"read is not acceptance");
                    rejects("TRESOR_UEBERGABE_FREMD",()->engine.call("tresorUebergabe",request("other-root","lesen","entryId",sent.id)));
                    rejects("TRESOR_UEBERGABE_PRUEFSUMME",()->engine.call("tresorUebergabe",request(id,"quittieren","entryId",sent.id,"sha256","0".repeat(64))));
                    check(!sender.bestaetigt(Fach.WORKFLOW_PDF_APP,sent.id),"invalid receipt never marks");
                    engine.call("tresorSperren",m());check(Boolean.FALSE.equals(engine.call("tresorZustand",m()).get("offen")),"manual lock defeats remembered key");
                    rejects("TRESOR_GESPERRT",()->engine.call("tresorUebergabe",read));
                }
                try(ProTresorEngine restarted=new ProTresorEngine(config,host)) {
                    check(Boolean.TRUE.equals(restarted.call("tresorZustand",m()).get("offen"))&&host.passwords==2,"fresh instance restores remembered key without dialog");
                    Map<String,Object> ack=request(id,"quittieren","entryId",sent.id,"sha256",sent.sha256);
                    restarted.call("tresorUebergabe",ack);restarted.call("tresorUebergabe",ack);
                    check(sender.bestaetigt(Fach.WORKFLOW_PDF_APP,sent.id),"explicit repeated receipt visible to sender");
                    check(family.verzeichnis(Fach.EINGANG_WORKFLOW_PDF.slug).size()==1,"receipt keeps source original");
                    Map<String,Object> contract=m("vertrag",Uebergaben.VERTRAG,"quelle",Fach.WORKFLOW_PDF_APP,"ziel",Fach.FAMILIENAKTE_APP,"id","workflow-back-17","dokumentId","workflow-doc-17","bezug","family-17","name","Antwort.txt","mime","text/plain","groesse",(long)BYTES.length,"sha256",sent.sha256);
                    Map<String,Object> send=request(id,"senden","vertrag",contract,"dataBase64",Base64.getEncoder().encodeToString(BYTES));
                    String back=(String)restarted.call("tresorUebergabe",send).get("id");
                    check(back.equals(restarted.call("tresorUebergabe",send).get("id")),"repeat sends stable entry");
                    check(Arrays.equals(BYTES,sender.lesen(back))&&"family-17".equals(sender.beschreibung(back).get("bezug")),"return preserves source reference and bytes");
                    Map<String,Object> status=request(id,"stand","ziel",Fach.FAMILIENAKTE_APP,"entryId",back);
                    check(Boolean.FALSE.equals(restarted.call("tresorUebergabe",status).get("bestaetigt")),"outbound delivery remains unconfirmed");
                    sender.quittieren(back,sent.sha256);check(Boolean.TRUE.equals(restarted.call("tresorUebergabe",status).get("bestaetigt")),"actual receiver mark confirms");
                    contract.put("sha256","0".repeat(64));rejects("TRESOR_UEBERGABE_PRUEFSUMME",()->restarted.call("tresorUebergabe",send));contract.put("sha256",sent.sha256);
                    contract.put("ziel",Fach.WORKFLOW_PDF_APP);rejects("TRESOR_UEBERGABE_VERTRAG",()->restarted.call("tresorUebergabe",send));contract.put("ziel",Fach.FAMILIENAKTE_APP);
                    contract.put("groesse",(long)Uebergaben.MAX_BYTES+1);rejects("TRESOR_UEBERGABE_ZU_GROSS",()->restarted.call("tresorUebergabe",send));contract.put("groesse",(long)BYTES.length);
                    contract.put("name","Andere Antwort.txt");rejects("TRESOR_UEBERGABE_KONFLIKT",()->restarted.call("tresorUebergabe",send));
                    Path moved=root.resolve("removed");Files.move(folder,moved);
                    check(Boolean.FALSE.equals(restarted.call("tresorZustand",m()).get("erreichbar"))&&!Files.exists(folder),"removed storage is not replaced");
                    Files.createDirectory(folder);
                    try(TresorOrdner other=TresorOrdner.anlegen(new DateiAblage(folder.toFile()),Fach.FAMILIENAKTE_APP,PASSWORD)) {
                        rejects("TRESOR_FREMDE_KENNUNG",()->restarted.call("tresorUebergabe",read));
                        check(Boolean.FALSE.equals(restarted.call("tresorZustand",m()).get("offen")),"same path with foreign root stays locked");
                    }
                    delete(folder);Files.move(moved,folder);
                    restarted.call("tresorSperren",m("vergessen",true));
                }
                try(ProTresorEngine forgotten=new ProTresorEngine(config,host)) {
                    check(Boolean.FALSE.equals(forgotten.call("tresorZustand",m()).get("offen")),"forget persists across restart");
                    host.remember=false;forgotten.call("tresorVerbinden",m());
                    check(Boolean.FALSE.equals(forgotten.call("tresorZustand",m()).get("gemerkt")),"unchecked remember removes device key");
                }
                Files.writeString(config,"beschaedigte Konfiguration");
                try(ProTresorEngine corrupt=new ProTresorEngine(config,host)) {
                    check("TRESOR_ZUSTAND_BESCHAEDIGT".equals(corrupt.call("tresorZustand",m()).get("problem")),"corrupt config visible");
                    corrupt.call("tresorVerbinden",m());
                    try(var files=Files.list(config.getParent())){check(files.anyMatch(p->p.getFileName().toString().contains(".beschaedigt-")),"reconnect preserves corrupt config");}
                }
            }
            System.out.println("Pro-Verbund: "+checks+" checks passed");
        } finally {delete(root);}
    }
    public static void delete(Path p)throws IOException {if(!Files.exists(p))return;try(var files=Files.walk(p)){for(Path f:files.sorted(Comparator.reverseOrder()).toList())Files.delete(f);}}
    private static void seed(Path root)throws Exception {
        Files.createDirectories(root);
        try(TresorOrdner family=TresorOrdner.anlegen(new DateiAblage(root.toFile()),Fach.FAMILIENAKTE_APP,PASSWORD)) {
            Eintrag e=new Uebergaben(family).senden(Fach.WORKFLOW_PDF_APP,"windows-family-17","doc-17","","Probe.txt","text/plain",new ByteArrayInputStream(BYTES));
            System.out.println(Json.schreiben(m("vaultId",family.id(),"entryId",e.id,"sha256",e.sha256,"size",e.groesse)));
        }
    }
    private static void confirm(Path root)throws Exception {
        try(TresorOrdner family=TresorOrdner.oeffnen(new DateiAblage(root.toFile()),Fach.FAMILIENAKTE_APP,PASSWORD)) {
            Uebergaben inbox=new Uebergaben(family);List<Map<String,Object>> pending=inbox.offen();
            if(pending.size()!=1)throw new AssertionError("expected one returned document");
            String entry=(String)pending.get(0).get("entryId");
            if(!Arrays.equals(BYTES,inbox.lesen(entry)))throw new AssertionError("returned bytes changed");
            if(!"windows-family-17".equals(inbox.beschreibung(entry).get("bezug")))throw new AssertionError("source relation lost");
            inbox.quittieren(entry,ProVerbund.sha(BYTES));
            System.out.println(Json.schreiben(m("confirmed",true,"entryId",entry)));
        }
    }
    private static void uiSeed(Path root,Path file)throws Exception {
        try(TresorOrdner family=TresorOrdner.oeffnen(new DateiAblage(root.toFile()),Fach.FAMILIENAKTE_APP,PASSWORD)) {
            Eintrag e=new Uebergaben(family).senden(Fach.WORKFLOW_PDF_APP,"windows-family-ui","family-doc-ui","","Pro-Verbund UI.pdf","application/pdf",Files.newInputStream(file));
            System.out.println(Json.schreiben(m("vaultId",family.id(),"entryId",e.id,"sha256",e.sha256,"size",e.groesse)));
        }
    }
    private static void uiConfirm(Path root,Path output)throws Exception {
        try(TresorOrdner family=TresorOrdner.oeffnen(new DateiAblage(root.toFile()),Fach.FAMILIENAKTE_APP,PASSWORD)) {
            Uebergaben inbox=new Uebergaben(family);List<Map<String,Object>> pending=inbox.offen();
            if(pending.size()!=1)throw new AssertionError("expected one ordinary Workflow output");
            String entry=(String)pending.get(0).get("entryId");Map<String,Object> contract=inbox.beschreibung(entry);
            if(!"windows-family-ui".equals(contract.get("bezug"))||!"family-doc-ui".equals(contract.get("dokumentId")))throw new AssertionError("ordinary output source lost");
            byte[] bytes=inbox.lesen(entry);Files.write(output,bytes);
            if(!Arrays.equals(bytes,Files.readAllBytes(output)))throw new AssertionError("fixture output not persisted");
            inbox.quittieren(entry,ProVerbund.sha(bytes));
            boolean accepted=false;
            for(Eintrag e:family.eigenesVerzeichnis(Fach.EINGANG_WORKFLOW_PDF.slug))
                if(e.verweis.startsWith("Uebergaben/windows-family-ui/"))accepted=inbox.bestaetigt(Fach.WORKFLOW_PDF_APP,e.id);
            System.out.println(Json.schreiben(m("confirmed",true,"workflowAccepted",accepted,"entryId",entry,"sha256",ProVerbund.sha(bytes))));
        }
    }
}
