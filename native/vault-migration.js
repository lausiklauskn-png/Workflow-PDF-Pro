/* Explicit, resumable transfer. The old library remains authoritative until a
   complete encrypted generation and one local index transaction are confirmed. */
((g) => {
  'use strict';
  const stores = ['folders','docs','files','texte','vektoren'];
  const fail = code => { throw new Error(code); };
  async function hash(record) {
    const bytes = await g.WFPVaultCodec.encode(record).arrayBuffer();
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2,'0')).join('');
  }
  async function transfer({ bridge, records, source, local, location, vaultId, signal, progress = () => {}, preferences }) {
    const check = () => { if (signal?.aborted) fail('VAULT_MIGRATION_CANCELLED'); };
    // Replay an existing destination journal without touching this device's index.
    // The destination is subsequently read in full before the index is installed.
    const recovered = new g.WFPVaultJournal({ bridge, records, local: { commit: async () => {} }, location, vaultId });
    await recovered.recover(); check();
    const plan = [];
    for (const store of stores) {
      const ids = await source.keys(store);
      for (const id of ids) {
        check(); const record = await source.get(store,id);
        if (!record || record.id !== id) fail('VAULT_SOURCE_DAMAGED');
        const info = await bridge.info({ location, store, id });
        if (info.exists !== true && info.exists !== false) fail('VAULT_RECORD_DAMAGED');
        const digest = await hash(record);
        // Conflicting IDs are never overwritten, including an older folder copy.
        if (info.exists && info.hash !== digest) fail('VAULT_MIGRATION_CONFLICT');
        plan.push({ store, id, hash: digest, missing: !info.exists });
      }
    }
    check(); await bridge.prepareMigration({ location });
    let staged = false, committed = false;
    try {
      await bridge.beginBatch({ location }); staged = true;
      for (let i=0;i<plan.length;i++) {
        check(); const item=plan[i];progress(i,plan.length);
        if (item.missing) {
          const record=await source.get(item.store,item.id);
          if (await hash(record)!==item.hash) fail('VAULT_SOURCE_CHANGED');
          const info=await records.save(location,item.store,record);
          if (info.hash!==item.hash) fail('VAULT_WRITE_UNCONFIRMED');
        }
      }
      if (preferences) await records.save(location,'settings',preferences);
      check();
      // Cancellation ends before this atomic destination commit. Thereafter we
      // finish/recover the index switch rather than reporting a false rollback.
      progress(plan.length,plan.length,true);
      const confirmation=await bridge.commitBatch({ location });
      if (confirmation.saved!==true) fail('VAULT_WRITE_UNCONFIRMED');
      committed = true;staged = false;
      const changes=[];
      for (const store of stores) {
        const result=await bridge.list({ location,store });
        if (!Array.isArray(result.ids)) fail('VAULT_RECORD_DAMAGED');
        for (const id of result.ids) {
          const {record,info}=await records.load(location,store,id);
          changes.push({kind:'put',store,id,record:store==='files'?{id,__wfpVault:{location,vaultId,hash:info.hash}}:record});
        }
      }
      await local.commit(changes);
      const state=await bridge.completeMigration({ location });
      if(state.location!==location||state.id!==vaultId||!state.unlocked)fail('VAULT_WRITE_UNCONFIRMED');
      return state;
    } catch(error) {
      if (!committed) {
        // Failed commit acknowledgement may follow an actual durable commit.
        // Keep the migration marker in that case so startup verifies/replays it.
        if(staged)await bridge.abortBatch({location}).catch(()=>{});
        if(error.message==='VAULT_MIGRATION_CANCELLED')await bridge.cancelMigration().catch(()=>{});
      }
      throw error;
    }
  }
  async function reconnect({bridge,records,local,location,vaultId}){
    const changes=[];
    for(const store of stores)for(const id of await local.keys(store)){
      const record=await local.get(store,id),ref=record?.__wfpVault;
      const expected=store==='files'&&ref?ref.hash:await hash(record);
      if(ref&&ref.vaultId!==vaultId)fail('VAULT_WRONG_FOLDER');
      const info=await bridge.info({location,store,id});
      if(info.exists!==true||info.hash!==expected)fail('VAULT_RECORD_CHANGED');
      await records.load(location,store,id,expected);
      if(store==='files')changes.push({kind:'put',store,id,record:{id,__wfpVault:{location,vaultId,hash:expected}}});
    }
    await bridge.prepareMigration({location});await local.commit(changes);
    const state=await bridge.completeMigration({location});
    if(state.location!==location||state.id!==vaultId||!state.unlocked)fail('VAULT_WRITE_UNCONFIRMED');
    return state;
  }
  g.WFPVaultMigration=Object.freeze({transfer,reconnect,hash,stores});
})(globalThis);
