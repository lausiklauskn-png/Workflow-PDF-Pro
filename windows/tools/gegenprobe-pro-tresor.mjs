// Verletzt jede neue Zusicherung in einer Wegwerfkopie. Compilerfehler zählen nicht als Treffer.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const java=process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';
const common=join(root,'android/app/src/main/java/de/familyprojekt/tresor');
const files=new Map(readdirSync(common).filter(n=>n.endsWith('.java')&&n!=='SafAblage.java').map(n=>[n,readFileSync(join(common,n),'utf8')]));
for(const path of ['android/app/src/main/java/de/familyprojekt/workflowpdf/pro/ProVerbund.java','windows/java/de/familyprojekt/workflowpdf/pro/ProTresorEngine.java','windows/java-tests/de/familyprojekt/workflowpdf/pro/ProVerbundProbe.java'])files.set(path.split('/').at(-1),readFileSync(join(root,path),'utf8'));
const cases=[
  ['fremder Tresor','ProVerbund.java',[['!vault.id().equals(Json.text(args,"vaultId"))','false']],'accepted TRESOR_UEBERGABE_FREMD'],
  ['Lesen quittiert sofort','ProVerbund.java',[['byte[] bytes=transfers.lesen(entry);','byte[] bytes=transfers.lesen(entry);transfers.quittieren(entry,(String)contract.get("sha256"));']],'read is not acceptance'],
  ['falsche Ausgangs-Prüfsumme','ProVerbund.java',[
    ['bytes.length!=size||!sha(bytes).equals(hash)','bytes.length!=size'],['result.groesse!=size||!result.sha256.equals(hash)','result.groesse!=size']],'accepted TRESOR_UEBERGABE_PRUEFSUMME'],
  ['manuelle Sperre öffnet automatisch','ProTresorEngine.java',[['open!=null||manualLock||remembered==null','open!=null||remembered==null']],'manual lock defeats remembered key'],
  ['Ordner am gleichen Pfad ersetzt','ProTresorEngine.java',[['expected!=null&&!expected.equals(TresorOrdner.kennung(a))','false']],'reject TRESOR_FREMDE_KENNUNG'],
  ['vergessener Schlüssel bleibt gespeichert','ProTresorEngine.java',[['save(folder,id,"");remembered="";','remembered="";']],'forget persists across restart']
];
function run(change){
  const dir=mkdtempSync(join(tmpdir(),'wfp-pro-counter-'));const classes=join(dir,'classes');mkdirSync(classes);
  try {
    for(const [name,original] of files) {
      let text=original;
      if(change?.[1]===name)for(const [before,after] of change[2]){if(!text.includes(before))throw Error('Toter Anker: '+change[0]);text=text.replace(before,after);}
      writeFileSync(join(dir,name),text);
    }
    execFileSync(java,['-m','jdk.compiler/com.sun.tools.javac.Main','-encoding','UTF-8','-d',classes,...[...files.keys()].map(n=>join(dir,n))],{stdio:'pipe'});
    try {return {ok:true,output:execFileSync(java,['-Xmx256m','-cp',classes,'de.familyprojekt.workflowpdf.pro.ProVerbundProbe'],{encoding:'utf8',stdio:'pipe'})};}
    catch(error){return {ok:false,output:String(error.stdout)+'\n'+String(error.stderr)};}
  } finally {rmSync(dir,{recursive:true,force:true});}
}
const baseline=run();if(!baseline.ok||!baseline.output.includes('30 checks passed'))throw Error('Unveränderte Ausgangsprobe ist nicht grün: '+baseline.output);
for(const change of cases){const result=run(change);if(result.ok||!result.output.includes('AssertionError')||!result.output.includes(change[3]))throw Error('Nicht gezielt gefangen: '+change[0]+'\n'+result.output);console.log('GEFANGEN '+change[0]);}
console.log('6 Gegenproben gezielt erkannt.');
