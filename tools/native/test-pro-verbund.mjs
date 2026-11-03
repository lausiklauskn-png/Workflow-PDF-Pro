// Real bundled core, IndexedDB, normal export dialogs and backup UI. Native
// file/vault methods are protocol fixtures here, not two installed Pro apps.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {PDFDocument} from 'pdf-lib';
import {root} from './prepare-web.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const windowsBridge=await readFile(new URL('../../windows/bridge/capacitor-tauri.js',import.meta.url),'utf8');
const pdf=await PDFDocument.create();pdf.addPage([300,400]);const pdfBytes=Buffer.from(await pdf.save());
const seed=(id='family-a',data=pdfBytes,name='A.pdf',mime='application/pdf')=>({entryId:'entry-'+id,data,
  vertrag:{vertrag:'familienakte-uebergabe/1',id,quelle:'familienakte',ziel:'workflow-pdf-pro',dokumentId:'family-doc-'+id,name,mime,groesse:data.length,sha256:sha(data)}});

test('Pro collaboration with durable ordinary library and exact outgoing versions',async t=>{
  const base=process.env.WFP_TEST_BUNDLE||join(root,'www');
  const server=createServer(async(req,res)=>{try{
    const path=resolve(base,'.'+new URL(req.url,'http://localhost').pathname),file=path===base?join(path,'index.html'):path;
    if(path!==base&&!path.startsWith(base+'/'))throw Error('outside');
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
  const browser=await chromium.launch(process.env.WFP_CHROMIUM?{executablePath:process.env.WFP_CHROMIUM}:{});t.after(()=>browser.close());
  const address='http://127.0.0.1:'+server.address().port+'/';
  async function setup(options={}){
    const f={connected:true,open:true,root:'shared-vault',items:[seed()],marks:[],sent:new Map(),calls:[],ackChecks:[],sendChecks:[],mode:'ok',confirmed:false,os:0,saves:[],tickets:new Map(),...options};
    const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
    if(options.windows)await page.route('https://tauri.localhost/**',async route=>{
      const pathname=new URL(route.request().url()).pathname,file=pathname==='/'?'/index.html':pathname;
      try {await route.fulfill({body:await readFile(join(base,file)),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream'});}
      catch {await route.fulfill({status:404,body:''});}
    });
    const state=()=>({gewaehlt:f.connected,offen:f.open&&f.connected,kennung:f.root,pfad:'Erfundener Testordner',gemerkt:false,uebergaben:true});
    await page.exposeFunction('__proNative',async(method,a={},proof)=>{
      f.calls.push([method,a]);
      if(method==='state')return {configured:false,internal:true};
      if(method==='migration')return {location:null};
      if(method==='tresorZustand')return state();
      if(method==='tresorVerbinden'){if(f.verbindenFehler){const e=f.verbindenFehler;f.verbindenFehler=null;throw Error(e);}f.connected=true;f.open=true;return {...state(),ebeneHoeher:!!f.ebeneHoeher};}
      if(method==='tresorSperren'){f.open=false;return state();}
      if(method==='tresorUebergabe'){
        if(!f.open||a.vaultId!==f.root)throw Error('TRESOR_UEBERGABE_FREMD');
        if(a.aktion==='eingang')return {items:f.items.filter(x=>!f.marks.includes(x.entryId)).map(({entryId,vertrag})=>({entryId,vertrag}))};
        if(a.aktion==='lesen'){
          const row=f.items.find(x=>x.entryId===a.entryId),data=Buffer.from(row.data);if(f.mode==='corrupt')data[0]^=1;
          return {entryId:row.entryId,vertrag:row.vertrag,dataBase64:data.toString('base64')};
        }
        if(a.aktion==='quittieren'){
          f.ackChecks.push(proof);if(f.mode==='ackfail')throw Error('ACK_FAILED');f.marks.push(a.entryId);return {stand:'im-eingang'};
        }
        if(a.aktion==='senden'){
          f.sendChecks.push(proof);if(f.mode==='sendfail')throw Error('SEND_FAILED');
          const m=a.vertrag,data=Buffer.from(a.dataBase64,'base64');assert.equal(sha(data),m.sha256);assert.equal(data.length,m.groesse);
          if(f.sent.has(m.id))assert.deepEqual(f.sent.get(m.id).vertrag,m);
          const entry={id:'sent-'+m.id,schreiber:'workflow-pdf-pro',name:m.name,art:m.mime,groesse:m.groesse,sha256:m.sha256,verschluesselung:'fpt1',verweis:'Uebergaben/'+m.id+'/'+m.name};
          f.sent.set(m.id,{vertrag:m,data,entry});return f.mode==='wrongsend'?{...entry,sha256:'0'.repeat(64)}:entry;
        }
        if(a.aktion==='stand')return {bestaetigt:f.confirmed};
      }
      if(method==='begin'){const id='ticket-'+f.tickets.size;f.tickets.set(id,{name:a.name,parts:[],size:0});return {id};}
      if(method==='append'){
        if(f.blockAppend){f.blockAppend=false;f.appendStarted();await new Promise(r=>{f.releaseAppend=r;});}
        const x=f.tickets.get(a.id),part=Buffer.from(a.data,'base64');assert.equal(a.offset,x.size);x.parts.push(part);x.size+=part.length;return {};
      }
      if(method==='finish'){assert.equal(a.size,f.tickets.get(a.id).size);return {};}
      if(method==='save'){const x=f.tickets.get(a.id);f.saves.push({name:x.name,bytes:Buffer.concat(x.parts)});return {saved:true};}
      if(method==='abort'){f.tickets.delete(a.id);return {};}
      if(method==='share'){f.os++;return {opened:true,deliveryConfirmed:false};}
      if(method==='appInfo')return {version:'1.0.11'};
      if(['print','openLink'].includes(method))return {};
      throw Error('Unknown native method '+method);
    });
    await page.addInitScript(({windowsBridge})=>{
      // Inspect durable IDB state at the native boundary without entering the
      // adapter's operation lock again. The browser fixture never supplies ACK
      // evidence to the implementation; it only records assertions for the test.
      async function receiptRows(){const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('WorkflowProTransfers1',1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
        try{return await new Promise((resolve,reject)=>{const tx=db.transaction('receipts'),q=tx.objectStore('receipts').getAll();let rows; q.onsuccess=()=>rows=q.result.map(x=>x.record);tx.oncomplete=()=>resolve(rows);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
      const vault={};for(const m of ['state','migration','tresorZustand','tresorVerbinden','tresorSperren'])vault[m]=a=>__proNative(m,a);
      vault.tresorUebergabe=async a=>{
        let proof=null;
        if(a.aktion==='quittieren'){
          const rows=await receiptRows(),r=rows.find(r=>r.kind==='eingang'&&r.sha256===a.sha256&&r.stand==='gespeichert');
          const doc=r&&await WFP.DB.get('docs',r.docId),bytes=r&&await WFP.DB.getFile(r.docId),original=r&&await WFP.DB.get('files',r.docId+'~original');
          proof=!!(r&&doc&&bytes&&original&&await WFPProTransferStore.hash(bytes)===r.pdfHash&&await WFPProTransferStore.hash(original.bytes)===a.sha256);
        }
        if(a.aktion==='senden'){
          const rows=await receiptRows(),r=rows.find(r=>r.kind==='ausgang'&&r.vertrag.id===a.vertrag.id),payload=r&&await WFP.DB.get('files',r.payloadId);
          proof=!!(r&&payload&&await WFPProTransferStore.hash(payload.bytes)===a.vertrag.sha256);
        }
        return __proNative('tresorUebergabe',a,proof);
      };
      const files={};for(const m of ['begin','append','finish','abort','save','share','print','openLink','appInfo'])files[m]=a=>__proNative(m,a);
      window.Capacitor={isNativePlatform:()=>true,Plugins:{WorkflowVault:vault,WorkflowFiles:files}};
      if(windowsBridge){
        const fixture=window.Capacitor;delete window.Capacitor;
        window.__systemShares=0;
        Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
        Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{window.__systemShares++;if(window.__systemFailure)throw Error('SYSTEM_SHARE_UNAVAILABLE');}});
        window.__TAURI_INTERNALS__={invoke:async(command,args)=>{if(command!=='wfp_call')throw Error('UNKNOWN_COMMAND');return fixture.Plugins[args.plugin][args.method](args.options);}};
        (0,eval)(windowsBridge);
      }
    },{windowsBridge:options.windows?windowsBridge:null});
    await page.goto(options.windows?'https://tauri.localhost/':address);await ready(page);
    return {page,f,errors};
  }
  const ready=page=>page.waitForFunction(()=>window.__wfpdf&&window.WFPProVerbund&&!WFPNativeVault.gate.blocked);
  const receive=page=>page.evaluate(async()=>{const z=await WFPProTransfers.state();return WFPProTransfers.receive(z.kennung,(await WFPProTransfers.inbox(z.kennung))[0]);});
  async function output(page,id){
    await page.evaluate(async id=>{document.querySelectorAll('.dlg-grund').forEach(x=>x.remove());await __wfpdf.oeffneDok(id);__wfpdf.dlg.exportDialog();},id);
    await page.locator('.dlg [data-m="fest"]').click();await page.waitForSelector('.dlg [data-teilen]');
  }
  async function toFamily(page){await page.locator('.dlg [data-teilen]').click();await page.locator('#nativeProTarget [data-pro-action="familienakte"]').click();}
  const outbox=page=>page.evaluate(()=>WFPProTransfers.outbox());
  async function backup(page){
    await page.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(x=>x.close());document.querySelectorAll('.dlg-grund').forEach(x=>x.remove());__wfpdf.dlg.sicherungDialog();});
    await page.fill('#siPw1','Erfundene Sicherung 2026');await page.fill('#siPw2','Erfundene Sicherung 2026');await page.click('#siErstellen');
    await page.waitForSelector('[data-wfp-sicherung-lauf] [data-pro-fortschritt="fertig"],[data-wfp-sicherung-lauf] [data-pro-fortschritt="fehler"]');
    assert.equal(await page.locator('[data-wfp-sicherung-lauf] [data-pro-fortschritt="fertig"]').count(),1,await page.textContent('[data-wfp-sicherung-lauf]'));
  }
  async function restore(page,bytes,failed=false){
    await page.evaluate(()=>__wfpdf.dlg.sicherungDialog());await page.setInputFiles('#siDatei',{name:'Probe.wfps',mimeType:'application/octet-stream',buffer:bytes});
    await page.fill('#siPwZ','Erfundene Sicherung 2026');await page.click('#siZurueck');
    await page.waitForSelector('[data-wfp-sicherung-lauf] [data-pro-fortschritt="fertig"],[data-wfp-sicherung-lauf] [data-pro-fortschritt="fehler"]');
    assert.equal(await page.locator('[data-wfp-sicherung-lauf] [data-pro-fortschritt="'+(failed?'fehler':'fertig')+'"]').count(),1,await page.textContent('[data-wfp-sicherung-lauf]'));
  }
  await t.test('connection is optional and does not move the own library or import files',async()=>{
    const {page,f,errors}=await setup({connected:false});await page.evaluate(()=>WFPProVerbund.dialog());
    assert.match(await page.textContent('#nativeProVerbund'),/Keine Verbindung/);await page.click('#nativeProVerbund [data-pro-action="connect"]');
    await page.waitForSelector('#nativeProVerbund [data-pro-entry]');assert.equal(await page.evaluate(()=>__wfpdf.S.docs.length),0);
    assert.equal(f.marks.length,0);assert.equal(f.sent.size,0);assert.equal(await page.evaluate(()=>WFPNativeVault.aktiv()),null);assert.deepEqual(errors,[]);await page.close();
  });
  await t.test('wrong folder for the shared vault: plain message, no new vault; app folder resolved one level up is reported',async()=>{
    const {page,f,errors}=await setup({connected:false,verbindenFehler:'TRESOR_ORDNER_APP_ORDNER'});await page.evaluate(()=>WFPProVerbund.dialog());
    assert.equal(await page.locator('#nativeProVerbund [data-wo-liegt-was]').count(),1,'„Wo liegt was?“ in the Pro-Apps dialog');
    await page.click('#nativeProVerbund [data-pro-action="connect"]');
    await page.waitForFunction(()=>/App-Ordner im Tresor.*tresorordner\.json/.test(document.querySelector('[data-pro-status]')?.textContent||''));
    assert.equal(f.connected,false);
    f.ebeneHoeher=true;await page.click('#nativeProVerbund [data-pro-action="connect"]');
    await page.waitForFunction(()=>/Verbunden ist jetzt der Ordner darüber/.test(document.querySelector('[data-pro-status]')?.textContent||''));
    assert.deepEqual(errors,[]);await page.close();
  });
  await t.test('only selected incoming file is acknowledged after ordinary PDF and original are committed',async()=>{
    const {page,f,errors}=await setup({items:[seed(),seed('family-b',pdfBytes,'B.pdf')]});await page.evaluate(()=>WFPProVerbund.dialog());
    await page.locator('[data-pro-entry="entry-family-a"] input').check();await page.click('#nativeProVerbund [data-pro-action="receive"]');
    await page.waitForFunction(()=>document.querySelector('[data-pro-status]')?.textContent.includes('Auswahl gespeichert'));
    assert.deepEqual(f.marks,['entry-family-a']);assert.deepEqual(f.ackChecks,[true]);
    const docs=await page.evaluate(()=>__wfpdf.S.docs.map(d=>({name:d.name,pages:d.pages.length,checked:!!d.pruefung})));
    assert.deepEqual(docs,[{name:'A',pages:1,checked:false}]);assert.deepEqual(errors,[]);await page.close();
  });
  await t.test('incoming controls appear only when the whole dialog is ready',async()=>{
    const {page,f}=await setup();
    await page.evaluate(()=>{
      const original=WFPProTransfers;let first=true;
      window.WFPProTransfers={...original,outbox:()=>{if(!first)return original.outbox();first=false;return new Promise(resolve=>{window.__finishOutbox=()=>original.outbox().then(resolve);});}};
    });
    // Reload just the UI adapter to bind the delayed outgoing-store fixture.
    await page.addScriptTag({url:address+'native/native-pro-verbund.js'});
    await page.evaluate(()=>{window.__dialogReady=false;void WFPProVerbund.dialog().then(()=>window.__dialogReady=true);});
    await page.waitForFunction(()=>typeof window.__finishOutbox==='function');
    assert.equal(await page.locator('#nativeProVerbund [data-pro-entry]').count(),0);
    await page.evaluate(()=>__finishOutbox());await page.waitForFunction(()=>__dialogReady);
    await page.locator('[data-pro-entry="entry-family-a"] input').check();await page.click('#nativeProVerbund [data-pro-action="receive"]');
    await page.waitForFunction(()=>document.querySelector('[data-pro-status]')?.textContent.includes('Auswahl gespeichert'));
    assert.deepEqual(f.marks,['entry-family-a']);await page.close();
  });
  await t.test('ordinary library share opens the optional target with its stored source',async()=>{
    const form=await PDFDocument.create();form.addPage([595,842]);form.addPage([595,842]);
    const field=form.getForm().createTextField('Name');field.setText('Müller');field.addToPage(form.getPage(0),{x:50,y:650,width:220,height:25});
    const {page,f}=await setup({items:[seed('family-a',Buffer.from(await form.save()))]});const {id}=await receive(page);
    await page.evaluate(id=>{void __wfpdf.dlg.teilenDocs([id]);},id);
    await page.waitForSelector('#nativeProTarget');await page.click('#nativeProTarget [data-pro-action="familienakte"]');
    await page.waitForSelector('#nativeProTarget',{state:'detached'});
    const rows=await outbox(page);assert.equal(rows.length,1);assert.equal(rows[0].vertrag.bezug,'family-a');assert.equal(f.sent.size,1);await page.close();
  });
  await t.test('Windows system sharing cannot bypass the Pro target and preserves explicit OS fallback',async()=>{
    const {page,f,errors}=await setup({windows:true});const {id}=await receive(page);
    await page.evaluate(id=>{void __wfpdf.dlg.teilenDocs([id]);},id);
    await page.waitForFunction(()=>document.querySelector('#nativeProTarget')||window.__systemShares>0);
    assert.equal(await page.locator('#nativeProTarget').count(),1,'Windows must show the Pro target before system sharing');
    await page.click('#nativeProTarget [data-pro-action="familienakte"]');await page.waitForSelector('#nativeProTarget',{state:'detached'});
    assert.equal(f.sent.size,1);assert.equal(await page.evaluate(()=>__systemShares),0);assert.equal((await outbox(page))[0].vertrag.bezug,'family-a');
    await page.evaluate(id=>{void __wfpdf.dlg.teilenDocs([id]);},id);await page.click('#nativeProTarget [data-pro-action="os"]');
    await page.waitForFunction(()=>__systemShares===1);assert.equal(f.os,0);assert.equal((await outbox(page))[0].stand,'weitergegeben');
    await page.evaluate(id=>{window.__systemFailure=true;window.__osFallbackDone=false;void __wfpdf.dlg.teilenDocs([id]).then(()=>{window.__osFallbackDone=true;});},id);await page.click('#nativeProTarget [data-pro-action="os"]');
    await page.waitForFunction(()=>window.__osFallbackDone);assert.equal(f.os,1);
    assert.deepEqual(errors,[]);await page.close();
  });
  await t.test('failed acknowledgement and cold restart preserve later edits without duplicate intake',async()=>{
    const {page,f}=await setup({mode:'ackfail'});await assert.rejects(receive(page),/ACK_FAILED/);
    const id=await page.evaluate(async()=>{const d=__wfpdf.S.docs[0];d.name='Danach bearbeitet';await WFP.DB.put('docs',d);return d.id;});
    await page.reload();await ready(page);f.mode='ok';const result=await receive(page);
    assert.equal(result.id,id);assert.equal(result.repeated,true);assert.deepEqual(await page.evaluate(()=>__wfpdf.S.docs.map(d=>d.name)),['Danach bearbeitet']);assert.equal(f.marks.length,1);await page.close();
  });
  await t.test('changed bytes and unsupported content stay unacknowledged',async()=>{
    const a=await setup({mode:'corrupt'});await assert.rejects(receive(a.page),/PRO_BYTES_CHANGED/);assert.deepEqual(a.f.marks,[]);assert.equal(await a.page.evaluate(()=>__wfpdf.S.docs.length),0);await a.page.close();
    const b=await setup({items:[seed('unsupported',Buffer.from('<p>Erfundener Inhalt</p>'),'A.html','text/html')]});await assert.rejects(receive(b.page),/PRO_IMPORT_FAILED/);assert.deepEqual(b.f.marks,[]);assert.equal(await b.page.evaluate(()=>__wfpdf.S.docs.length),0);await b.page.close();
  });
  await t.test('normal prepared PDF retains its selected source when another editor document becomes current',async()=>{
    const {page,f}=await setup();const {id}=await receive(page);await output(page,id);
    await page.evaluate(async bytes=>{const [d]=await __wfpdf.importDateien([new File([new Uint8Array(bytes)],'B.pdf',{type:'application/pdf'})],null,{still:true});__wfpdf.S.doc=d;},Array.from(pdfBytes));
    await toFamily(page);await page.waitForSelector('#nativeProTarget',{state:'detached'});
    const [sent]=f.sent.values();assert.equal(sent.vertrag.dokumentId,'family-doc-family-a');assert.equal(sent.vertrag.bezug,'family-a');assert.equal(sent.vertrag.mime,'application/pdf');assert.notEqual(sent.vertrag.sha256,sha(pdfBytes));
    assert.deepEqual(f.sendChecks,[true]);assert.equal((await PDFDocument.load(sent.data)).getPageCount(),1);assert.equal((await outbox(page))[0].stand,'weitergegeben');assert.equal(f.os,0);await page.close();
  });
  await t.test('outgoing restart retries the exact committed bytes and only recipient mark releases them',async()=>{
    const {page,f}=await setup({mode:'sendfail'});const {id}=await receive(page);await output(page,id);await toFamily(page);
    await page.waitForFunction(()=>document.querySelector('#nativeProTarget [data-pro-status]')?.textContent.includes('SEND_FAILED'));
    const [before]=await outbox(page);assert.equal(before.stand,'vorbereitet');assert.deepEqual(f.sendChecks,[true]);
    await page.reload();await ready(page);f.mode='ok';const row=await page.evaluate(id=>WFPProTransfers.retry(id),before.id);
    assert.equal(row.vertrag.id,before.vertrag.id);assert.equal(row.vertrag.sha256,before.vertrag.sha256);assert.equal(row.stand,'weitergegeben');
    assert.equal(await page.evaluate(id=>WFP.DB.get('files',id).then(Boolean),row.payloadId),true);
    f.confirmed=true;const confirmed=await page.evaluate(id=>WFPProTransfers.confirm(id),row.id);assert.equal(confirmed.stand,'im-eingang');
    assert.equal(await page.evaluate(id=>WFP.DB.get('files',id).then(Boolean),row.payloadId),false);assert.equal(await page.evaluate(()=>__wfpdf.S.docs.length),1);await page.close();
  });
  await t.test('wrong native send response cannot be shown as forwarded',async()=>{
    const {page,f}=await setup({mode:'wrongsend'});const {id}=await receive(page);await output(page,id);await toFamily(page);
    await page.waitForFunction(()=>document.querySelector('#nativeProTarget [data-pro-status]')?.textContent.includes('PRO_SEND_UNCONFIRMED'));
    assert.equal((await outbox(page))[0].stand,'vorbereitet');assert.equal(f.os,0);await page.close();
  });
  await t.test('interrupted cleanup resumes after restart without losing the confirmed receipt or source',async()=>{
    const {page,f}=await setup();const {id}=await receive(page);await output(page,id);await toFamily(page);await page.waitForSelector('#nativeProTarget',{state:'detached'});
    const [row]=await outbox(page);f.confirmed=true;
    await page.evaluate(()=>{const old=WFPNativeVault;window.WFPNativeVault={...old,withStorage:work=>old.withStorage(ctx=>work({...ctx,db:{...ctx.db,del:async()=>{throw Error('CLEANUP_INTERRUPTED');}}}))};});
    await assert.rejects(page.evaluate(id=>WFPProTransfers.confirm(id),row.id),/CLEANUP_INTERRUPTED/);
    assert.equal(await page.evaluate(id=>WFP.DB.get('files',id).then(Boolean),row.payloadId),true);
    assert.equal(await page.evaluate(async id=>(await WFPProTransferStore.snapshot()).find(r=>r.id===id).stand,row.id),'im-eingang');
    await page.reload();await ready(page);await page.evaluate(()=>WFPProVerbund.dialog());
    assert.equal(await page.evaluate(id=>WFP.DB.get('files',id).then(Boolean),row.payloadId),false);
    assert.equal((await outbox(page))[0].stand,'im-eingang');assert.equal(await page.evaluate(()=>__wfpdf.S.docs.length),1);await page.close();
  });
  await t.test('operating system share remains an explicit separate choice',async()=>{
    const {page,f}=await setup();const {id}=await receive(page);await output(page,id);await page.locator('.dlg [data-teilen]').click();
    await page.click('#nativeProTarget [data-pro-action="os"]');await page.waitForFunction(()=>document.querySelector('#nativeFileStatus')?.textContent.includes('nicht bestätigt'));
    assert.equal(f.os,1);assert.equal(f.sent.size,0);assert.deepEqual(await outbox(page),[]);await page.close();
  });
  await t.test('changing library after preparing output cannot assign it to the new scope',async()=>{
    const {page,f}=await setup();const {id}=await receive(page);await output(page,id);
    await page.evaluate(()=>{const old=WFPNativeVault;window.WFPNativeVault={...old,aktiv:()=>({id:'other-library'}),withStorage:work=>old.withStorage(ctx=>work({...ctx,state:{id:'other-library'}}))};});
    await toFamily(page);await page.waitForFunction(()=>!document.querySelector('#nativeProTarget')||document.querySelector('#nativeProTarget [data-pro-status]')?.textContent.includes('Arbeitsablage hat gewechselt'));
    assert.equal(f.sent.size,0);assert.equal(f.sendChecks.length,0);assert.match(await page.textContent('#nativeProTarget [data-pro-status]'),/Arbeitsablage hat gewechselt/);await page.close();
  });
  await t.test('pending outgoing bytes survive encrypted backup and partial backup never accepts a receipt',async()=>{
    const {page,f}=await setup({mode:'sendfail'});const {id}=await receive(page);await output(page,id);await toFamily(page);
    await page.waitForFunction(()=>document.querySelector('#nativeProTarget [data-pro-status]')?.textContent.includes('SEND_FAILED'));
    const [row]=await outbox(page);await backup(page);const encrypted=f.saves.find(x=>x.name.endsWith('.wfps')).bytes;assert.ok(encrypted.subarray(0,19).includes(Buffer.from('WFPDF-SICHERUNG-3')));
    const target=await setup();await restore(target.page,encrypted);
    await target.page.waitForFunction(()=>window.__wfpdf&&__wfpdf.S.docs.length===1);
    assert.deepEqual(await outbox(target.page),[row]);const retried=await target.page.evaluate(id=>WFPProTransfers.retry(id),row.id);
    assert.equal(retried.stand,'weitergegeben');assert.equal([...target.f.sent.values()][0].vertrag.sha256,row.vertrag.sha256);
    const broken=await setup();await restore(broken.page,encrypted.subarray(0,encrypted.length-25),true);
    assert.deepEqual(await outbox(broken.page),[]);assert.equal(await broken.page.evaluate(id=>WFP.DB.get('files',id).then(Boolean),row.payloadId),false);
    await broken.page.close();await target.page.close();await page.close();
  });
  await t.test('library pause waits until backup has streamed its selected receipt scope',async()=>{
    const {page,f}=await setup();await receive(page);
    const started=new Promise(r=>{f.appendStarted=r;});f.blockAppend=true;
    const complete=backup(page);
    try{
      await Promise.race([started,new Promise((_,reject)=>setTimeout(()=>reject(Error('backup did not start')),10000))]);
      await page.evaluate(()=>{window.pauseFinished=false;void WFPNativeVault.gate.pause().then(()=>{window.pauseFinished=true;});});
      assert.equal(await page.evaluate(()=>window.pauseFinished),false,'storage switch must wait for the whole backup lease');
    }finally{f.releaseAppend?.();}
    await complete;await page.waitForFunction(()=>window.pauseFinished);assert.equal(f.saves.filter(x=>x.name.endsWith('.wfps')).length,1);await page.close();
  });
  await t.test('all four native languages fit a narrow cooperation dialog',async()=>{
    const {page,errors}=await setup({items:[seed('long',pdfBytes,'A'.repeat(200)+'.pdf')]});await page.setViewportSize({width:360,height:740});
    for(const [lang,title] of [['de','Zusammenarbeit'],['en','Work with'],['ru','Совместная работа'],['ar','التعاون']]){
      await page.evaluate(lang=>{WFP.Sprache.setzen(lang);return WFPProVerbund.dialog();},lang);
      const actual=await page.textContent('#nativeProVerbund h2');assert.ok(actual.includes(title),lang+': '+actual);
      assert.equal(await page.evaluate(()=>{const d=document.getElementById('nativeProVerbund');return d.scrollWidth<=d.clientWidth+1;}),true,lang+' must not overflow');
      assert.equal((await page.textContent('#nativeProVerbund')).includes('[object Object]'),false);
    }
    assert.deepEqual(errors,[]);await page.close();
  });
});
