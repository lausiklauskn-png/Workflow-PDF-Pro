package de.familyprojekt.workflowpdf.pro;

import java.util.*;
import java.util.concurrent.*;
import org.junit.Test;
import static org.junit.Assert.*;

public final class PluginWorkerTest {
    @Test public void acceptedWorkDrainsBeforeCleanupAndLateCallsCannotRunOrCrash()throws Exception{
        PluginWorker worker=new PluginWorker();List<String> order=Collections.synchronizedList(new ArrayList<>());CountDownLatch release=new CountDownLatch(1);
        worker.submit(null,()->{try{release.await(2,TimeUnit.SECONDS);}catch(InterruptedException e){throw new AssertionError(e);}order.add("write");});
        CompletableFuture<Void> finished=worker.close(()->order.add("close"));assertFalse(worker.submit(null,()->order.add("late")));assertSame(finished,worker.close(()->order.add("twice")));
        release.countDown();finished.get(3,TimeUnit.SECONDS);assertEquals(Arrays.asList("write","close"),order);
    }
    @Test public void replacementActivityReadsOnlyAfterOldAcceptedWritesAndCleanup()throws Exception{
        PluginWorker old=new PluginWorker("test-recreation"),next=new PluginWorker("test-recreation");List<String> order=Collections.synchronizedList(new ArrayList<>());CountDownLatch release=new CountDownLatch(1);
        old.submit(null,()->{try{release.await(2,TimeUnit.SECONDS);}catch(InterruptedException e){throw new AssertionError(e);}order.add("write");});
        old.close(()->order.add("old-close"));next.submit(null,()->order.add("read"));CompletableFuture<Void> done=next.close(()->order.add("new-close"));release.countDown();done.get(3,TimeUnit.SECONDS);
        assertEquals(Arrays.asList("write","old-close","read","new-close"),order);
    }
}
