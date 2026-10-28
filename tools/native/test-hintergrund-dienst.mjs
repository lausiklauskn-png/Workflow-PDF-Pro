// Pro-Umbau 4/5: Bildbeschreibung startet nicht von selbst; Prüfen, Einordnen und Beschreiben melden sich beim
// gemeinsamen Hintergrund-Dienst (pro-hintergrund.js → Android ProHintergrundDienst) an und wieder ab. Seit Pro-Umbau 5 tut
// das der Kern selbst (window.ProHintergrund) — die Pro-Schicht schaut nicht mehr je Sekunde nach.
// Die Android-Brücke ist gestellt (zählt beginnen/stand/ende); das Bildmodell ist nicht erreichbar (jsDelivr gesperrt) —
// gemessen wird, OB der Kern zu laden beginnt, nicht ob das Modell beschreibt. Gegenprobe als PWA (ohne App-Schicht).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {chromium} from 'playwright-core';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {root} from './prepare-web.mjs';

test('Bildbeschreibung wartet auf „Beschreiben“, lange Läufe melden sich beim Hintergrund-Dienst',async t=>{
  const base=join(root,'www');
  const server=createServer(async(req,res)=>{try{
    const path=resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(path!==base&&!path.startsWith(base+'/'))throw Error();
    const file=path===base?join(path,'index.html'):path;
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>server.close());
  const browser=await chromium.launch(process.env.WFP_CHROMIUM?{executablePath:process.env.WFP_CHROMIUM}:{});t.after(()=>browser.close());
  const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);
  for(let i=0;i<3;i++){const p=pdf.addPage([400,500]);p.drawText('Kündigung des Vertrags zum Monatsende, Seite '+(i+1)+'. Bitte bestätigen Sie den Eingang schriftlich.',{x:20,y:400,size:9,font});}
  const bytes=Buffer.from(await pdf.save()).toString('base64');
  async function seite(app){
    const ctx=await browser.newContext({viewport:{width:1000,height:900},hasTouch:true});
    // Bildmodell gestellt: transformers.js als kleines Modul, das langsam „lädt“ und „beschreibt“ (kein Netz).
    await ctx.route(/cdn\.jsdelivr\.net\/npm\/@xenova\/transformers/,r=>r.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},
      body:'export const env={};export async function pipeline(){await new Promise(r=>setTimeout(r,1500));return async()=>{await new Promise(r=>setTimeout(r,1500));return [{generated_text:"a blue square"}];};}'}));
    await ctx.route(/huggingface\.co|family-projekt\.de/,r=>r.abort());
    const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(app=>{
      localStorage.setItem('wfpdf_einst_v1',JSON.stringify({bedeutung:true,bild:true}));
      window.__emb={batches:0};
      const vek=s=>{const v=new Float32Array(384);for(let i=0;i<s.length;i++)v[(s.charCodeAt(i)*7+i)%384]+=1;let n=Math.hypot(...v)||1;return v.map(x=>x/n);};
      // langsam genug, dass der Blick je Sekunde das Einordnen sieht
      window.SbkimEmbedding={init:async()=>{},isReady:()=>true,embedQuery:async s=>vek(s),embedQueryBatch:async a=>a.map(vek),embedPassageBatch:async a=>{window.__emb.batches++;await new Promise(r=>setTimeout(r,700));return a.map(vek);}};
      if(!app)return;
      const f={};for(const m of ['begin','append','finish','abort','save','share','print','openLink'])f[m]=async()=>({});f.appInfo=async()=>({version:'1.0.7'});
      const log=window.__hg=[];let hoerer=null;
      const H={aufraeumen:async()=>{log.push(['aufraeumen']);},erlauben:async()=>({mitteilung:true}),
        beginnen:async o=>{log.push(['beginnen',o.id.split('-')[0],o.titel]);return {geschuetzt:true};},
        stand:async o=>{log.push(['stand',o.id.split('-')[0],o.text]);},ende:async o=>{log.push(['ende',o.id.split('-')[0]]);},
        addListener:(n,fn)=>{hoerer=fn;return {remove(){}};}};
      window.__hgAbbruch=art=>{const e=[...log].reverse().find(x=>x[0]==='beginnen'&&x[1]===art);if(!e)return false;
        const id=window.__hgIds?.[art];hoerer&&id&&hoerer({id,grund:'mitteilung'});return !!id;};
      // Kennungen mitschreiben, damit die Probe „Abbrechen“ aus der Mitteilung nachstellen kann
      const beg=H.beginnen;H.beginnen=async o=>{(window.__hgIds??={})[o.id.split('-')[0]]=o.id;return beg(o);};
      window.Capacitor={isNativePlatform:()=>true,Plugins:{WorkflowFiles:f,ProHintergrund:H}};
    },app);
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>window.__wfpdf&&window.PDFLib&&window.WFP?.Bild);
    return {page,errors};
  }
  const warte=ms=>new Promise(r=>setTimeout(r,ms));
  const foto=page=>page.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.fillStyle='#38a';g.fillRect(0,0,64,64);g.fillStyle='#fd3';g.fillRect(10,10,20,20);
    const b=await new Promise(r=>c.toBlob(r,'image/png'));const [d]=await __wfpdf.importDateien([new File([b],'Urlaub.png',{type:'image/png'})],null,{still:true});return d.quelle;});

  // ---------- Gegenprobe PWA: ohne ProHintergrund läuft dasselbe einfach so, ohne Anmeldung ----------
  {const {page}=await seite(false);
   await page.waitForSelector('#bildLeiste [data-bild-beschreiben]',{timeout:20000});
   assert.equal(await page.evaluate(()=>window.ProHintergrund?.verfuegbar?.()??false),false,'Gegenprobe: als PWA steht kein Android-Dienst dahinter');
   await page.context().close();}

  const {page,errors}=await seite(true);
  // 1 · Bildbeschreibung wartet auf den Knopf (Kern)
  await page.waitForSelector('#bildLeiste [data-bild-beschreiben]',{timeout:20000});
  await warte(1500);
  assert.equal(await page.evaluate(()=>WFP.Bild.zustand().zustand),'wartet','beim Öffnen wird kein Bildmodell geladen');
  assert.equal(await foto(page),'foto');
  await page.waitForFunction(()=>/1 Foto\(s\) noch nicht beschrieben/.test(document.getElementById('bildLeiste').textContent),null,{timeout:10000});
  assert.equal(await page.evaluate(()=>WFP.Bild.zustand().zustand),'wartet','ein neues Foto startet es auch nicht');
  await page.tap('#bildLeiste [data-bild-beschreiben]');
  await page.waitForSelector('.dlg');
  assert.match(await page.textContent('.dlg'),/1 Foto\(s\) beschreiben\?/);
  assert.match(await page.textContent('.dlg'),/256 MB/);
  await page.tap('.dlg [data-n]');
  await warte(400);assert.equal(await page.evaluate(()=>WFP.Bild.zustand().zustand),'wartet','„Abbrechen“ in der Frage startet nichts');
  await page.tap('#bildLeiste [data-bild-beschreiben]');
  await page.tap('.dlg [data-j]');
  await page.waitForFunction(()=>__hg.some(e=>e[0]==='beginnen'&&e[1]==='beschreiben'&&e[2]==='Bildbeschreibung läuft'),null,{timeout:10000});
  await page.waitForFunction(()=>WFP.Bild.zustand().zustand==='bereit'&&__hg.some(e=>e[0]==='ende'&&e[1]==='beschreiben'),null,{timeout:20000});
  assert.ok(await page.evaluate(()=>__wfpdf.S.docs.some(d=>d.bild&&d.bild.modell==='a blue square')),'das Foto ist beschrieben');
  assert.ok(await page.evaluate(()=>__hg.some(e=>e[0]==='stand'&&e[1]==='beschreiben'&&/Foto 1 von 1/.test(e[2]))),'Stand je Foto');

  // 2 · Dienst beim Laden aufgeräumt; Prüfen meldet sich an, mit Stand, und ab
  assert.equal(await page.evaluate(()=>__hg[0][0]),'aufraeumen');
  await page.evaluate(async b64=>{const b=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));await __wfpdf.importDateien([new File([b],'Brief.pdf',{type:'application/pdf'})],null,{still:true});},bytes);
  await page.waitForSelector('[data-pruef-alle-los]');
  await page.tap('[data-pruef-alle-los]');
  await page.tap('.dlg [data-j]');
  await page.waitForFunction(()=>__hg.some(e=>e[0]==='beginnen'&&e[1]==='pruefen'),null,{timeout:10000});
  assert.ok(await page.evaluate(()=>__hg.some(e=>e[0]==='beginnen'&&e[1]==='pruefen'&&e[2]==='Prüfen läuft')),'Titel der Mitteilung „Prüfen läuft“');
  await page.waitForFunction(()=>!__wfpdf.eingang.ALLE.an&&__hg.some(e=>e[0]==='ende'&&e[1]==='pruefen'),null,{timeout:90000});
  assert.ok(await page.evaluate(()=>__hg.some(e=>e[0]==='stand'&&e[1]==='pruefen'&&/Dokument 1 von/.test(e[2]))),'Stand je Dokument');

  // 3 · Einordnen meldet sich an; „Abbrechen“ aus der Mitteilung hält es an (die Zeile sagt „Angehalten“)
  await page.waitForSelector('#pruefAlle [data-einordnen]',{timeout:20000});
  await page.tap('#pruefAlle [data-einordnen]');
  await page.tap('.dlg [data-j]');
  await page.waitForFunction(()=>__hg.some(e=>e[0]==='beginnen'&&e[1]==='einordnen'&&e[2]==='Einordnen läuft'),null,{timeout:15000});
  assert.ok(await page.evaluate(()=>__hgAbbruch('einordnen')),'Abbruch aus der Mitteilung nachgestellt');
  await page.waitForFunction(()=>!__wfpdf.bedeutung.BED.einLauf&&__hg.some(e=>e[0]==='ende'&&e[1]==='einordnen'),null,{timeout:15000});
  assert.ok(await page.evaluate(()=>__wfpdf.bedeutung.offeneEinordnen().length>0),'nach dem Abbruch bleibt etwas offen');
  assert.match(await page.textContent('#bedeutungLeiste'),/Angehalten/);
  assert.ok(await page.isVisible('#pruefAlle [data-einordnen]'),'„Einordnen“ steht wieder da');
  assert.deepEqual(errors,[]);
});
