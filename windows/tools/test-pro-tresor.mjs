import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {join,delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),classes=join(root,'work/pro-tresor-probe');
const java=process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';
mkdirSync(classes,{recursive:true});
const jar=join(root,'windows/src-tauri/pro-tresor/workflow-pro-tresor.jar');
execFileSync(java,['-m','jdk.compiler/com.sun.tools.javac.Main','-encoding','UTF-8','-cp',jar,'-d',classes,
  'windows/java-tests/de/familyprojekt/workflowpdf/pro/ProVerbundProbe.java'],{cwd:root,stdio:'inherit'});
execFileSync(java,['-Xmx256m','-cp',[classes,jar].join(delimiter),'de.familyprojekt.workflowpdf.pro.ProVerbundProbe'],{cwd:root,stdio:'inherit'});
execFileSync(process.execPath,['windows/tools/test-pro-size.mjs'],{cwd:root,stdio:'inherit'});
