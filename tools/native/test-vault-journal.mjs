import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
await import('../../native/vault-codec.js');
await import('../../native/vault-journal.js');
await import('../../native/vault-db.js');

// Protocol/fault fixture, not an Android encryption or physical-device test.
function fixture() {
  const remote = new Map(), stores = new Map(['folders','docs','files','texte','vektoren'].map(s => [s,new Map()]));
  let boundary = 0, crash = -1, reachable = true, failCommit = false;
  const hit = () => { if (++boundary === crash) throw Error('POWER_INTERRUPTED'); };
  const key = (store,id) => JSON.stringify([store,id]);
  const records = {
    async save(location,store,record) {
      assert.equal(location,'selected');
      const blob=WFPVaultCodec.encode(record), hash=createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex');
      remote.set(key(store,record.id),{blob,hash}); hit();
      return {exists:true,saved:true,hash,size:blob.size};
    },
    async load(location,store,id,hash) {
      assert.equal(location,'selected'); const item=remote.get(key(store,id));
      if(!item)throw Error('VAULT_RECORD_NOT_FOUND');
      if(hash&&hash!==item.hash)throw Error('VAULT_RECORD_CHANGED');
      return {record:await WFPVaultCodec.decode(item.blob),info:{hash:item.hash}};
    }
  };
  const bridge = {
    async state() { return {id:'own-vault',location:'selected',unlocked:reachable,reachable,problem:'VAULT_FOLDER_UNAVAILABLE'}; },
    async info({store,id}) { const item=remote.get(key(store,id)); return item?{exists:true,hash:item.hash}:{exists:false}; },
    async remove({store,id}) { remote.delete(key(store,id));hit();return {saved:true}; }
  };
  const local = {
    async get(s,id){return structuredClone(stores.get(s).get(id));},
    async all(s){return structuredClone([...stores.get(s).values()]);},
    async keys(s){return [...stores.get(s).keys()];},
    async persist(){return true;},
    async commit(changes){
      if(failCommit)throw Error('INDEX_QUOTA');
      for(const c of changes){if(c.kind==='delete')stores.get(c.store).delete(c.id);else stores.get(c.store).set(c.id,structuredClone(c.record));}
      hit();
    }
  };
  const statuses=[];
  const restart=()=>{
    const journal=new WFPVaultJournal({bridge,records,local,location:'selected',vaultId:'own-vault',status:s=>statuses.push(s)});
    return {journal,db:WFPVaultDB.create({journal,local,records})};
  };
  return {remote,records,bridge,local,stores,statuses,restart,
    cut(n){boundary=0;crash=n;},resume(){crash=-1;},set reachable(v){reachable=v;},set failCommit(v){failCommit=v;}};
}

test('restart replays every interrupted durable write boundary before allowing reads',async t=>{
  // Pending journal, PDF, text deletion, vector deletion, local commit, done marker.
  for(let boundary=1;boundary<=6;boundary++)await t.test('boundary '+boundary,async()=>{
    const f=fixture(), first=f.restart();await first.journal.recover();
    f.stores.get('texte').set('x',{id:'x',text:'old'});f.stores.get('vektoren').set('x#00000',{id:'x#00000',values:[8]});
    f.cut(boundary);
    await assert.rejects(first.db.putFile('x',new Uint8Array([1,2,3])),/POWER_INTERRUPTED/);
    await assert.rejects(first.db.getFile('x'),/VAULT_RECOVERY_REQUIRED/);
    f.resume();const second=f.restart();await second.journal.recover();
    assert.deepEqual(await second.db.getFile('x'),new Uint8Array([1,2,3]));
    assert.equal(f.stores.get('files').get('x').bytes,undefined);
    assert.equal(f.stores.get('texte').has('x'),false);assert.equal(f.stores.get('vektoren').has('x#00000'),false);
    const done=await f.records.load('selected','settings','workflow-library-journal-v1');
    assert.equal(done.record.phase,'done');assert.deepEqual(done.record.changes,[]);
  });
});
test('an index quota failure retains the encrypted redo payload and never reports saved',async()=>{
  const f=fixture(), a=f.restart();await a.journal.recover();f.statuses.length=0;f.failCommit=true;
  await assert.rejects(a.db.put('docs',{id:'d',fields:[{value:'Мüller'}],kiEntfernt:[{text:'synthetic'}]}),/INDEX_QUOTA/);
  assert.equal(f.stores.get('docs').size,0);assert.deepEqual(f.statuses,['writing','error']);
  f.failCommit=false;const b=f.restart();await b.journal.recover();assert.equal((await b.db.get('docs','d')).fields[0].value,'Мüller');
});
test('file replacement/deletion invalidates every vector block and preserves the original lifecycle and translation jobs',async()=>{
  const f=fixture(),{journal,db}=f.restart();await journal.recover();
  await db.put('files',{id:'ue:x:de-ru',job:{page:3,done:['Имя']}});
  await db.put('files',{id:'x~original',bytes:new Uint8Array([7]),name:'original.jpg'});
  for(const id of ['x','x#00000','x#00002','xx#00000'])await db.put('vektoren',{id,vector:new Float32Array([.25])});
  await db.putFile('x',new Uint8Array([4]));
  assert.deepEqual(await db.keys('vektoren'),['xx#00000']);
  assert.equal((await db.get('files','x~original')).name,'original.jpg');
  assert.equal((await db.all('files')).length,3);
  await db.del('files','x');assert.equal(await db.getFile('x'),null);assert.equal(await db.get('files','x~original'),undefined);
  assert.equal((await db.get('files','ue:x:de-ru')).job.page,3);
});
test('unreachable/locked storage blocks even translation-job reads and cannot become a missing job or empty library',async()=>{
  const f=fixture(),a=f.restart();await a.journal.recover();await a.db.put('files',{id:'ue:x:de-ru',job:{page:9}});
  f.reachable=false;
  await assert.rejects(a.db.get('files','ue:x:de-ru'),/VAULT_FOLDER_UNAVAILABLE/);
  await assert.rejects(a.db.put('files',{id:'ue:x:de-ru',job:{page:0}}),/VAULT_RECOVERY_REQUIRED/);
  const b=f.restart();await assert.rejects(b.journal.recover(),/VAULT_FOLDER_UNAVAILABLE/);
  f.reachable=true;await b.journal.recover();assert.equal((await b.db.get('files','ue:x:de-ru')).job.page,9);
});
test('damaged or foreign journals fail closed without modifying local records',async()=>{
  for(const bad of [ {version:2}, {vaultId:'foreign'}, {changes:[{kind:'put',store:'settings',id:'api-key',record:{id:'api-key'}}]} ]){
    const f=fixture();await f.records.save('selected','settings',{id:'workflow-library-journal-v1',version:1,vaultId:'own-vault',phase:'pending',operation:'id',changes:[],...bad});
    const a=f.restart();await assert.rejects(a.journal.recover(),/VAULT_JOURNAL_DAMAGED/);
    await assert.rejects(a.db.all('docs'),/VAULT_RECOVERY_REQUIRED/);assert.equal(f.stores.get('docs').size,0);
  }
});
test('callers cannot mutate queued values; writes and reads retain call order',async()=>{
  const f=fixture(),{journal,db}=f.restart();await journal.recover();
  const record={id:'d',fields:[{value:'before'}]}, first=db.put('docs',record);record.fields[0].value='after';
  const read=db.get('docs','d'), second=db.put('docs',{id:'d',fields:[]});
  await first;assert.equal((await read).fields[0].value,'before');await second;
  assert.deepEqual((await db.get('docs','d')).fields,[]);
});
test('stale file references are rejected rather than returning a different document version',async()=>{
  const f=fixture(),{journal,db}=f.restart();await journal.recover();await db.putFile('d',new Uint8Array([1]));
  await f.records.save('selected','files',{id:'d',bytes:new Uint8Array([9])});
  await assert.rejects(db.getFile('d'),/VAULT_RECORD_CHANGED/);
});
