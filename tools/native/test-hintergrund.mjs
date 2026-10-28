// Prüfen und Einordnen nur auf Knopfdruck, durchgereichter Tipp (Leitfaden § 3, Befunde 7 und 9 aus Schritt E).
// Jede Behauptung mit Gegenprobe als PWA (ohne App-Brücke): dort zeigt der Kern das alte Verhalten — das beweist, dass die
// Probe es sehen würde. Das Sprachmodell ist gestellt (SbkimEmbedding mit fester Vektor-Rechnung, zählt die Aufrufe).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {chromium} from 'playwright-core';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {root} from './prepare-web.mjs';

test('Einordnen wartet, „Alle prüfen“ fragt, durchgereichter Tipp wird verworfen',async t=>{
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
  for(let i=0;i<2;i++){const p=pdf.addPage([400,500]);p.drawText('Kündigung des Vertrags zum Monatsende, Seite '+(i+1)+'. Bitte bestätigen Sie den Eingang schriftlich.',{x:20,y:400,size:9,font});}
  const bytes=Buffer.from(await pdf.save()).toString('base64');
  async function seite(app){
    const ctx=await browser.newContext({viewport:{width:1000,height:900},hasTouch:true});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(app=>{
      localStorage.setItem('wfpdf_einst_v1',JSON.stringify({bedeutung:true}));
      window.__emb={batches:0};
      const vek=s=>{const v=new Float32Array(384);for(let i=0;i<s.length;i++)v[(s.charCodeAt(i)*7+i)%384]+=1;let n=Math.hypot(...v)||1;return v.map(x=>x/n);};
      window.SbkimEmbedding={init:async()=>{},isReady:()=>true,embedQuery:async s=>vek(s),embedQueryBatch:async a=>a.map(vek),embedPassageBatch:async a=>{window.__emb.batches++;return a.map(vek);}};
      if(!app)return;
      const f={};for(const m of ['begin','append','finish','abort','save','share','print','openLink'])f[m]=async()=>({});f.appInfo=async()=>({version:'1.0.7'});
      window.Capacitor={isNativePlatform:()=>true,Plugins:{WorkflowFiles:f}};
    },app);
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>window.__wfpdf&&window.PDFLib);
    const id=await page.evaluate(async b64=>{const b=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const [d]=await __wfpdf.importDateien([new File([b],'Brief.pdf',{type:'application/pdf'})],null,{still:true});return d.id;},bytes);
    return {page,errors,id};
  }
  const warte=ms=>new Promise(r=>setTimeout(r,ms));

  // ---------- Gegenprobe PWA: der Kern ordnet beim Öffnen von selbst ein ----------
  {const {page}=await seite(false);
   await page.waitForFunction(()=>__emb.batches>0,null,{timeout:20000}).catch(()=>{});
   assert.ok(await page.evaluate(()=>__emb.batches)>0,'Gegenprobe: ohne App-Schicht ordnet der Kern beim Öffnen ein (sonst wäre die Probe blind)');
   await page.context().close();}

  const {page,errors,id}=await seite(true);
  // 1 · Einordnen wartet auf den Knopf
  await page.waitForSelector('#bedeutungLeiste [data-wpp-einordnen]',{timeout:20000});
  await warte(1500);
  assert.equal(await page.evaluate(()=>__emb.batches),0,'beim Öffnen wird nichts eingeordnet');
  assert.match(await page.textContent('#bedeutungLeiste'),/1 Dokument\(e\) noch nicht eingeordnet/);
  // Suchen geht schon (Frage läuft frei)
  await page.evaluate(()=>{const i=document.getElementById('suche')||document.querySelector('input[type=search]');i.value='Vertrag';i.dispatchEvent(new Event('input',{bubbles:true}));});
  await warte(400);assert.equal(await page.evaluate(()=>__emb.batches),0);
  await page.tap('#bedeutungLeiste [data-wpp-einordnen]');
  await page.waitForSelector('dialog[data-wpp-frage][open]');
  assert.match(await page.textContent('dialog[data-wpp-frage]'),/1 Dokument\(e\) einordnen\?/);
  assert.equal(await page.locator('dialog[data-wpp-frage] [data-pro-haupt]').count(),1,'genau ein farbiger Knopf');
  await page.tap('dialog[data-wpp-frage] [data-wpp-antwort="ja"]');
  await page.waitForFunction(()=>__emb.batches>0&&__wfpdf.bedeutung.BED.zustand==='bereit',null,{timeout:20000});
  assert.match(await page.textContent('#bedeutungLeiste'),/Dokumente eingeordnet/);

  // 2 · „Alle prüfen“ fragt vorher
  await page.evaluate(()=>{const i=document.getElementById('suche')||document.querySelector('input[type=search]');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForSelector('[data-pruef-alle-los]');
  await page.tap('[data-pruef-alle-los]');
  await page.waitForSelector('dialog[data-wpp-frage][open]');
  assert.match(await page.textContent('dialog[data-wpp-frage]'),/Alle 1 noch nicht geprüften/);
  assert.equal(await page.evaluate(id=>!!__wfpdf.S.docs.find(d=>d.id===id).pruefung||document.querySelector('[data-pruef-alle-lauf]')!==null,id),false,'vor dem Ja startet nichts');
  await page.tap('dialog[data-wpp-frage] [data-wpp-antwort="nein"]');
  await warte(300);assert.equal(await page.locator('[data-pruef-alle-lauf]').count(),0);

  // 3 · Durchgereichter Tipp nachgestellt: ein Fenster über dem Knopf schließt beim Antippen (pointerdown),
  //     der Klick nach dem Loslassen trifft den Knopf darunter.
  const nachstellen=p=>p.evaluate(()=>{const k=document.querySelector('[data-pruef-alle-los]').getBoundingClientRect();
    const d=document.createElement('div');d.id='schliesstBeimTipp';Object.assign(d.style,{position:'fixed',left:(k.left-20)+'px',top:(k.top-20)+'px',width:(k.width+40)+'px',height:(k.height+40)+'px',background:'#fff',zIndex:99});
    d.addEventListener('pointerdown',()=>d.remove());document.body.append(d);return {x:k.left+k.width/2,y:k.top+k.height/2};});
  {const pos=await nachstellen(page);
   await page.touchscreen.tap(pos.x,pos.y);await warte(500);
   assert.equal(await page.locator('#schliesstBeimTipp').count(),0,'das Fenster hat sich beim Tipp geschlossen');
   assert.equal(await page.locator('dialog[data-wpp-frage][open]').count(),0,'kein Start, keine Frage: der Tipp begann nicht auf dem Knopf');
   assert.equal(await page.getAttribute('[data-pruef-alle-los]','data-wpp-tipp-verworfen'),'1');}
  // Gegenprobe PWA: derselbe Tipp startet „Alle prüfen“ ohne Zutun (so wie am Tablet beobachtet)
  {const {page:pw,id:pid}=await seite(false);await pw.waitForSelector('[data-pruef-alle-los]');
   const pos=await nachstellen(pw);await pw.touchscreen.tap(pos.x,pos.y);
   await pw.waitForFunction(id=>document.querySelector('[data-pruef-alle-lauf],[data-pruef-alle-ende]')||__wfpdf.S.docs.find(d=>d.id===id).pruefung,pid,{timeout:15000}).catch(()=>{});
   assert.ok(await pw.evaluate(id=>!!(document.querySelector('[data-pruef-alle-lauf],[data-pruef-alle-ende]')||__wfpdf.S.docs.find(d=>d.id===id).pruefung),pid),'Gegenprobe: ohne Schutz startet der durchgereichte Tipp die Prüfung');
   await pw.context().close();}
  // Tastatur bleibt erlaubt (kein Zeiger) — und führt zur Frage
  await page.focus('[data-pruef-alle-los]');await page.keyboard.press('Enter');
  await page.waitForSelector('dialog[data-wpp-frage][open]');
  await page.click('dialog[data-wpp-frage] [data-wpp-antwort="ja"]');
  await page.waitForFunction(id=>!!__wfpdf.S.docs.find(d=>d.id===id).pruefung,id,{timeout:60000});

  // 4 · „Prüfen“ in der Auswahl-Leiste: nur die gewählten
  const id2=await page.evaluate(async b64=>{const b=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const [d]=await __wfpdf.importDateien([new File([b],'Zweiter.pdf',{type:'application/pdf'})],null,{still:true});return d.id;},bytes);
  const id3=await page.evaluate(async b64=>{const b=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const [d]=await __wfpdf.importDateien([new File([b],'Dritter.pdf',{type:'application/pdf'})],null,{still:true});return d.id;},bytes);
  await page.evaluate(id=>__wfpdf.dlg.wahlUmschalten(id),id2);
  await page.waitForSelector('#wahlLeiste [data-wpp-pruefen-wahl]');
  assert.match(await page.textContent('#wahlLeiste [data-wpp-pruefen-wahl]'),/1 gewählte prüfen/);
  await page.tap('#wahlLeiste [data-wpp-pruefen-wahl]');
  await page.waitForFunction(id=>!!__wfpdf.S.docs.find(d=>d.id===id).pruefung,id2,{timeout:60000});
  assert.equal(await page.evaluate(id=>!!__wfpdf.S.docs.find(d=>d.id===id).pruefung,id3),false,'das nicht gewählte bleibt ungeprüft');
  assert.deepEqual(errors,[]);
});
