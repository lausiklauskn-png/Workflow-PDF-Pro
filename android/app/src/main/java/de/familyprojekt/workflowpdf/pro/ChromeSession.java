package de.familyprojekt.workflowpdf.pro;

import android.content.Context;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;
import org.json.*;

/** Loopback-only transport for already-cleaned paragraph arrays. No PDFs, IDs,
 * credentials or database records enter the browser. A session never restarts. */
final class ChromeSession implements AutoCloseable {
    static final int MAX_BODY=16*1024*1024;
    final String id=UUID.randomUUID().toString(),from,to,language;
    private final Context context;
    private final byte[] secret=new byte[32];
    Consumer<String> onStopped;
    private final ScheduledExecutorService expiry=Executors.newSingleThreadScheduledExecutor();
    private ScheduledFuture<?> deadline;
    private final ExecutorService workers=new ThreadPoolExecutor(0,8,30,TimeUnit.SECONDS,new SynchronousQueue<>(),r->{Thread t=new Thread(r,"workflow-chrome-http");t.setDaemon(true);return t;});
    private final Set<Socket> sockets=ConcurrentHashMap.newKeySet();
    private final Map<String,byte[]> assets=new HashMap<>();
    private ServerSocket server;
    private String origin;
    private boolean closed;
    private long sequence;
    private Pending pending;
    private static final class Pending { long id;JSONArray texts;CompletableFuture<JSONObject> result=new CompletableFuture<>(); }
    ChromeSession(Context context,String from,String to,String language,Consumer<String> stopped)throws Exception{
        if(!Arrays.asList("de","en","ru").contains(from)||!Arrays.asList("de","en","ru").contains(to)||from.equals(to))throw new IOException("CHROME_LANGUAGE_PAIR");
        this.context=context.getApplicationContext();this.from=from;this.to=to;this.language=language;this.onStopped=stopped;
        new SecureRandom().nextBytes(secret);touch();
    }
    private synchronized void touch(){if(deadline!=null)deadline.cancel(false);deadline=expiry.schedule(()->stop("CHROME_EXPIRED"),30,TimeUnit.MINUTES);}
    synchronized boolean closed(){return closed;}
    synchronized String browserUrl(){if(closed||origin==null)throw new IllegalStateException("CHROME_NOT_READY");return origin+"/#"+VaultCrypto.hex(secret);}
    private byte[] asset(String path)throws IOException{
        try(InputStream in=context.getAssets().open(path);ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] bytes=new byte[8192];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);return out.toByteArray();
        }
    }
    private synchronized void listen()throws Exception{
        if(server!=null)return;
        assets.put("/",asset("public/native/chrome/helper.html"));assets.put("/helper.js",asset("public/native/chrome/helper.js"));assets.put("/uebersetzung.js",asset("public/assets/uebersetzung.js"));
        server=new ServerSocket(0,8,InetAddress.getByName("127.0.0.1"));origin="http://127.0.0.1:"+server.getLocalPort();
        Thread accept=new Thread(()->{
            try{while(!server.isClosed()){
                Socket socket=server.accept();socket.setSoTimeout(10000);sockets.add(socket);
                try{workers.execute(()->serve(socket));}catch(RejectedExecutionException busy){sockets.remove(socket);socket.close();}
            }}catch(IOException ignored){/* Closure revokes the endpoint. */}
        },"workflow-chrome-loopback");accept.setDaemon(true);accept.start();
    }
    synchronized CompletableFuture<JSONObject> offer(JSONArray texts)throws Exception{
        if(closed)throw new IOException("CHROME_CANCELLED");if(pending!=null)throw new IOException("CHROME_BUSY");
        for(int i=0;i<texts.length();i++)if(!(texts.get(i) instanceof String))throw new IOException("CHROME_INVALID_TEXT");
        if(texts.toString().getBytes(StandardCharsets.UTF_8).length>MAX_BODY)throw new IOException("CHROME_PACKET_TOO_LARGE");
        listen();Pending next=new Pending();next.id=++sequence;next.texts=new JSONArray(texts.toString());pending=next;touch();return next.result;
    }
    private synchronized JSONObject packet()throws JSONException{
        if(pending==null)return new JSONObject().put("waiting",true);
        return new JSONObject().put("id",pending.id).put("von",from).put("nach",to).put("uiLang",language).put("texte",pending.texts);
    }
    private synchronized int result(JSONObject body)throws Exception{
        if(pending==null||body.optLong("id",-1)!=pending.id)return 409;
        if(body.has("error")){Pending old=pending;pending=null;old.result.completeExceptionally(new IOException("CHROME_TRANSLATION_FAILED"));return 200;}
        JSONArray texts=body.optJSONArray("texte");if(texts==null||texts.length()!=pending.texts.length())return 422;
        for(int i=0;i<texts.length();i++)if(!(texts.get(i) instanceof String))return 422;
        JSONObject stats=body.optJSONObject("stat"),clean=new JSONObject();if(stats==null)return 422;
        for(String key:new String[]{"ohne","zeichen","anfragen"}){
            Object raw=stats.opt(key);if(!(raw instanceof Number))return 422;
            Number number=(Number)raw;long value=number.longValue();if(value<0||value>9007199254740991L||number.doubleValue()!=value)return 422;clean.put(key,value);
        }
        Pending old=pending;pending=null;touch();old.result.complete(new JSONObject().put("texte",texts).put("stat",clean));return 200;
    }
    private static String line(InputStream in,int[] budget)throws IOException{
        ByteArrayOutputStream out=new ByteArrayOutputStream();int b;
        while((b=in.read())!=-1){if(--budget[0]<0)throw new IOException();if(b=='\n')break;if(b!='\r')out.write(b);}
        if(b<0&&out.size()==0)return null;return out.toString("US-ASCII");
    }
    private synchronized boolean authorized(String header){
        if(closed||header==null)return false;
        byte[] expected=("Bearer "+VaultCrypto.hex(secret)).getBytes(StandardCharsets.US_ASCII),actual=header.getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(expected,actual);
    }
    private void reply(OutputStream out,int status,String mime,byte[] bytes)throws IOException{
        String headers="HTTP/1.1 "+status+" Response\r\nContent-Type: "+mime+"\r\nContent-Length: "+bytes.length+"\r\nConnection: close\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\nX-Frame-Options: DENY\r\nContent-Security-Policy: default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'\r\n\r\n";
        out.write(headers.getBytes(StandardCharsets.US_ASCII));out.write(bytes);out.flush();
    }
    private void json(OutputStream out,int code,JSONObject body)throws IOException{reply(out,code,"application/json; charset=utf-8",body.toString().getBytes(StandardCharsets.UTF_8));}
    private void error(OutputStream out,int code,String reason)throws Exception{json(out,code,new JSONObject().put("error",reason));}
    private void serve(Socket socket){
        boolean cancel=false;
        try(Socket connection=socket;InputStream in=new BufferedInputStream(socket.getInputStream());OutputStream out=socket.getOutputStream()){
            int[] budget={8192};String first=line(in,budget);if(first==null)return;String[] start=first.split(" ");if(start.length!=3){error(out,400,"invalid-request");return;}
            Map<String,String> headers=new HashMap<>();String header;
            while((header=line(in,budget))!=null&&!header.isEmpty()){
                int colon=header.indexOf(':');if(colon<=0)throw new IOException();String key=header.substring(0,colon).toLowerCase(Locale.ROOT);
                if(headers.put(key,header.substring(colon+1).trim())!=null)throw new IOException();
            }
            String own; synchronized(this){own=origin;}
            if(!socket.getInetAddress().isLoopbackAddress()||!URI.create(own).getAuthority().equals(headers.get("host"))){error(out,403,"host-rejected");return;}
            if(headers.containsKey("origin")&&!own.equals(headers.get("origin"))){error(out,403,"origin-rejected");return;}
            String method=start[0],path=start[1];if("OPTIONS".equals(method)){error(out,403,"cross-origin-disabled");return;}
            byte[] publicAsset=assets.get(path);
            if("GET".equals(method)&&publicAsset!=null){reply(out,200,path.endsWith(".js")?"text/javascript; charset=utf-8":"text/html; charset=utf-8",publicAsset);return;}
            if(!authorized(headers.get("authorization"))){error(out,401,"session-required");return;}
            if("GET".equals(method)&&"/batch".equals(path)){json(out,200,packet());return;}
            if(!"POST".equals(method)||!Arrays.asList("/result","/cancel").contains(path)){error(out,404,"route-not-found");return;}
            if(!own.equals(headers.get("origin"))){error(out,403,"origin-required");return;}
            if(!"application/json".equals(headers.get("content-type"))||headers.containsKey("transfer-encoding")){error(out,415,"json-required");return;}
            int length;try{length=Integer.parseInt(headers.getOrDefault("content-length","-1"));}catch(NumberFormatException bad){length=-1;}
            if(length<0){error(out,411,"length-required");return;}if(length>MAX_BODY){error(out,413,"packet-too-large");return;}
            byte[] body=new byte[length];int offset=0;while(offset<length){int n=in.read(body,offset,length-offset);if(n<1)throw new IOException();offset+=n;}
            JSONObject data=new JSONObject(new String(body,StandardCharsets.UTF_8));
            if("/cancel".equals(path)){json(out,200,new JSONObject().put("cancelled",true));cancel=true;}
            else{int status=result(data);json(out,status,new JSONObject().put("accepted",status==200));}
        }catch(Exception ignored){/* Malformed/closed peers never receive document text or exception details. */}
        finally{sockets.remove(socket);if(cancel)stop("CHROME_CANCELLED");}
    }
    void stop(String reason){
        Pending old;
        synchronized(this){if(closed)return;closed=true;Arrays.fill(secret,(byte)0);old=pending;pending=null;if(deadline!=null)deadline.cancel(false);try{if(server!=null)server.close();}catch(IOException ignored){}}
        for(Socket socket:sockets)try{socket.close();}catch(IOException ignored){}sockets.clear();workers.shutdownNow();expiry.shutdownNow();
        if(old!=null)old.result.completeExceptionally(new IOException(reason));onStopped.accept(reason);
    }
    @Override public void close(){stop("CHROME_CANCELLED");}
}
