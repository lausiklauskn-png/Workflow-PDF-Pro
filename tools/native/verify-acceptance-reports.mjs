import {readdir,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

// Each attempt has a distinct artifact name. Never let an older success mask
// an incomplete or failed latest report, and retain prior attempts for review.
export async function verifyAcceptance(directory,commit){
  assert.match(commit,/^[a-f0-9]{40}$/);
  const entries=await readdir(directory,{withFileTypes:true}),reports=[];
  for(const api of [31,35]){
    const pattern=new RegExp(`^native-acceptance-${api}-([1-9][0-9]*)$`);
    const candidates=entries.filter(entry=>entry.isDirectory()&&pattern.test(entry.name));
    candidates.sort((a,b)=>Number(b.name.match(pattern)[1])-Number(a.name.match(pattern)[1]));
    assert.ok(candidates.length,'Missing Android '+api+' artifact');
    const selected=candidates[0].name;
    const proof=JSON.parse(await readFile(join(directory,selected,'work/acceptance',`native-${api}.json`)));
    assert.equal(proof.commit,commit);assert.equal(proof.api,api);
    assert.ok(proof.tests>=47);assert.equal(proof.reinstallPreservesData,true);
    for(const key of ['failures','errors','skipped'])assert.equal(proof[key],0);
    reports.push({artifact:selected,...proof});
  }
  return reports;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const reports=await verifyAcceptance(process.argv[2]||'evidence',process.env.GITHUB_SHA);
  console.log(JSON.stringify(reports));
  console.log('Originalkette und Produktprüfungen auf Android 12/15 bestanden. Physische Samsung-Hardware und manuelle Chrome-Menüübersetzung bleiben gesonderte Geräteabnahmen.');
}
