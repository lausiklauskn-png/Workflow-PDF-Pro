import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/portierung/QUELLDATEIEN-SHA256.json')));
const source=process.argv[2] || path.join(root,'upstream/workflow-pdf');
let failed=0;
for(const file of manifest.files){
 const p=path.join(source,file.path);
 const stat=fs.existsSync(p)?fs.lstatSync(p):null;
 const hash=stat?.isFile()&&!stat.isSymbolicLink()?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
 if(hash!==file.sha256){console.error('Abweichung: '+file.path);failed++;}
}
console.log(JSON.stringify({commit:manifest.commit,checked:manifest.files.length,failed}));
process.exitCode=failed?1:0;
