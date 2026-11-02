// The public 20 MiB boundary through the actual Java process protocol and the
// production heap limit. Dialogs are synthetic; FPT1 files and parsing are real.
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,delimiter,resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createInterface} from 'node:readline';
import assert from 'node:assert/strict';
const java=process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';
const jar=resolve('windows/src-tauri/pro-tresor/workflow-pro-tresor.jar'),classes=resolve('work/pro-tresor-probe'),dir=await mkdtemp(join(tmpdir(),'wfp-size-'));
const root=join(dir,'Tresor'),path=join(dir,'20MiB.pdf'),payload=Buffer.alloc(20*1024*1024,67);payload.write('%PDF synthetic boundary');
const hash=createHash('sha256').update(payload).digest('hex');let child,waiting,stderr='';
const fixture=(...args)=>JSON.parse(execFileSync(java,['-cp',[classes,jar].join(delimiter),'de.familyprojekt.workflowpdf.pro.ProVerbundProbe',...args],{encoding:'utf8'}));
try{
  fixture('seed',root);await writeFile(path,payload);const seed=fixture('ui-seed',root,path);
  const env={...process.env};for(const name of ['JAVA_TOOL_OPTIONS','_JAVA_OPTIONS','JDK_JAVA_OPTIONS'])delete env[name];
  child=spawn(java,['-Xmx256m','-cp',jar,'de.familyprojekt.workflowpdf.pro.ProTresorEngine',join(dir,'config.json')],{env,stdio:['pipe','pipe','pipe']});
  child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-2000);});
  child.on('close',code=>waiting?.reject(Error('Engine exited '+code+' '+stderr)));
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{
    try{
      const row=JSON.parse(line);
      if(row.host){
        const ok=row.host==='folder'?{path:root}:row.host==='password'?{password:'Erfundene Pro-Probe ä 2026',remember:false}:row.host==='passwordResult'?{}:null;
        if(!ok)throw Error('Unexpected host '+row.host);child.stdin.write(JSON.stringify({ok})+'\n');return;
      }
      if(row.error)waiting.reject(Error(row.error));else waiting.resolve(row.ok);waiting=null;
    }catch(error){waiting?.reject(error);waiting=null;}
  });
  const call=(method,options)=>new Promise((resolve,reject)=>{
    assert.ok(!waiting,'one protocol request at a time');const timer=setTimeout(()=>{child.kill();reject(Error('Engine boundary timeout'));},180000);
    waiting={resolve:x=>{clearTimeout(timer);resolve(x);},reject:e=>{clearTimeout(timer);reject(e);}};
    child.stdin.write(JSON.stringify({method,options})+'\n');
  });
  await call('tresorVerbinden',{});
  const read=await call('tresorUebergabe',{vaultId:seed.vaultId,entryId:seed.entryId,aktion:'lesen'});
  assert.equal(createHash('sha256').update(Buffer.from(read.dataBase64,'base64')).digest('hex'),hash);
  const contract={...read.vertrag,id:'limit-return',quelle:'workflow-pdf-pro',ziel:'familienakte',bezug:'windows-family-ui'};
  const sent=await call('tresorUebergabe',{vaultId:seed.vaultId,aktion:'senden',vertrag:contract,dataBase64:read.dataBase64});
  assert.equal(sent.sha256,hash);assert.equal(sent.groesse,payload.length);
  const received=fixture('ui-confirm',root,join(dir,'return.pdf'));assert.equal(received.sha256,hash);
  console.log('PASS real engine reads and returns 20 MiB with the production heap limit');
}finally{child?.kill();await rm(dir,{recursive:true,force:true});}
