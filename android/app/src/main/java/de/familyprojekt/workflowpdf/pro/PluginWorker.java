package de.familyprojekt.workflowpdf.pro;

import com.getcapacitor.PluginCall;
import java.util.concurrent.*;

/** Serial plugin work with an atomic lifecycle boundary. Capacitor may deliver
 * queued reflection calls after Activity destruction; never crash or report a
 * successful operation when its worker has already drained and closed. */
final class PluginWorker {
    private static final ConcurrentHashMap<String,ExecutorService> DOMAINS=new ConcurrentHashMap<>();
    private final ExecutorService executor;
    private final boolean shared;
    private boolean closed;
    private final CompletableFuture<Void> finished=new CompletableFuture<>();
    PluginWorker(){executor=Executors.newSingleThreadExecutor();shared=false;}
    PluginWorker(String domain){
        shared=true;executor=DOMAINS.computeIfAbsent(domain,name->Executors.newSingleThreadExecutor(task->{Thread thread=new Thread(task,"workflow-"+name);thread.setDaemon(true);return thread;}));
    }
    synchronized boolean submit(PluginCall call,Runnable task){
        if(closed){if(call!=null)call.reject("NATIVE_ACTIVITY_CLOSED");return false;}
        executor.execute(task);return true;
    }
    void execute(Runnable task){submit(null,task);}
    synchronized boolean closed(){return closed;}
    synchronized CompletableFuture<Void> close(Runnable cleanup){
        if(closed)return finished;closed=true;
        executor.execute(()->{try{cleanup.run();finished.complete(null);}catch(Throwable error){finished.completeExceptionally(error);}});
        if(!shared)executor.shutdown();return finished;
    }
}
