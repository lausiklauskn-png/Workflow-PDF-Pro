import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyAcceptance} from './verify-acceptance-reports.mjs';
const commit='a'.repeat(40);
async function fixture(run){
  const root=await mkdtemp(join(tmpdir(),'wfp-acceptance-'));
  const report=async(api,attempt,changes={})=>{
    const path=join(root,`native-acceptance-${api}-${attempt}`,'work/acceptance');await mkdir(path,{recursive:true});
    await writeFile(join(path,`native-${api}.json`),JSON.stringify({commit,api,tests:47,failures:0,errors:0,skipped:0,reinstallPreservesData:true,...changes}));
  };
  try{await run(root,report);}finally{await rm(root,{recursive:true,force:true});}
}
test('successful rerun retains tablet proof and selects the new phone report despite older failed artifacts',()=>fixture(async(root,report)=>{
  await report(31,1);await mkdir(join(root,'native-acceptance-35-1'));await report(35,2);
  assert.deepEqual((await verifyAcceptance(root,commit)).map(p=>p.artifact),['native-acceptance-31-1','native-acceptance-35-2']);
}));
test('incomplete latest attempt cannot fall back to an earlier success',()=>fixture(async(root,report)=>{
  await report(31,1);await report(35,1);await mkdir(join(root,'native-acceptance-35-2'));
  await assert.rejects(verifyAcceptance(root,commit),/ENOENT/);
}));
for(const changes of [{commit:'b'.repeat(40)},{tests:46},{errors:1},{skipped:1},{reinstallPreservesData:false}]){
  test('reject mismatched or incomplete actual evidence '+JSON.stringify(changes),()=>fixture(async(root,report)=>{
    await report(31,1);await report(35,1,changes);await assert.rejects(verifyAcceptance(root,commit));
  }));
}
