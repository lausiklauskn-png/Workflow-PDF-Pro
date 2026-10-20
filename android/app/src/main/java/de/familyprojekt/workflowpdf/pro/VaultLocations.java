package de.familyprojekt.workflowpdf.pro;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.IOException;
import java.util.*;
import org.json.*;

/** Device-local folder grants are independent of the portable encrypted format.
 * No selected folder means the original internal database remains the store.
 * Changing the primary never erases the grants needed by older document refs.
 * All operations run on WorkflowVault's single worker. */
final class VaultLocations {
    private final Context context;
    private final SharedPreferences prefs;
    private final String namespace, alias;
    private final Map<String, DocumentVault> locations = new HashMap<>();
    VaultLocations(Context context) { this(context,"workflow-vault-locations-v1",DocumentVault.DEVICE_ALIAS); }
    VaultLocations(Context context,String namespace,String alias) {
        this.context=context.getApplicationContext();this.namespace=namespace;this.alias=alias;
        prefs=context.getSharedPreferences(namespace,Context.MODE_PRIVATE);
        for(String id:new HashSet<>(prefs.getStringSet("locations",Collections.emptySet())))
            if(valid(id))locations.put(id,new DocumentVault(context,storage(id),alias));
    }
    private static boolean valid(String id) { return id!=null&&id.matches("[a-f0-9]{64}"); }
    private String storage(String id) { return namespace+"-"+id; }
    String primary() { return prefs.getString("primary",null); }
    DocumentVault candidate() { return new DocumentVault(context,namespace+"-candidate-"+UUID.randomUUID(),alias); }
    DocumentVault get(String requested)throws IOException {
        String id=requested==null?primary():requested;
        if(id==null)throw new IOException("VAULT_NOT_CONFIGURED");
        DocumentVault vault=locations.get(id);
        if(vault==null)throw new IOException("VAULT_LOCATION_UNAVAILABLE");
        return vault;
    }
    void ensureIdle()throws IOException {
        for(DocumentVault vault:locations.values())if(vault.transferring())throw new IOException("VAULT_BUSY");
    }
    String adopt(DocumentVault candidate)throws Exception {
        ensureIdle();
        if(!candidate.configured())throw new IOException("VAULT_NOT_CONFIGURED");
        String id=candidate.locationId();
        candidate.rehome(storage(id));
        Set<String> next=new HashSet<>(locations.keySet());next.add(id);
        if(!prefs.edit().putStringSet("locations",next).commit())throw new IOException("VAULT_UNAVAILABLE");
        DocumentVault previous=locations.put(id,candidate);
        if(previous!=null&&previous!=candidate)previous.closeWorking();
        return id;
    }
    JSONObject state(String requested)throws Exception {
        String id=requested==null?primary():requested;
        if(id==null)return new JSONObject().put("configured",false).put("internal",true);
        return get(id).state().put("location",id).put("primary",id.equals(primary()));
    }
    JSONArray list()throws Exception {
        JSONArray result=new JSONArray();
        for(String id:new TreeSet<>(locations.keySet()))result.put(state(id));
        return result;
    }
    void select(String id)throws Exception {
        ensureIdle();
        if(id!=null&&!get(id).state().optBoolean("unlocked"))throw new IOException("VAULT_LOCKED");
        SharedPreferences.Editor change=prefs.edit();
        if(id==null)change.remove("primary");else change.putString("primary",id);
        if(!change.commit())throw new IOException("VAULT_UNAVAILABLE");
    }
    void lock()throws Exception {
        Exception failure=null;
        for(DocumentVault vault:locations.values())try{vault.lock();}catch(Exception error){failure=error;}
        if(failure!=null)throw failure;
    }
    void close() { for(DocumentVault vault:locations.values())vault.closeWorking(); }
}
