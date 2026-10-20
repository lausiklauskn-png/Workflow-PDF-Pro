import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const cwd='/workspace/setup/workflow-pdf-baseline';
const scripts=JSON.parse(fs.readFileSync(cwd+'/package.json')).scripts.test.split(' && ');
const results=[];
for (let i=0;i<scripts.length;i++) {
 const command=scripts[i], file=command.split(' ')[1];
 const r=spawnSync(process.execPath,[file],{cwd,env:{...process.env,NODE_OPTIONS:'--import=/workspace/setup/use-system-chromium.mjs --import=/workspace/setup/font-path.mjs'},encoding:'utf8',timeout:600000,maxBuffer:16*1024*1024});
 fs.writeFileSync('/workspace/setup/'+file.split('/')[1]+'.log',r.stdout+'\n'+r.stderr);
 const item={command,status:r.status,signal:r.signal,error:r.error?.message,skipped:/⊘/.test(r.stdout),summary:r.stdout.split('\n').filter(x=>/grün|ROT|nicht lauffähig/.test(x)).slice(-4)};
 results.push(item);fs.writeFileSync('/workspace/setup/baseline-results.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(item));
}

process.exitCode=results.some(r=>r.status!==0||r.skipped)?1:0;
