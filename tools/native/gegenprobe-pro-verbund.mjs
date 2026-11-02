// Each isolated fault must be caught by a concrete assertion after an unchanged
// passing baseline. Only disposable copies of the generated bundle are edited.
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {root} from './prepare-web.mjs';
const cases=[
 ['partially ready dialog exposes incoming controls','native-pro-verbund.js',"const content=el('div'),z=await T.state(),path=z.pfad||z.ordner||'';", "const content=body;content.replaceChildren();const z=await T.state(),path=z.pfad||z.ordner||'';",'incoming controls appear only when the whole dialog is ready'],
 ['ack before ordinary import','native-pro-transfers.js','const saved=await WFPDurableImport.take','const saved=WFPDurableImport.take','only selected incoming file is acknowledged after ordinary PDF and original are committed'],
 ['no durable outbox before native send','native-pro-transfers.js','await ctx.repo.put(row);return row;','return row;','normal prepared PDF retains its selected source when another editor document becomes current'],
 ['current editor replaces selected output source','native-pro-transfers.js','const receipt=await ctx.repo.get(proof.receipts[0]);',"const receipt=await ctx.repo.get(window.__wfpdf?.S.doc?.proEingang?.receipt||'pro-transfer-'+'0'.repeat(64));",'normal prepared PDF retains its selected source when another editor document becomes current'],
 ['send alone confirms receipt','native-pro-transfers.js',"if(answer.bestaetigt&&row.stand!=='im-eingang')", "if(row.stand!=='im-eingang')",'normal prepared PDF retains its selected source when another editor document becomes current'],
 ['pending output omitted from backup','native-sicherung.js','ausgaenge=store.pendingPayloads(quittungen);','ausgaenge=[];','pending outgoing bytes survive encrypted backup and partial backup never accepts a receipt'],
 ['library scope ignored','native-pro-transfers.js',"if(!proof||proof.scope!==ctx.scope)throw Error('PRO_LIBRARY_CHANGED');", "if(!proof)throw Error('PRO_LIBRARY_CHANGED');",'changing library after preparing output cannot assign it to the new scope']
];
const temp=await mkdtemp(join(tmpdir(),'wfp-pro-counter-'));let missed=0;
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function run(bundle,name){return spawnSync(process.execPath,['--test','--test-reporter=spec','--test-name-pattern=^Pro collaboration with durable ordinary library and exact outgoing versions$|^'+escape(name)+'$',resolve(root,'tools/native/test-pro-verbund.mjs')],{env:{...process.env,WFP_TEST_BUNDLE:bundle},encoding:'utf8',timeout:90000});}
try{
  for(const [title,file,anchor,replacement,test] of cases){
    const original=await readFile(join(root,'www/native',file),'utf8');if(original.split(anchor).length!==2)throw Error('Missing/ambiguous anchor: '+title);
    const baseline=run(join(root,'www'),test),before=baseline.stdout+baseline.stderr;
    if(baseline.status!==0||!before.includes('✔ '+test))throw Error('Baseline not executed/passed: '+title+'\n'+before);
    const bundle=join(temp,'bundle');await rm(bundle,{recursive:true,force:true});await cp(join(root,'www'),bundle,{recursive:true});
    await writeFile(join(bundle,'native',file),original.replace(anchor,replacement));
    const result=run(bundle,test),output=result.stdout+result.stderr;
    const caught=result.status!==null&&result.status!==0&&output.includes('✖ '+test)&&output.includes('AssertionError');
    console.log((caught?'PASS caught ':'FAIL missed or wrong reason ')+title);if(!caught){missed++;console.log(output.slice(-7000));}
  }
  if(missed)process.exitCode=1;
}finally{await rm(temp,{recursive:true,force:true});}
