// Faults are inserted only into disposable copies of the generated bundle.
// Each selected test must first pass unchanged, then fail by assertion.
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {root} from './prepare-web.mjs';
const receiptLine="q.onsuccess=()=>{result=method==='all'?q.result.filter(r=>r.scope===scope).map(r=>r.record):method==='get'?q.result?.record:q.result;};";
const cases=[
 ['unawaited ordinary import','native-incoming.js','await WFPDurableImport.takeMany(files);','void WFPDurableImport.takeMany(files);',1,'acknowledgement waits for the ordinary document write to finish'],
 ['request success mistaken for transaction commit','pro-transfer-store.js',receiptLine,receiptLine.replace(';};',';resolve(result);};'),1,'receipt request success followed by transaction abort is never acknowledged'],
 ['stored PDF never verified','native-durable-import.js','await store.hash(await db.getFile(doc.id))!==receipt.pdfHash','false',2,'fresh persisted PDF mismatch keeps the source and retries without a duplicate'],
 ['restart reimports completed input','native-durable-import.js',"if(receipt?.stand==='gespeichert')return {id:receipt.docId,repeated:true};","if(receipt?.stand==='gespeichert')await db.del('docs',receipt.docId);",1,'cold page restart after ack failure retains receipt and subsequent user edits'],
 ['backup drops accepted receipts','native-sicherung.js','if(restored.proQuittungen)await welt.WFPProTransferStore.restore(restored.proQuittungen);',';',1,'native backup restores receipts only after complete authentication and does not duplicate an open intake']
];
const temp=await mkdtemp(join(tmpdir(),'wfp-incoming-counter-'));let missed=0;
const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function run(bundle,name){return spawnSync(process.execPath,['--test','--test-reporter=spec','--test-name-pattern=^native reception with real browser/core and a protocol fixture$|'+escaped(name)+'$',resolve(root,'tools/native/test-incoming.mjs')],{env:{...process.env,WFP_TEST_BUNDLE:bundle},encoding:'utf8',timeout:90000});}
try{
 for(const [name,file,anchor,replacement,count,test] of cases){
   const original=await readFile(join(root,'www/native',file),'utf8');
   if(original.split(anchor).length!==count+1)throw Error('Missing anchor: '+name);
   const baseline=run(join(root,'www'),test),baseText=baseline.stdout+baseline.stderr;
   if(baseline.status!==0||!baseText.includes('✔ '+test))throw Error('Baseline test did not pass: '+name+'\n'+baseText);
   const bundle=join(temp,'bundle');await rm(bundle,{recursive:true,force:true});await cp(join(root,'www'),bundle,{recursive:true});
   await writeFile(join(bundle,'native',file),original.split(anchor).join(replacement));
   const result=run(bundle,test),output=result.stdout+result.stderr;
   const caught=result.status!==null&&result.status!==0&&output.includes('✖ '+test)&&output.includes('AssertionError');
   console.log((caught?'PASS caught ':'FAIL missed or wrong reason ')+name);
   if(!caught){missed++;console.log(output.slice(-8000));}
 }
 if(missed)process.exitCode=1;
}finally{await rm(temp,{recursive:true,force:true});}
