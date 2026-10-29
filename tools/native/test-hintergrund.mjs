// Prüfen und Einordnen nur auf Knopfdruck (seit Pro-Umbau 5 im Kern, Workflow-PDF 1.1.4) und der Tipp-Schutz der App
// (Leitfaden § 3, Befund 9 aus Schritt E). Gegenprobe als PWA (ohne App-Schicht): der durchgereichte Tipp startet dort — das
// beweist, dass die Probe den Schutz sehen würde. Das Sprachmodell ist gestellt (SbkimEmbedding, zählt die Aufrufe).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {chromium} from 'playwright-core';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {root} from './prepare-web.mjs';

test('Kern: Einordnen wartet, Prüfen fragt, Auswahl; App: durchgereichter Tipp wird verworfen, keine Umwege mehr',async t=>{
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
  const neu=(page,name)=>page.evaluate(async([b64,n])=>{const b=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const [d]=await __wfpdf.importDateien([new File([b],n+'.pdf',{type:'application/pdf'})],null,{still:true});return d.id;},[bytes,name]);

  const {page,errors,id}=await seite(true);
  // 0 · Die Umwege der Pro-Schicht sind weg: kein angehaltenes Modell, kein eigener Knopf, nur noch der Tipp-Schutz
  assert.deepEqual(Object.keys(await page.evaluate(()=>window.WFPNativeHintergrund)),['START']);
  assert.equal(await page.evaluate(()=>!!window.SbkimEmbedding?.__wppGebunden),false,'das Modell wird nicht mehr von außen angehalten');
  // 1 · Einordnen: beim Öffnen nichts (der Kern), Knopf „Einordnen“ über den Karten, Frage „Alle 1 …?“
  await page.waitForSelector('#pruefAlle [data-einordnen]',{timeout:20000});
  await warte(1500);
  assert.equal(await page.evaluate(()=>__emb.batches),0,'beim Öffnen wird nichts eingeordnet');
  assert.equal(await page.locator('[data-wpp-einordnen],[data-wpp-pruefen-wahl],dialog[data-wpp-frage]').count(),0,'keine Knöpfe/Fenster der alten Pro-Schicht');
  await page.tap('#pruefAlle [data-einordnen]');
  await page.waitForSelector('.dlg');
  assert.match(await page.textContent('.dlg'),/Alle 1 Dokumente einordnen\?/);
  assert.equal(await page.locator('.dlg .knopf.rot').count(),1,'genau ein farbiger Knopf');
  await page.tap('.dlg [data-j]');
  await page.waitForFunction(()=>__emb.batches>0&&__wfpdf.bedeutung.BED.zustand==='bereit'&&!__wfpdf.bedeutung.BED.einLauf,null,{timeout:20000});

  // 2 · „Prüfen“ fragt vorher
  await page.waitForSelector('[data-pruef-alle-los]');
  await page.tap('[data-pruef-alle-los]');
  await page.waitForSelector('.dlg');
  assert.match(await page.textContent('.dlg'),/Alle 1 noch nicht geprüften/);
  assert.equal(await page.evaluate(id=>!!__wfpdf.S.docs.find(d=>d.id===id).pruefung||document.querySelector('[data-pruef-alle-lauf]')!==null,id),false,'vor dem Ja startet nichts');
  await page.tap('.dlg [data-n]');
  await warte(300);assert.equal(await page.locator('[data-pruef-alle-lauf]').count(),0);

  // 3 · Durchgereichter Tipp nachgestellt: ein Fenster über dem Knopf schließt beim Antippen (pointerdown),
  //     der Klick nach dem Loslassen trifft den Knopf darunter.
  const nachstellen=p=>p.evaluate(()=>{const k=document.querySelector('[data-pruef-alle-los]').getBoundingClientRect();
    const d=document.createElement('div');d.id='schliesstBeimTipp';Object.assign(d.style,{position:'fixed',left:(k.left-20)+'px',top:(k.top-20)+'px',width:(k.width+40)+'px',height:(k.height+40)+'px',background:'#fff',zIndex:99});
    d.addEventListener('pointerdown',()=>d.remove());document.body.append(d);return {x:k.left+k.width/2,y:k.top+k.height/2};});
  {const pos=await nachstellen(page);
   await page.touchscreen.tap(pos.x,pos.y);await warte(500);
   assert.equal(await page.locator('#schliesstBeimTipp').count(),0,'das Fenster hat sich beim Tipp geschlossen');
   assert.equal(await page.locator('.dlg').count(),0,'kein Start, keine Frage: der Tipp begann nicht auf dem Knopf');
   assert.equal(await page.getAttribute('[data-pruef-alle-los]','data-wpp-tipp-verworfen'),'1');}
  // Gegenprobe PWA: derselbe Tipp öffnet dort die Frage (der Kern hat keinen Tipp-Schutz)
  {const {page:pw}=await seite(false);await pw.waitForSelector('[data-pruef-alle-los]');
   const pos=await nachstellen(pw);await pw.touchscreen.tap(pos.x,pos.y);
   await pw.waitForSelector('.dlg',{timeout:5000}).catch(()=>{});
   assert.equal(await pw.locator('.dlg').count(),1,'Gegenprobe: ohne Schutz startet der durchgereichte Tipp');
   await pw.context().close();}
  // Tastatur bleibt erlaubt (kein Zeiger) — und führt zur Frage
  await page.focus('[data-pruef-alle-los]');await page.keyboard.press('Enter');
  await page.waitForSelector('.dlg');
  await page.click('.dlg [data-j]');
  await page.waitForFunction(id=>!!__wfpdf.S.docs.find(d=>d.id===id).pruefung,id,{timeout:60000});

  // 4 · „Prüfen“ mit Auswahl: nur die gewählten, ohne Frage
  const id2=await neu(page,'Zweiter'),id3=await neu(page,'Dritter');
  await page.evaluate(id=>__wfpdf.dlg.wahlUmschalten(id),id2);
  await page.waitForFunction(()=>/Prüfen \(1\)/.test(document.querySelector('#pruefAlle [data-pruef-alle-los]')?.textContent||''));
  await page.tap('#pruefAlle [data-pruef-alle-los]');
  await page.waitForFunction(id=>!!__wfpdf.S.docs.find(d=>d.id===id).pruefung,id2,{timeout:60000});
  assert.equal(await page.locator('.dlg').count(),0,'mit Auswahl keine Frage');
  assert.equal(await page.evaluate(id=>!!__wfpdf.S.docs.find(d=>d.id===id).pruefung,id3),false,'das nicht gewählte bleibt ungeprüft');
  assert.deepEqual(errors,[]);
});
