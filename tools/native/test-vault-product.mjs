import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {chromium} from 'playwright-core';
import {root} from './prepare-web.mjs';

test('product vault: real core and IndexedDB, native transport protocol fixture',async t=>{
  const base=join(root,'www');
  const server=createServer(async(req,res)=>{try{
    const path=resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(path!==base&&!path.startsWith(base+'/'))throw Error();
    const file=path===base?join(path,'index.html'):path;
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  const fixture={records:new Map(),batch:null,primary:null,migration:null,unlocked:true,failRead:false,tickets:new Map()};
  const key=(store,id)=>JSON.stringify([store,id]);
  const state=()=>fixture.primary?{configured:true,location:'target',id:'vault',folder:'Internal chosen folder',unlocked:fixture.unlocked,reachable:true,problem:'VAULT_LOCKED'}:{configured:false,internal:true};
  const candidate=()=>({configured:true,location:'target',id:'vault',folder:'Internal chosen folder',unlocked:fixture.unlocked,reachable:true,problem:'VAULT_LOCKED'});
  async function call(method,a={}){
    const view=()=>fixture.batch||fixture.records;
    if(method==='state')return a.location?candidate():state();
    if(method==='migration')return {location:fixture.migration};
    if(method==='choose')return {state:candidate(),location:'target',created:true};
    if(method==='unlock'){fixture.unlocked=true;return {unlocked:true};}
    if(method==='lock'){fixture.unlocked=false;return candidate();}
    if(method==='prepareMigration'){fixture.migration='target';return {saved:true};}
    if(method==='completeMigration'){fixture.primary='target';fixture.migration=null;return state();}
    if(method==='cancelMigration'){fixture.migration=null;return {saved:true};}
    if(method==='beginBatch'){fixture.batch=new Map(fixture.records);return {started:true};}
    if(method==='abortBatch'){fixture.batch=null;return {aborted:true};}
    if(method==='commitBatch'){fixture.records=fixture.batch;fixture.batch=null;return {saved:true};}
    if(method==='begin'){const ticket=randomUUID();fixture.tickets.set(ticket,{store:a.store,id:a.id,data:Buffer.alloc(0)});return {ticket};}
    if(method==='append'){const item=fixture.tickets.get(a.ticket);assert.equal(item.data.length,a.offset);item.data=Buffer.concat([item.data,Buffer.from(a.data,'base64')]);return {ok:true};}
    if(method==='finish'){const item=fixture.tickets.get(a.ticket);assert.equal(item.data.length,a.size);item.hash=createHash('sha256').update(item.data).digest('hex');view().set(key(item.store,item.id),item);fixture.tickets.delete(a.ticket);return {saved:true,size:item.data.length,hash:item.hash};}
    if(method==='abort'){fixture.tickets.delete(a.ticket);return {};}
    if(method==='info'){if(fixture.failRead)throw Error('VAULT_FOLDER_UNAVAILABLE');const item=view().get(key(a.store,a.id));return item?{exists:true,size:item.data.length,hash:item.hash}:{exists:false};}
    if(method==='read'){if(fixture.failRead)throw Error('VAULT_FOLDER_UNAVAILABLE');const item=view().get(key(a.store,a.id));assert.equal(a.hash,item.hash);return {data:item.data.subarray(a.offset,a.offset+262144).toString('base64')};}
    if(method==='list')return {ids:[...view().keys()].map(k=>JSON.parse(k)).filter(k=>k[0]===a.store).map(k=>k[1])};
    if(method==='remove'){view().delete(key(a.store,a.id));return {saved:true};}
    throw Error('Unknown bridge method '+method);
  }
  try{
    browser=await chromium.launch(process.env.WFP_CHROMIUM?{executablePath:process.env.WFP_CHROMIUM}:{});
    const page=await browser.newPage();await page.exposeFunction('__vaultCall',call);
    await page.addInitScript(()=>{
      const vault={};for(const method of ['state','migration','choose','unlock','lock','prepareMigration','completeMigration','cancelMigration','beginBatch','abortBatch','commitBatch','begin','append','finish','abort','info','read','list','remove'])vault[method]=a=>__vaultCall(method,a);
      const files={};for(const method of ['begin','append','finish','abort','save','share','print','openLink'])files[method]=async()=>({});
      window.Capacitor={isNativePlatform:()=>true,Plugins:{WorkflowFiles:files,WorkflowVault:vault}};
    });
    await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>window.WFPNativeVault&&!WFPNativeVault.gate.blocked&&window.__wfpdf&&window.PDFLib);
    let expected,id;
    await t.test('internal standard boots without SD, preserves source handler and injects storage control',async()=>{
      ({expected,id}=await page.evaluate(async()=>{
        const pdf=await PDFLib.PDFDocument.create();pdf.addPage();const bytes=await pdf.save();
        const [doc]=await __wfpdf.importDateien([new File([bytes],'Portable.pdf',{type:'application/pdf'})],null,{still:true});
        await WFP.DB.put('files',{id:doc.id+'~original',bytes:new Uint8Array([7,8]),name:'original.png'});
        await WFP.DB.put('files',{id:'ue:'+doc.id+':de-ru',job:{page:5,texte:['Имя']}});
        localStorage.setItem('wfpdf_einst_v1',JSON.stringify({schluessel:{mistral:'synthetic-device-secret'},kiOk:{mistral:true},ueVon:'de',ueNach:'ru'}));
        __wfpdf.dlg.einstellungen();return {id:doc.id,expected:Array.from(bytes)};
      }));
      await page.waitForSelector('#stNativeVault');assert.equal(fixture.primary,null);
    });
    await t.test('explicit transfer switches only after encrypted destination and real index transaction; survives reload',async()=>{
      await page.click('#stNativeVault');await page.locator('.native-vault-dialog button').filter({hasText:'Ordner wählen'}).click();
      await page.locator('.native-vault-dialog button').filter({hasText:'Übernahme starten'}).click();
      await page.waitForFunction(()=>window.WFPNativeVault&&!WFPNativeVault.gate.blocked&&window.__wfpdf?.S.docs.some(d=>d.name==='Portable'));
      await page.waitForFunction(()=>!document.querySelector('.native-vault-dialog'));
      assert.equal(fixture.primary,'target');assert.equal(fixture.migration,null);
      const result=await page.evaluate(async id=>{
        const request=indexedDB.open('WorkflohPDF1',3);const db=await new Promise((r,j)=>{request.onsuccess=()=>r(request.result);request.onerror=()=>j(request.error);});
        const raw=await new Promise((r,j)=>{const q=db.transaction('files').objectStore('files').get(id);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});db.close();
        return {raw,bytes:Array.from(await WFP.DB.getFile(id)),photo:Array.from((await WFP.DB.get('files',id+'~original')).bytes),page:(await WFP.DB.get('files','ue:'+id+':de-ru')).job.page};
      },id);
      assert.equal(result.raw.bytes,undefined);assert.equal(result.raw.__wfpVault.location,'target');assert.deepEqual(result.bytes,expected);assert.deepEqual(result.photo,[7,8]);assert.equal(result.page,5);
      const prefs=await page.evaluate(async()=> (await new WFPVaultRecords(Capacitor.Plugins.WorkflowVault).load('target','settings','workflow-preferences-v1')).record);
      assert.equal(JSON.stringify(prefs).includes('synthetic-device-secret'),false);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('wfpdf_einst_v1')).schluessel.mistral),'synthetic-device-secret');
    });
    await t.test('locked restart holds library access until explicit unlock, never erases the real index',async()=>{
      fixture.unlocked=false;await page.reload();await page.waitForSelector('.native-vault-dialog');
      assert.equal(await page.evaluate(()=>WFPNativeVault.gate.blocked),true);
      await page.locator('.native-vault-dialog button').filter({hasText:'Entsperren'}).click();
      await page.waitForFunction(()=>!WFPNativeVault.gate.blocked&&__wfpdf.S.docs.some(d=>d.name==='Portable'));
      assert.deepEqual(await page.evaluate(async id=>Array.from(await WFP.DB.getFile(id)),id),expected);
    });
    await t.test('cleared internal index rebuilds from primary vault with original and separate job intact',async()=>{
      await page.evaluate(async()=>{
        const q=indexedDB.open('WorkflohPDF1',3),db=await new Promise(r=>q.onsuccess=()=>r(q.result));
        await new Promise((r,j)=>{const tx=db.transaction(['folders','docs','files','texte','vektoren'],'readwrite');for(const s of ['folders','docs','files','texte','vektoren'])tx.objectStore(s).clear();tx.oncomplete=r;tx.onabort=()=>j(tx.error);});db.close();
      });
      await page.reload();await page.waitForFunction(()=>window.WFPNativeVault&&!WFPNativeVault.gate.blocked&&__wfpdf?.S.docs.some(d=>d.name==='Portable'));
      const result=await page.evaluate(async id=>({bytes:Array.from(await WFP.DB.getFile(id)),original:Array.from((await WFP.DB.get('files',id+'~original')).bytes),job:(await WFP.DB.get('files','ue:'+id+':de-ru')).job.page}),id);
      assert.deepEqual(result.bytes,expected);assert.deepEqual(result.original,[7,8]);assert.equal(result.job,5);
    });
    await t.test('unreachable vault blocks empty translation-job overwrite and keeps durable job',async()=>{
      fixture.failRead=true;
      const failure=await page.evaluate(async id=>{
        const job='ue:'+id+':de-ru';let read='',write='';
        try{await WFP.DB.get('files',job);}catch(e){read=e.message;}
        try{await WFP.DB.put('files',{id:job,job:{page:0}});}catch(e){write=e.message;}
        return {read,write,blocked:WFPNativeVault.gate.blocked};
      },id);
      assert.match(failure.read,/VAULT_FOLDER_UNAVAILABLE/);assert.match(failure.write,/VAULT_RECOVERY_REQUIRED/);assert.equal(failure.blocked,true);
      fixture.failRead=false;await page.locator('.native-vault-dialog button').filter({hasText:'Entsperren'}).click();await page.waitForFunction(()=>!WFPNativeVault.gate.blocked);
      assert.equal(await page.evaluate(async id=>(await WFP.DB.get('files','ue:'+id+':de-ru')).job.page,id),5);
    });
    await page.close();
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
