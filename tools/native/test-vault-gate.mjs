import test from 'node:test';
import assert from 'node:assert/strict';
await import('../../native/vault-gate.js');
const deferred = () => { let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve}; };
const target = overrides => Object.fromEntries(['all','keys','get','put','del','vektorenWeg','putFile','getFile','persist'].map(method=>[method,overrides?.[method]||async function(){return method;}]));

test('locked startup holds library and translation-job reads until a recovered target is ready',async()=>{
  const gate=new WFPVaultGate();let completed=false;
  const read=gate.db.get('files','ue:d:de-ru').then(value=>{completed=true;return value;});
  await Promise.resolve();assert.equal(completed,false);
  gate.resume(target({get:async()=>({id:'ue:d:de-ru',job:{page:4}})}));
  assert.equal((await read).job.page,4);
});
test('pause drains an active operation and prevents queued calls from using the old location',async()=>{
  const started=deferred(),finish=deferred(),gate=new WFPVaultGate(),calls=[];
  gate.resume(target({put:async()=>{calls.push('old');started.resolve();await finish.promise;}}));
  const previous=gate.db.put('docs',{id:'a'});await started.promise;
  let drained=false;const pause=gate.pause().then(()=>{drained=true;});
  const next=gate.db.put('docs',{id:'b'});await Promise.resolve();assert.equal(drained,false);assert.deepEqual(calls,['old']);
  assert.throws(()=>gate.resume(target()),/VAULT_GATE_NOT_READY/);
  finish.resolve();await previous;await pause;
  gate.resume(target({put:async()=>{calls.push('new');}}));await next;assert.deepEqual(calls,['old','new']);
});
test('a failed read cannot be followed by overwriting a resumable job before recovery',async()=>{
  const errors=[],gate=new WFPVaultGate(error=>errors.push(error.message));
  gate.resume(target({get:async()=>{throw Error('VAULT_LOCKED');}}));
  await assert.rejects(gate.db.get('files','ue:x:de-ru'),/VAULT_LOCKED/);
  await assert.rejects(gate.db.put('files',{id:'ue:x:de-ru',job:{page:0}}),/VAULT_RECOVERY_REQUIRED/);
  assert.deepEqual(errors,['VAULT_LOCKED']);
  gate.resume(target({get:async()=>({job:{page:8}})}));
  assert.equal((await gate.db.get('files','ue:x:de-ru')).job.page,8);
});
test('arguments retain their invocation-time values across unlock and pause',async()=>{
  const gate=new WFPVaultGate(),record={id:'d',fields:[{value:'before'}]};
  const call=gate.db.put('docs',record);record.fields[0].value='after';
  gate.resume(target({put:async(s,r)=>r.fields[0].value}));assert.equal(await call,'before');
});
test('a mutation queued during a pause is cancelled if an older operation fails before recovery',async()=>{
  const started=deferred(),finish=deferred(),gate=new WFPVaultGate();let writes=0;
  gate.resume(target({get:async()=>{started.resolve();await finish.promise;throw Error('READ_INTERRUPTED');}}));
  const read=assert.rejects(gate.db.get('files','ue:x:de-ru'),/READ_INTERRUPTED/);await started.promise;
  const pause=gate.pause(),queued=gate.db.put('files',{id:'ue:x:de-ru',job:{page:0}});
  finish.resolve();await read;await pause;
  gate.resume(target({put:async()=>{writes++;}}));
  await assert.rejects(queued,/VAULT_RECOVERY_REQUIRED/);assert.equal(writes,0);
});
test('an import lease keeps all ordinary writes in its original library while pause waits',async()=>{
  const gate=new WFPVaultGate(),wait=deferred(),started=deferred(),calls=[];
  gate.resume(target({put:async(s,r)=>{calls.push(r.id);}}));
  const work=gate.stable(async()=>{await gate.db.put('docs',{id:'first'});started.resolve();await wait.promise;await gate.db.put('docs',{id:'second'});});
  await started.promise;let paused=false;const pending=gate.pause().then(()=>paused=true);
  await Promise.resolve();assert.equal(paused,false);assert.equal(gate.blocked,false);
  await assert.rejects(gate.stable(async()=>{}),/VAULT_RECOVERY_REQUIRED/);
  assert.throws(()=>gate.resume(target()),/VAULT_GATE_NOT_READY/);
  wait.resolve();await work;await pending;assert.deepEqual(calls,['first','second']);assert.equal(gate.blocked,true);
  gate.resume(target());assert.equal(await gate.stable(async()=>42),42);
});
test('failed import releases its lease and allows explicit storage recovery',async()=>{
  const gate=new WFPVaultGate();gate.resume(target());
  await assert.rejects(gate.stable(async()=>{throw Error('IMPORT_ABORTED');}),/IMPORT_ABORTED/);
  await gate.pause();gate.resume(target());assert.equal(gate.leases,0);
});
