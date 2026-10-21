import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {chromium} from 'playwright-core';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {root} from './prepare-web.mjs';

// The native protocol is a fixture here. Real sockets, Android permissions and
// foreground notifications have separate instrumentation cases.
test('native Chrome factory preserves the original cleaning and PDF pipeline',async t=>{
  const base=join(root,'www');const server=createServer(async(req,res)=>{
    try{const path=resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(base+'/')&&path!==base)throw Error();const file=path===base?join(base,'index.html'):path;res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch(process.env.WFP_CHROMIUM?{executablePath:process.env.WFP_CHROMIUM}:{});
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const f=window.chromeFixture={begins:[],sent:[],closed:[],events:[],mode:'ok',sequence:0};
      const files={};for(const method of ['begin','append','finish','abort','save','share','print','openLink'])files[method]=async()=>({});
      window.Capacitor={isNativePlatform:()=>true,Plugins:{WorkflowFiles:files,WorkflowChrome:{
        addListener(name,fn){f.events.push(fn);return{remove(){}};},
        async begin(options){const id='session-'+(++f.sequence);f.begins.push({id,...options});return{id};},
        async translate({id,texte}){
          f.sent.push({id,texte});if(f.mode==='fail')throw Error('CHROME_CANCELLED');
          if(f.mode==='wait')return new Promise((resolve,reject)=>{f.reject=reject;});
          return {texte:texte.map(x=>'[en] '+x),stat:{zeichen:f.sent.reduce((n,p)=>n+p.texte.join('').length,0),anfragen:f.sent.length,ohne:0}};
        },
        async close({id}){f.closed.push(id);}
      }}};
    });
    await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>window.__wfpdf&&window.PDFLib);
    const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
    for(let i=0;i<2;i++){const p=pdf.addPage([595,842]);p.drawText('Sichtbarer synthetischer Inhalt Seite '+(i+1),{x:60,y:700,size:12,font});p.drawText('VERSTECKTES_NATIVE_MUSTER',{x:60,y:600,size:12,font,color:rgb(1,1,1)});}
    const bytes=Buffer.from(await pdf.save());
    const id=await page.evaluate(async b64=>{const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const [d]=await __wfpdf.importDateien([new File([bytes],'Chrome native.pdf',{type:'application/pdf'})],null,{still:true});__wfpdf.EINST.ueRueck=false;return d.id;},bytes.toString('base64'));
    const run=()=>page.evaluate(async id=>{window.nativeTranslator=WFP.Uebersetzung.chromeUebersetzer('de','en');await __wfpdf.uebersetzeViele([id],'de','en',nativeTranslator,null,'chrome');},id);
    await t.test('foreground preparation carries no text; declined cleaning neither sends nor marks removal',async()=>{
      const pending=run();await page.waitForSelector('[data-ki-halt]');assert.equal(await page.evaluate(()=>chromeFixture.begins.length),1);assert.deepEqual(await page.evaluate(()=>chromeFixture.sent),[]);
      assert.deepEqual(await page.evaluate(()=>Object.keys(chromeFixture.begins[0]).sort()),['id','language','nach','von']);
      await page.click('.dlg:has([data-ki-halt]) [data-n]');await pending;assert.deepEqual(await page.evaluate(()=>chromeFixture.sent),[]);assert.equal(await page.evaluate(async id=>(await WFP.DB.get('docs',id)).kiEntfernt?.length||0,id),0);
      assert.equal(await page.evaluate(()=>chromeFixture.closed.length),1);
    });
    await page.evaluate(()=>document.querySelectorAll('.dlg [data-x]').forEach(b=>b.click()));
    await t.test('approved cleaning sends only visible text and creates a same-size PDF with retained original',async()=>{
      const pending=run();await page.waitForSelector('[data-ki-halt]');await page.click('.dlg:has([data-ki-halt]) [data-j]');await pending;
      const proof=await page.evaluate(async id=>{const source=await WFP.DB.get('docs',id),out=(await WFP.DB.all('docs')).find(d=>d.uebersetzung?.quelle===id);return {sent:chromeFixture.sent,removed:source.kiEntfernt,original:Array.from(await WFP.DB.getFile(id)),out:out&&Array.from(await WFP.DB.getFile(out.id)),closed:chromeFixture.closed,sourceCount:source.pages.length};},id);
      assert.equal(proof.sent.length,2);assert.ok(proof.sent.every(p=>p.texte.some(t=>t.includes('Sichtbarer'))&&!p.texte.join('').includes('VERSTECKTES_NATIVE_MUSTER')));assert.ok(proof.removed.length);assert.deepEqual(Buffer.from(proof.original),bytes);
      const result=await PDFDocument.load(Uint8Array.from(proof.out));assert.equal(result.getPageCount(),2);assert.deepEqual(result.getPage(0).getSize(),{width:595,height:842});assert.ok(proof.closed.includes('session-2'));
    });
    await page.evaluate(()=>document.querySelectorAll('.dlg [data-x]').forEach(b=>b.click()));
    await t.test('notification cancellation stops the active factory once and rejects late work',async()=>{
      const proof=await page.evaluate(async()=>{const fn=WFP.Uebersetzung.chromeUebersetzer('de','ru');let stops=0;fn.beimHalt=()=>stops++;await new Promise(r=>setTimeout(r,0));const id=chromeFixture.begins.at(-1).id;chromeFixture.events.forEach(e=>e({id:'stale',reason:'CHROME_CANCELLED'}));chromeFixture.events.forEach(e=>e({id,reason:'CHROME_CANCELLED'}));chromeFixture.events.forEach(e=>e({id,reason:'CHROME_CANCELLED'}));let rejected=false;try{await fn(['must not be sent']);}catch{rejected=true;}return{stops,rejected,sent:chromeFixture.sent.some(p=>p.texte.includes('must not be sent'))};});assert.deepEqual(proof,{stops:1,rejected:true,sent:false});
    });
    assert.deepEqual(errors,[]);await page.close();
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
