import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
await import('../../native/vault-codec.js');
await import('../../native/vault-journal.js');
await import('../../native/vault-migration.js');
await import('../../native/vault-preferences.js');

function fixture(){
  const names=WFPVaultMigration.stores, data=new Map(names.map(s=>[s,new Map()]));
  let remote=new Map(),batch=null,marker=null,primary=null,failIndex=false,afterWrite=()=>{};
  const key=(s,id)=>JSON.stringify([s,id]);
  const source={keys:async s=>[...data.get(s).keys()],get:async(s,id)=>structuredClone(data.get(s).get(id))};
  const records={
    async save(location,s,record){
      assert.equal(location,'target');const blob=WFPVaultCodec.encode(record),hash=createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex');
      (batch||remote).set(key(s,record.id),{blob,hash});afterWrite(s,record.id);return {saved:true,size:blob.size,hash};
    },
    async load(location,s,id,expected){const item=(batch||remote).get(key(s,id));if(!item)throw Error('VAULT_RECORD_NOT_FOUND');if(expected&&item.hash!==expected)throw Error('VAULT_RECORD_CHANGED');return {record:await WFPVaultCodec.decode(item.blob),info:{hash:item.hash}};}
  };
  const bridge={
    async state(){return {location:'target',id:'vault',unlocked:true,reachable:true};},
    async info({store,id}){const item=(batch||remote).get(key(store,id));return item?{exists:true,hash:item.hash}:{exists:false};},
    async list({store}){return {ids:[...(batch||remote).keys()].map(k=>JSON.parse(k)).filter(k=>k[0]===store).map(k=>k[1])};},
    async prepareMigration(){marker='target';},
    async beginBatch(){assert.equal(batch,null);batch=new Map(remote);return {started:true};},
    async commitBatch(){remote=batch;batch=null;return {saved:true};},
    async abortBatch(){batch=null;return {aborted:true};},
    async cancelMigration(){marker=null;return {saved:true};},
    async completeMigration(){primary=marker;marker=null;return this.state();},
    async remove({store,id}){(batch||remote).delete(key(store,id));return {saved:true};}
  };
  const local={async commit(changes){if(failIndex)throw Error('INDEX_QUOTA');for(const c of changes){if(c.kind==='delete')data.get(c.store).delete(c.id);else data.get(c.store).set(c.id,structuredClone(c.record));}}};
  const transfer=options=>WFPVaultMigration.transfer({bridge,records,source,local,location:'target',vaultId:'vault',...options});
  return {data,records,bridge,local,source,transfer,get remote(){return remote;},get marker(){return marker;},get primary(){return primary;},set failIndex(v){failIndex=v;},set afterWrite(v){afterWrite=v;}};
}
test('transfer keeps original photos, structured jobs, field/removal metadata and search blocks; internal PDFs become references',async()=>{
  const f=fixture();
  f.data.get('docs').set('d',{id:'d',fields:[{value:'Мüller'}],kiEntfernt:[{text:'synthetic'}]});
  f.data.get('files').set('d',{id:'d',bytes:new Uint8Array([37,80,68,70])});
  f.data.get('files').set('d~original',{id:'d~original',name:'unexamined.png',bytes:new Uint8Array([1,2,3])});
  f.data.get('files').set('ue:d:de-ru',{id:'ue:d:de-ru',job:{page:8,texte:['Имя']}});
  f.data.get('vektoren').set('d#00000',{id:'d#00000',vector:new Float32Array([.25])});
  await f.records.save('target','folders',{id:'existing',name:'From another device'});
  await f.transfer();assert.equal(f.marker,null);assert.equal(f.primary,'target');
  for(const id of ['d','d~original','ue:d:de-ru']){const stored=f.data.get('files').get(id);assert.equal(stored.bytes,undefined);assert.equal(stored.__wfpVault.location,'target');}
  assert.equal((await f.records.load('target','files','ue:d:de-ru')).record.job.page,8);
  assert.deepEqual((await f.records.load('target','files','d~original')).record.bytes,new Uint8Array([1,2,3]));
  assert.equal(f.data.get('folders').get('existing').name,'From another device');
  assert.equal(f.data.get('docs').get('d').fields[0].value,'Мüller');assert.deepEqual(f.data.get('vektoren').get('d#00000').vector,new Float32Array([.25]));
});
test('conflicting IDs never overwrite either library and do not start a destination batch',async()=>{
  const f=fixture();f.data.get('docs').set('d',{id:'d',name:'current'});await f.records.save('target','docs',{id:'d',name:'older'});
  await assert.rejects(f.transfer(),/VAULT_MIGRATION_CONFLICT/);
  assert.equal(f.data.get('docs').get('d').name,'current');assert.equal((await f.records.load('target','docs','d')).record.name,'older');assert.equal(f.marker,null);
});
test('cancel during staged copying leaves source and destination generations unchanged',async()=>{
  const f=fixture(),abort=new AbortController();
  f.data.get('files').set('one',{id:'one',bytes:new Uint8Array([1])});f.data.get('files').set('two',{id:'two',bytes:new Uint8Array([2])});
  await f.records.save('target','docs',{id:'existing',name:'retained'});
  const before=[...f.remote.keys()];f.afterWrite=(s,id)=>{if(id==='one')abort.abort();};
  await assert.rejects(f.transfer({signal:abort.signal}),/VAULT_MIGRATION_CANCELLED/);
  assert.deepEqual([...f.remote.keys()],before);assert.deepEqual(f.data.get('files').get('one').bytes,new Uint8Array([1]));assert.equal(f.marker,null);assert.equal(f.primary,null);
});
test('quota after destination commit retains recovery pointer and original bytes; repeat finishes the index',async()=>{
  const f=fixture();f.data.get('files').set('d',{id:'d',bytes:new Uint8Array([8,9])});f.failIndex=true;
  await assert.rejects(f.transfer(),/INDEX_QUOTA/);assert.equal(f.marker,'target');assert.equal(f.primary,null);assert.deepEqual(f.data.get('files').get('d').bytes,new Uint8Array([8,9]));
  f.failIndex=false;await f.transfer();assert.equal(f.marker,null);assert.equal(f.primary,'target');assert.equal(f.data.get('files').get('d').bytes,undefined);
});
test('regranting the same portable vault at another location verifies versions before rebinding references',async()=>{
  const f=fixture(),record={id:'d',bytes:new Uint8Array([1,2,3])};
  const info=await f.records.save('target','files',record);f.data.get('files').set('d',{id:'d',__wfpVault:{location:'old',vaultId:'vault',hash:info.hash}});
  await WFPVaultMigration.reconnect({bridge:f.bridge,records:f.records,local:{...f.local,keys:f.source.keys,get:f.source.get},location:'target',vaultId:'vault'});
  assert.equal(f.data.get('files').get('d').__wfpVault.location,'target');assert.equal(f.primary,'target');
});
test('older copied record cannot be accepted as a successful regrant',async()=>{
  const f=fixture();await f.records.save('target','files',{id:'d',bytes:new Uint8Array([1])});
  f.data.get('files').set('d',{id:'d',__wfpVault:{location:'old',vaultId:'vault',hash:'f'.repeat(64)}});
  await assert.rejects(WFPVaultMigration.reconnect({bridge:f.bridge,records:f.records,local:{...f.local,keys:f.source.keys,get:f.source.get},location:'target',vaultId:'vault'}),/VAULT_RECORD_CHANGED/);
  assert.equal(f.data.get('files').get('d').__wfpVault.location,'old');assert.equal(f.primary,null);
});
test('portable preferences exclude API keys, provider consents and unrelated storage on save and restore',()=>{
  const map=new Map([
    ['wfpdf_einst_v1',JSON.stringify({anbieter:'mistral',modell:{mistral:'model'},schluessel:{mistral:'synthetic-secret'},kiOk:{mistral:true},ueVon:'de',ueNach:'ru'})],
    ['wfpdf_sprache_v1',JSON.stringify({lang:'ar',tipps:false})],['sbkim_identity','synthetic-device-key']
  ]);
  const storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};
  const snapshot=WFPVaultPreferences.snapshot(storage);assert.equal(JSON.stringify(snapshot).includes('synthetic-secret'),false);assert.equal(snapshot.values.wfpdf_einst_v1.kiOk,undefined);assert.equal(snapshot.values.sbkim_identity,undefined);
  snapshot.values.wfpdf_einst_v1.schluessel={mistral:'foreign'};snapshot.values.wfpdf_einst_v1.kiOk={mistral:false};
  WFPVaultPreferences.restore(snapshot,storage);const settings=JSON.parse(map.get('wfpdf_einst_v1'));
  assert.equal(settings.schluessel.mistral,'synthetic-secret');assert.equal(settings.kiOk.mistral,true);assert.equal(JSON.parse(map.get('wfpdf_sprache_v1')).lang,'ar');assert.equal(map.get('sbkim_identity'),'synthetic-device-key');
});
