import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const required=['FolderImportTest','IncomingFilesTest','NativeDocumentVaultTest','NativeFoundationTest','NativeIncomingTest','NativeVaultProductTest','NativeChromeTest','IncomingInboxTest','NativeTranslateTest','NativeSpeechTest','NativeCoreProductTest','NativePickerProductTest'];
async function files(directory){const out=[];for(const file of await readdir(directory,{withFileTypes:true})){const path=join(directory,file.name);if(file.isDirectory())out.push(...await files(path));else if(/^TEST-.*\.xml$/.test(file.name))out.push(path);}return out;}
const paths=await files('android/app/build/outputs/androidTest-results');assert.ok(paths.length,'No actual instrumented result XML');
let tests=0;const classes=new Set();
for(const path of paths){
  const xml=await readFile(path,'utf8');const root=xml.match(/<testsuite\b([^>]+)>/);assert.ok(root,path);const attrs=Object.fromEntries([...root[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  for(const name of ['failures','errors','skipped'])assert.equal(Number(attrs[name]),0,path+' '+name);
  const cases=[...xml.matchAll(/<testcase\b([^>]+)>?/g)];assert.equal(cases.length,Number(attrs.tests));tests+=cases.length;
  for(const entry of cases){const name=entry[1].match(/classname="([^"]+)"/)?.[1];assert.ok(name);classes.add(name.split('.').at(-1));}
}
for(const name of required)assert.ok(classes.has(name),'Missing executed class '+name);assert.ok(tests>=44,'Incomplete product suite');
const source=JSON.parse(await readFile('docs/portierung/QUELLDATEIEN-SHA256.json','utf8'));
const installation=JSON.parse(await readFile('android/app/build/outputs/apk/debug/app-debug.apk.installation.json','utf8'));
assert.equal(installation.applicationId,'de.familyprojekt.workflowpdf.pro.debug');assert.equal(installation.commit,process.env.GITHUB_SHA);assert.equal(installation.developmentProbe,true);assert.equal(installation.reinstallPreservesData,true);
const report={commit:process.env.GITHUB_SHA,api:Number(process.env.ANDROID_TEST_API),tests,failures:0,errors:0,skipped:0,reinstallPreservesData:true,classes:[...classes].sort(),sourceCommit:source.commit,kind:'actual Android instrumentation; camera/speech activity fixtures are synthetic; local ML translation, OCR and scanner model are real'};
await mkdir('work/acceptance',{recursive:true});await writeFile('work/acceptance/native-'+report.api+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
