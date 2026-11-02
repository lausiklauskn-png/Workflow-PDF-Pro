// Eigenes minimales JRE im Installer; kein installiertes Java, keine zweite Tresor-Kryptografie.
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const target=join(root,'windows/src-tauri/pro-tresor'),classes=join(root,'work/pro-tresor-classes');
const base='android/app/src/main/java/de/familyprojekt/';
const sources=readdirSync(join(root,base,'tresor')).filter(f=>f.endsWith('.java')&&f!=='SafAblage.java').map(f=>base+'tresor/'+f);
const java=process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';
mkdirSync(target,{recursive:true});rmSync(classes,{recursive:true,force:true});mkdirSync(classes,{recursive:true});
execFileSync(java,['-m','jdk.compiler/com.sun.tools.javac.Main','-encoding','UTF-8','-d',classes,...sources,
  base+'workflowpdf/pro/ProVerbund.java','windows/java/de/familyprojekt/workflowpdf/pro/ProTresorEngine.java'],{cwd:root,stdio:'inherit'});
const jar=join(target,'workflow-pro-tresor.jar');
execFileSync(java,['-m','jdk.jartool/sun.tools.jar.Main','--create','--file',jar,'-C',classes,'.'],{cwd:root,stdio:'inherit'});
if(!process.argv.includes('--nur-jar')) {
  const runtime=join(target,'runtime');rmSync(runtime,{recursive:true,force:true});
  execFileSync(java,['-m','jdk.jlink/jdk.tools.jlink.internal.Main','--add-modules','java.base','--strip-debug','--no-header-files','--no-man-pages','--output',runtime],{cwd:root,stdio:'inherit'});
  const probe=spawnSync(join(runtime,'bin',process.platform==='win32'?'java.exe':'java'),['-cp',jar,'de.familyprojekt.workflowpdf.pro.ProTresorEngine',join(classes,'probe-config.json')],
    {input:'{"method":"tresorZustand","options":{}}\n',encoding:'utf8',timeout:15000});
  const result=probe.status===0?JSON.parse(probe.stdout):null;
  if(result?.ok?.gewaehlt!==false||result.ok.uebergaben!==true||result.ok.offen!==false)throw Error('Gebündelte Tresor-Laufzeit besteht Startprobe nicht.');
}
console.log('Pro-Tresor: unveränderter Java-Kanon und Workflow-Adapter gebaut.');
