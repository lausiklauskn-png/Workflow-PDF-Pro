import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
await import('../../native/vault-codec.js');
await import('../../native/vault-records.js');

// Transport fixture only: real SAF, authentication and Keystore are exercised
// separately by the Android tests. No simulated result is labelled a device run.
function fixture() {
  const values = new Map(), pending = new Map(), calls = [];
  let failChunk = false, failFinish = false, emptyRead = false;
  const key = args => JSON.stringify([args.location, args.store, args.id]);
  const bridge = {
    async begin(args) { const ticket = 'transfer-' + pending.size; pending.set(ticket, { ...args, parts: [], offset: 0 }); calls.push(['begin',args.location]); return { ticket }; },
    async append(args) {
      if (failChunk) throw new Error('VAULT_FOLDER_UNAVAILABLE');
      const transfer = pending.get(args.ticket), part = Buffer.from(args.data,'base64');
      assert.equal(args.location,transfer.location);assert.equal(args.offset,transfer.offset);assert.ok(part.length <= 262144);
      transfer.parts.push(part);transfer.offset += part.length;calls.push(['append',args.offset]);
    },
    async finish(args) {
      if(failFinish) throw new Error('VAULT_FOLDER_UNAVAILABLE');
      const transfer = pending.get(args.ticket), data = Buffer.concat(transfer.parts);assert.equal(data.length,args.size);
      const hash = createHash('sha256').update(data).digest('hex');
      const info = { exists: true, size: data.length, hash, ...(transfer.reference ? {reference:transfer.reference} : {}) };
      values.set(key(transfer), { data, info });pending.delete(args.ticket);return { ...info, saved: true };
    },
    async abort(args) { pending.delete(args.ticket);calls.push(['abort',args.location]); },
    async info(args) { return values.get(key(args))?.info || { exists:false }; },
    async read(args) {
      calls.push(['read',args.offset]);const value=values.get(key(args));
      if(args.hash!==value.info.hash)throw new Error('VAULT_RECORD_CHANGED');
      return { data:emptyRead?'':value.data.subarray(args.offset,args.offset+262144).toString('base64') };
    }
  };
  return { bridge, values, pending, calls, set failChunk(value){failChunk=value;}, set failFinish(value){failFinish=value;}, set emptyRead(value){emptyRead=value;} };
}

test('multi-chunk records keep originals and resumable translation jobs in their own selected locations', async () => {
  const f = fixture(), records = new WFPVaultRecords(f.bridge), bytes = Uint8Array.from({length:600001},(_,i)=>i%251);
  const original = { id:'Документ~original',bytes }, job = { id:'ue:Документ:de-ru',stand:3,seiten:[{original:'Name',ergebnis:'Имя',fertig:true}] };
  const info = await records.save('internal-folder','files',original);
  await records.save('sd-folder','files',job);
  assert.deepEqual((await records.load('internal-folder','files',original.id,info.hash)).record,original);
  assert.deepEqual((await records.load('sd-folder','files',job.id)).record,job);
  await assert.rejects(records.load('sd-folder','files',original.id),/VAULT_RECORD_NOT_FOUND/);
  assert.deepEqual(f.calls.filter(c=>c[0]==='append').slice(0,3).map(c=>c[1]),[0,262144,524288]);
  assert.equal(f.pending.size,0);
});
test('a record replaced between info and its first chunk cannot return bytes of another version', async () => {
  const f=fixture(), records=new WFPVaultRecords(f.bridge);
  await records.save('a','files',{id:'x',bytes:new Uint8Array([1,2,3])});
  const changed=new WFPVaultRecords({...f.bridge,info:async args=>{
    const old=await f.bridge.info(args);await records.save('a','files',{id:'x',bytes:new Uint8Array([4,5,6])});return old;
  }});
  await assert.rejects(changed.load('a','files','x'),/VAULT_RECORD_CHANGED/);
});
test('failed chunk or unconfirmed commit aborts staging and keeps the previous complete original', async () => {
  const f = fixture(), records = new WFPVaultRecords(f.bridge), original = {id:'x',bytes:new Uint8Array([1,2,3])};
  await records.save('a','files',original);
  for(const phase of ['failChunk','failFinish']) {
    f[phase] = true;
    await assert.rejects(records.save('a','files',{id:'x',bytes:new Uint8Array([9])}),/VAULT_FOLDER_UNAVAILABLE/);
    assert.equal(f.pending.size,0);f[phase] = false;
    assert.deepEqual((await records.load('a','files','x')).record,original);
  }
  assert.equal(f.calls.filter(c=>c[0]==='abort').length,2);
});
test('stale versions are rejected before reading and an interrupted read cannot become a valid empty document', async () => {
  const f = fixture(), records = new WFPVaultRecords(f.bridge);
  await records.save('a','files',{id:'x',bytes:new Uint8Array([1])});
  await assert.rejects(records.load('a','files','x','0'.repeat(64)),/VAULT_RECORD_CHANGED/);
  assert.equal(f.calls.some(c=>c[0]==='read'),false);
  f.emptyRead = true;await assert.rejects(records.load('a','files','x'),/VAULT_INVALID_TRANSFER/);
  const broken = new WFPVaultRecords({...f.bridge,finish:async()=>({saved:false})});
  await assert.rejects(broken.save('a','files',{id:'y'}),/VAULT_WRITE_UNCONFIRMED/);
  assert.equal(f.pending.size,0);
});
