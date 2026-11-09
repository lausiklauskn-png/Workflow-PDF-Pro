// Pro-App-Verbund (Vorschau, Klaus 2026-11-09): byte-gleiche Karte aus BookLedgerPro im App-Paket, Einstieg in den
// Einstellungen mit ⓘ, Tipp öffnet die Karte im Vollbild-Rahmen (kein neues Fenster), Schließen und Android-Zurück
// (WFPNativeNavigation.back) schließen ihn. Gegenprobe im Lauf: als PWA (ohne App-Brücke) gibt es den Eintrag nicht.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {chromium} from 'playwright-core';
import {root,digest,nativeFiles} from './prepare-web.mjs';

test('Pro-App-Verbund: Pin, Paket, Einstieg, Vollbild-Rahmen',async t=>{
  const pin=JSON.parse(await readFile(join(root,'native/pro-verbund.herkunft.json'),'utf8'));
  await t.test('Karte byte-gleich zum Pin und im App-Paket',async()=>{
    assert.equal(pin.quelle,'lausiklauskn-png/BookLedgerPro');assert.equal(pin.datei,'assets/pro-verbund.html');
    assert.equal(digest(await readFile(join(root,'native/pro-verbund.html'))),pin.sha256);
    assert.equal(digest(await readFile(join(root,'www/native/pro-verbund.html'))),pin.sha256,'www/ fehlt oder weicht ab (vorher npm run build:web)');
    assert.ok(nativeFiles.includes('pro-verbund.html')&&nativeFiles.includes('native-verbund-karte.js'));
    const html=await readFile(join(root,'www/index.html'),'utf8');
    assert.ok(html.includes('native/native-verbund-karte.js?v='+digest(await readFile(join(root,'native/native-verbund-karte.js')))));
  });
  const base=join(root,'www');
  const server=createServer(async(req,res)=>{try{
    const path=resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(path!==base&&!path.startsWith(base+'/'))throw Error();
    const file=path===base?join(path,'index.html'):path;
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch(process.env.WFP_CHROMIUM?{executablePath:process.env.WFP_CHROMIUM}:{});
  t.after(()=>{browser.close();server.close();});
  const fx={records:new Map(),batch:null,tickets:new Map()};const key=(s,i)=>JSON.stringify([s,i]);
  async function call(method,a={}){
    const view=()=>fx.batch||fx.records;
    if(method==='state')return {configured:false,internal:true};
    if(method==='migration')return {location:null};
    if(method==='beginBatch'){fx.batch=new Map(fx.records);return {started:true};}
    if(method==='abortBatch'){fx.batch=null;return {aborted:true};}
    if(method==='commitBatch'){fx.records=fx.batch;fx.batch=null;return {saved:true};}
    if(method==='begin'){const ticket=randomUUID();fx.tickets.set(ticket,{store:a.store,id:a.id,data:Buffer.alloc(0)});return {ticket};}
    if(method==='append'){const it=fx.tickets.get(a.ticket);it.data=Buffer.concat([it.data,Buffer.from(a.data,'base64')]);return {ok:true};}
    if(method==='finish'){const it=fx.tickets.get(a.ticket);it.hash=createHash('sha256').update(it.data).digest('hex');view().set(key(it.store,it.id),it);fx.tickets.delete(a.ticket);return {saved:true,size:it.data.length,hash:it.hash};}
    if(method==='abort'){fx.tickets.delete(a.ticket);return {};}
    if(method==='info'){const it=view().get(key(a.store,a.id));return it?{exists:true,size:it.data.length,hash:it.hash}:{exists:false};}
    if(method==='read'){const it=view().get(key(a.store,a.id));return {data:it.data.subarray(a.offset,a.offset+262144).toString('base64')};}
    if(method==='list')return {ids:[...view().keys()].map(k=>JSON.parse(k)).filter(k=>k[0]===a.store).map(k=>k[1])};
    if(method==='remove'){view().delete(key(a.store,a.id));return {saved:true};}
    if(method==='recoveryInfo')return {exists:false};
    if(method==='tresorZustand')return {gewaehlt:false,offen:false};
    if(method==='check')return {status:'current',version:'1.0.14',installiert:'1.0.14'};
    return {};
  }
  const names=['state','migration','choose','unlock','lock','prepareMigration','completeMigration','cancelMigration','beginBatch','abortBatch','commitBatch','begin','append','finish','abort','info','read','list','remove','recoveryInfo','createRecovery','ordnerOeffnen','tresorZustand','tresorEinziehen','tresorVerzeichnis','tresorSperren','tresorVerbinden'];
  async function seite(app,lang='de'){
    const page=await browser.newPage({viewport:{width:1000,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('__vaultCall',call);
    await page.addInitScript(([app,names,lang])=>{
      if(lang!=='de')localStorage.setItem('wfpdf_sprache_v1',JSON.stringify({lang}));
      if(!app)return;
      const wrap=list=>Object.fromEntries(list.map(m=>[m,async a=>{try{return await __vaultCall(m,a);}catch(e){throw{code:'UNKNOWN'};}}]));
      const files={};for(const m of ['begin','append','finish','abort','save','share','print','openLink'])files[m]=async()=>({});
      files.appInfo=async()=>({version:'1.0.14'});
      window.Capacitor={isNativePlatform:()=>true,Plugins:{WorkflowFiles:files,WorkflowVault:wrap(names),WorkflowUpdates:wrap(['check','openDownload'])}};
    },[app,names,lang]);
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(app=>window.__wfpdf&&(!app||window.WFPNativeVault&&!WFPNativeVault.gate.blocked),app);
    await page.evaluate(()=>__wfpdf.dlg.einstellungen());
    await page.waitForSelector('#stSicherung');await page.waitForTimeout(300);
    return {page,errors};
  }
  await t.test('Gegenprobe: als PWA (ohne App-Brücke) kein Eintrag',async()=>{
    const {page}=await seite(false);
    assert.equal(await page.locator('#stNativeVerbundKarte').count(),0);await page.close();
  });
  await t.test('App: Eintrag mit ⓘ, Tipp öffnet Rahmen mit #graph, Schließen und Zurück schließen',async()=>{
    const {page,errors}=await seite(true);
    const b=page.locator('#stNativeVerbundKarte');
    assert.equal(await b.count(),1,'Eintrag „Pro-App-Verbund (Vorschau)“ fehlt in den Einstellungen');
    assert.ok(await b.isVisible(),'Eintrag nicht sichtbar');
    assert.equal((await b.textContent()).trim(),'Pro-App-Verbund (Vorschau)');
    const info=page.locator('[data-pro-info="verbund-karte"]');assert.equal(await info.count(),1,'ⓘ fehlt');
    await info.click();
    assert.match(await page.locator('[data-pro-info-inhalt="verbund-karte"]').innerText(),/BookLedgerPro, Private Brain Pro und der Familienakte/);
    const seitenVorher=browser.contexts().reduce((n,c)=>n+c.pages().length,0);
    await b.click();
    const d=page.locator('dialog#nativeVerbundKarte[open]');await d.waitFor({timeout:5000});
    const box=await d.boundingBox();assert.ok(box.width>=990&&box.height>=790,'kein Vollbild: '+JSON.stringify(box));
    const frame=page.frameLocator('[data-verbund-rahmen]');
    await frame.locator('#graph').waitFor({state:'attached',timeout:10000});
    assert.ok(await frame.locator('#graph').count()===1,'#graph fehlt im Rahmen');
    assert.equal(browser.contexts().reduce((n,c)=>n+c.pages().length,0),seitenVorher,'ein neues Fenster ging auf');
    await page.locator('[data-verbund-zu]').click();
    await page.waitForFunction(()=>!document.getElementById('nativeVerbundKarte'));
    await b.click();await d.waitFor();
    assert.equal(await page.evaluate(()=>window.WFPNativeNavigation?.back()),true,'Zurück nicht abgefangen');
    await page.waitForFunction(()=>!document.getElementById('nativeVerbundKarte'));
    assert.ok(await page.locator('#stSicherung').isVisible(),'Zurück schloss mehr als die Karte');
    assert.deepEqual(errors,[]);await page.close();
  });
  await t.test('App (en): Eintrag auf Englisch',async()=>{
    const {page}=await seite(true,'en');
    assert.equal((await page.locator('#stNativeVerbundKarte').textContent()).trim(),'Pro app network (preview)');await page.close();
  });
});
