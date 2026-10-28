// Sicherung gestreamt (Leitfaden § 3, Klaus 2026-10-28: Absturz bei ~50 MB). Teil A rechnet ohne Browser (Format, Schloss,
// Beschädigung). Teil B fährt die App mit gestellter Brücke: ein 60-MB-Dokument wird gesichert (jeder Schreibaufruf klein,
// Speicherspitze gemessen), in einer frischen App zurückgeholt (Bytes gleich) — und eine alte JSON-Sicherung holt weiter der Kern.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,extname} from 'node:path';
import {createHash,randomUUID,randomBytes,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {chromium} from 'playwright-core';
import {PDFDocument} from 'pdf-lib';
import {root} from './prepare-web.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
async function codec(){
  const ctx={crypto:webcrypto,TextEncoder,TextDecoder,btoa,atob,setTimeout,Blob,Uint8Array,ArrayBuffer,DataView};ctx.globalThis=ctx;
  vm.runInNewContext(await readFile(join(root,'native/native-sicherung.js'),'utf8'),ctx);return ctx.WFPSicherung2;
}
function speicher(docs,dateien,originale={}){
  return {all:async s=>s==='folders'?[{id:'o1',name:'Ordner'}]:docs.map(d=>structuredClone(d)),getFile:async id=>dateien[id]||null,
    get:async(s,id)=>{const k=id.replace('~original','');return originale[k]&&id.endsWith('~original')?{id,name:'Foto.jpg',bytes:originale[k]}:null;}};
}

test('A · Format ohne Browser: hin und zurück, Stücke klein, Passwort, Beschädigung',async()=>{
  const S=await codec();
  const gross=new Uint8Array(randomBytes(65536*40+123)), klein=new Uint8Array([1,2,3]), orig=new Uint8Array([9,9,9,9]);
  const docs=[{id:'d1',name:'Groß',fields:[{v:1}]},{id:'d2',name:'Klein',fields:[]},{id:'d3',name:'Ohne Datei',fields:[]}];
  const teile=[];let groesster=0;
  const r=await S.verschliessen('geheim-123',speicher(docs,{d1:gross,d2:klein},{d2:orig}),async b=>{teile.push(Uint8Array.from(b));groesster=Math.max(groesster,b.length);});
  assert.equal(r.docs,2);assert.equal(r.ohneDatei,1);assert.equal(r.originale,1);
  assert.ok(groesster<=S.STUECK+64,'kein Schreibaufruf größer als ein Stück + Rahmen ('+groesster+')');
  const datei=Buffer.concat(teile);
  assert.ok(!datei.includes(Buffer.from('Groß')),'kein Klartext (Dokumentname) in der Datei');
  const lies=b=>async(von,bis)=>new Uint8Array(b.subarray(von,bis));
  const zurueck=[];const o=await S.oeffnen('geheim-123',lies(datei),datei.length,async x=>zurueck.push(x));
  assert.equal(zurueck.length,2);assert.equal(sha(zurueck[0].bytes),sha(gross));assert.deepEqual([...zurueck[1].bytes],[1,2,3]);
  assert.deepEqual([...zurueck[1].original.bytes],[9,9,9,9]);assert.match(zurueck[1].original.name,/Foto/);
  assert.equal(o.ordner.length,1);assert.equal(o.schluss.docs,2);
  await assert.rejects(S.oeffnen('falsch-123',lies(datei),datei.length,async()=>{}),/passwort/);
  await assert.rejects(S.oeffnen('geheim-123',lies(datei.subarray(0,datei.length-40)),datei.length-40,async()=>{}),/beschaedigt|unvollstaendig/);
  const ohneSchluss=datei.subarray(0,datei.length-teile.at(-1).length);
  await assert.rejects(S.oeffnen('geheim-123',lies(ohneSchluss),ohneSchluss.length,async()=>{}),/unvollstaendig/);
  const kaputt=Buffer.from(datei);kaputt[Math.floor(kaputt.length/2)]^=1;
  await assert.rejects(S.oeffnen('geheim-123',lies(kaputt),kaputt.length,async()=>{}),/beschaedigt/);
  // zwei Stücke vertauscht (je ein Dokument-Rahmen): die Nummer im Zusatz fängt es
  const k=teile.findIndex((_,i)=>i>2&&teile[i].length<1000);const tausch=[...teile];[tausch[k],tausch[k+1]]=[tausch[k+1],tausch[k]];
  const t2=Buffer.concat(tausch);await assert.rejects(S.oeffnen('geheim-123',lies(t2),t2.length,async()=>{}),/beschaedigt/);
  const json=Buffer.from('{"art":"workfloh-pdf-sicherung"}');assert.equal(await S.istFassung2(lies(json)),false);
});

test('B · App: 60-MB-Dokument sichern und zurückholen, alte Sicherung über den Kern',async t=>{
  const base=join(root,'www');
  const server=createServer(async(req,res)=>{try{
    const path=resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(path!==base&&!path.startsWith(base+'/'))throw Error();
    const file=path===base?join(path,'index.html'):path;
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>server.close());
  const browser=await chromium.launch({args:['--enable-precise-memory-info'],...(process.env.WFP_CHROMIUM?{executablePath:process.env.WFP_CHROMIUM}:{})});
  t.after(()=>browser.close());
  const tickets=new Map(),gespeichert=[];let groessterAufruf=0;
  async function files(m,a={}){
    if(m==='begin'){const id=randomUUID();tickets.set(id,{name:a.name,mime:a.mime,teile:[],laenge:0});return {id};}
    if(m==='append'){const x=tickets.get(a.id);assert.equal(a.offset,x.laenge,'Versatz lückenlos');const b=Buffer.from(a.data,'base64');groessterAufruf=Math.max(groessterAufruf,a.data.length);x.teile.push(b);x.laenge+=b.length;return {};}
    if(m==='finish'){const x=tickets.get(a.id);assert.equal(a.size,x.laenge);x.daten=Buffer.concat(x.teile);x.teile=null;return {};}
    if(m==='save'){const x=tickets.get(a.id);gespeichert.push({name:x.name,mime:x.mime,daten:x.daten});return {saved:true};}
    if(m==='abort'){tickets.delete(a.id);return {};}
    if(m==='appInfo')return {version:'1.0.7'};
    return {};
  }
  async function seite(){
    const page=await browser.newPage({viewport:{width:1100,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('__files',files);
    await page.addInitScript(()=>{const f={};for(const m of ['begin','append','finish','abort','save','share','print','openLink','appInfo'])f[m]=a=>__files(m,a);
      window.Capacitor={isNativePlatform:()=>true,Plugins:{WorkflowFiles:f}};});
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>window.__wfpdf&&window.PDFLib&&window.WFPSicherung2&&window.WFPNativeSicherung);
    return {page,errors};
  }
  const pdf=await PDFDocument.create();pdf.addPage([300,300]);const klein=Buffer.from(await pdf.save());
  const MB=60,gross=Buffer.concat([klein,Buffer.alloc(MB*1048576-klein.length,7)]);const grossSha=sha(gross);
  const {page,errors}=await seite();
  // 60 MB in die Bibliothek (Datei eines eingelesenen Dokuments ersetzt), in Stücken über die Brücke der Probe
  const id=await page.evaluate(async b64=>{const b=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const [d]=await __wfpdf.importDateien([new File([b],'Groß.pdf',{type:'application/pdf'})],null,{still:true});return d.id;},klein.toString('base64'));
  await page.evaluate(async([id,mb])=>{const b=new Uint8Array(mb*1048576);const k=await WFP.DB.getFile(id);const kb=k instanceof Uint8Array?k:new Uint8Array(await new Blob([k]).arrayBuffer());b.fill(7);b.set(kb);await WFP.DB.putFile(id,b);},[id,MB]);
  assert.equal(sha(Buffer.from(await page.evaluate(async id=>{const b=await WFP.DB.getFile(id);const u=b instanceof Uint8Array?b:new Uint8Array(await new Blob([b]).arrayBuffer());let h=await crypto.subtle.digest('SHA-256',u);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');},id),'utf8')).length,64);
  await page.evaluate(()=>__wfpdf.dlg.sicherungDialog());
  await page.fill('#siPw1','geheim-123');await page.fill('#siPw2','geheim-123');
  const basis=await page.evaluate(()=>performance.memory.usedJSHeapSize);
  await page.evaluate(()=>{window.__spitze=0;window.__mess=setInterval(()=>{window.__spitze=Math.max(window.__spitze,performance.memory.usedJSHeapSize);},20);});
  await page.click('#siErstellen');
  await page.waitForSelector('[data-wfp-sicherung-lauf] [data-pro-fortschritt="fertig"],[data-wfp-sicherung-lauf] [data-pro-fortschritt="fehler"]',{timeout:180000});
  const spitze=await page.evaluate(()=>{clearInterval(window.__mess);return window.__spitze;});
  const ergebnis=await page.textContent('[data-wfp-sicherung-lauf]');
  assert.match(ergebnis,/Gesichert: 1 Dokument/,ergebnis);
  assert.equal(gespeichert.length,1);const s=gespeichert[0];
  assert.match(s.name,/^Workflow-PDF-Pro-Sicherung-\d{4}-\d\d-\d\d-\d{4}\.wfps$/);assert.equal(s.mime,'application/octet-stream');
  assert.ok(s.daten.length>gross.length&&s.daten.length<gross.length*1.01,'Datei ≈ Inhalt, kein base64-Aufblähen ('+s.daten.length+')');
  assert.ok(groessterAufruf<=262144+16,'jeder Schreibaufruf ≤ 256 KB base64 ('+groessterAufruf+')');
  const zuwachs=spitze-basis;
  console.log('# Sichern von '+MB+' MB: JS-Heap vorher '+Math.round(basis/1048576)+' MB, Spitze '+Math.round(spitze/1048576)+' MB (+'+Math.round(zuwachs/1048576)+' MB); Datei '+Math.round(s.daten.length/1048576)+' MB');
  assert.ok(zuwachs<MB*1048576*2,'Zuwachs unter 2 × Dokument (+'+Math.round(zuwachs/1048576)+' MB)');
  // Zum Vergleich der Weg des Kerns (alles als Text): derselbe Inhalt, dieselbe Messung
  const kern=await page.evaluate(async()=>{const b=performance.memory.usedJSHeapSize;let sp=b;const iv=setInterval(()=>{sp=Math.max(sp,performance.memory.usedJSHeapSize);},20);
    try{const r=await WFP.Sicherung.verschliessen('geheim-123',WFP.DB);const txt=new TextEncoder().encode(JSON.stringify(r.datei));sp=Math.max(sp,performance.memory.usedJSHeapSize);void txt;}catch(e){return 'Fehler '+e.message;}finally{clearInterval(iv);}return Math.round((sp-b)/1048576);});
  console.log('# Kern-Weg zum Vergleich: +'+kern+' MB');
  assert.ok(await page.evaluate(()=>!!localStorage.getItem('wfpdf_sicherung_zuletzt')));
  // Playwright reicht über 50 MB nur als Datei weiter
  const tmp=await mkdtemp(join(tmpdir(),'wfps-'));t.after(()=>rm(tmp,{recursive:true,force:true}));const pfad=join(tmp,s.name);await writeFile(pfad,s.daten);
  // Falsches Passwort beim Zurückholen, dann richtig — in einer frischen App (Speicher leer)
  const ctx2=await browser.newContext();const p2=await ctx2.newPage({viewport:{width:1100,height:900}});const err2=[];p2.on('pageerror',e=>err2.push(e.message));
  await p2.exposeFunction('__files',files);
  await p2.addInitScript(()=>{const f={};for(const m of ['begin','append','finish','abort','save','share','print','openLink','appInfo'])f[m]=a=>__files(m,a);window.Capacitor={isNativePlatform:()=>true,Plugins:{WorkflowFiles:f}};});
  await p2.goto('http://127.0.0.1:'+server.address().port+'/');await p2.waitForFunction(()=>window.__wfpdf&&window.WFPNativeSicherung);
  assert.equal(await p2.evaluate(()=>__wfpdf.S.docs.length),0);
  await p2.evaluate(()=>__wfpdf.dlg.sicherungDialog());
  assert.match(await p2.getAttribute('#siDatei','accept'),/\.wfps/);
  await p2.setInputFiles('#siDatei',pfad);
  await p2.fill('#siPwZ','falsch-123');await p2.click('#siZurueck');
  await p2.waitForSelector('[data-wfp-sicherung-lauf] [data-pro-fortschritt="fehler"]',{timeout:60000});
  assert.match(await p2.textContent('[data-wfp-sicherung-lauf] [data-pro-fortschritt="fehler"]'),/Passwort passt nicht/);
  await p2.evaluate(()=>document.querySelectorAll('[data-wfp-sicherung-lauf]').forEach(e=>e.remove()));
  await p2.fill('#siPwZ','geheim-123');await p2.click('#siZurueck');
  await p2.waitForSelector('[data-wfp-sicherung-lauf] [data-pro-fortschritt="fertig"]',{timeout:180000});
  assert.match(await p2.textContent('[data-wfp-sicherung-lauf]'),/1 Dokument\(e\) dazu, 0 schon da, 1 Ordner dazu|1 Dokument\(e\) dazu, 0 schon da/);
  await p2.waitForFunction(()=>window.__wfpdf&&__wfpdf.S.docs.length===1,null,{timeout:30000});   // nach dem Neuladen
  const zurueckSha=await p2.evaluate(async()=>{const d=__wfpdf.S.docs[0];const b=await WFP.DB.getFile(d.id);const u=b instanceof Uint8Array?b:new Uint8Array(await new Blob([b]).arrayBuffer());const h=await crypto.subtle.digest('SHA-256',u);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')+':'+d.name;});
  assert.equal(zurueckSha,grossSha+':Groß','60 MB Byte für Byte zurück');
  // Zweites Mal: nichts doppelt
  await p2.evaluate(()=>__wfpdf.dlg.sicherungDialog());
  await p2.setInputFiles('#siDatei',pfad);
  await p2.fill('#siPwZ','geheim-123');await p2.click('#siZurueck');
  await p2.waitForSelector('[data-wfp-sicherung-lauf] [data-pro-fortschritt="fertig"]',{timeout:180000});
  assert.match(await p2.textContent('[data-wfp-sicherung-lauf]'),/0 Dokument\(e\) dazu, 1 schon da/);
  // Alte Sicherung (Fassung 1, JSON) holt der Kern zurück — erzeugt mit der Rechnung des Kerns
  const ctx3=await browser.newContext();const p3=await ctx3.newPage();await p3.exposeFunction('__files',files);
  await p3.addInitScript(()=>{const f={};for(const m of ['begin','append','finish','abort','save','share','print','openLink','appInfo'])f[m]=a=>__files(m,a);window.Capacitor={isNativePlatform:()=>true,Plugins:{WorkflowFiles:f}};});
  await p3.goto('http://127.0.0.1:'+server.address().port+'/');await p3.waitForFunction(()=>window.__wfpdf&&window.WFPNativeSicherung);
  const alt=await page.evaluate(async()=>{const r=await WFP.Sicherung.verschliessen('alt-12345',{all:async s=>s==='folders'?[]:[{id:'alt1',name:'Alt.pdf',fields:[],pages:[]}],getFile:async()=>new Uint8Array([37,80,68,70]),get:async()=>null});return JSON.stringify(r.datei);});
  await p3.evaluate(()=>__wfpdf.dlg.sicherungDialog());
  await p3.setInputFiles('#siDatei',{name:'alt.json',mimeType:'application/json',buffer:Buffer.from(alt)});
  await p3.fill('#siPwZ','alt-12345');await p3.click('#siZurueck');
  await p3.waitForFunction(()=>/1 Dokument\(e\) dazu/.test(document.querySelector('#siZErg')?.textContent||''),null,{timeout:60000});
  assert.equal(await p3.locator('[data-wfp-sicherung-lauf]').count(),0,'alte Sicherung: der Kern, nicht der neue Weg');
  assert.deepEqual([...errors,...err2],[]);
});
