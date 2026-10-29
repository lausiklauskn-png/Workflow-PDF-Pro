// Scanner-Direktstart aus einer anderen Pro-App (Pro-Umbau 5): Intent „de.familyprojekt.workflowpdf.pro.SCANNEN“ (Extra „von“)
// → WorkflowScanDirekt meldet „scan“ → native-scan-direkt.js öffnet den Scanner über den Kern (scanDirektstart, wie ?scan=1).
// Die Android-Brücke ist gestellt (offen() liefert eine Anfrage, das Ereignis wird von Hand ausgelöst); ob Android den Intent
// aus BookLedgerPro wirklich zustellt, misst nur das Gerät. Die Java-Seite prüft ScanDirektTest (JVM) und hier der Quelltext.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {chromium} from 'playwright-core';
import {root} from './prepare-web.mjs';

test('Intent „Scanner direkt“: Manifest, Anmeldung, Plugin',async()=>{
  const m=await readFile(join(root,'android/app/src/main/AndroidManifest.xml'),'utf8');
  const a=await readFile(join(root,'android/app/src/main/java/de/familyprojekt/workflowpdf/pro/MainActivity.java'),'utf8');
  const p=await readFile(join(root,'android/app/src/main/java/de/familyprojekt/workflowpdf/pro/ProScanDirektPlugin.java'),'utf8');
  assert.match(m,/<action android:name="de\.familyprojekt\.workflowpdf\.pro\.SCANNEN" \/>\s*<category android:name="android\.intent\.category\.DEFAULT" \/>/);
  assert.match(a,/registerPlugin\(ProScanDirektPlugin\.class\);/);
  assert.match(p,/@CapacitorPlugin\(name = "WorkflowScanDirekt"\)/);
  assert.match(p,/ScanDirekt\.von\(intent\.getStringExtra\(ScanDirekt\.EXTRA_VON\)\)/,'Absender wird gesäubert');
  assert.doesNotMatch(p,/getData\(\)|getParcelableExtra|EXTRA_STREAM/,'keine Datei, keine Adresse aus dem Intent');
});

test('Scanner geht auf: Kaltstart und laufende App, „Durchsuchbar“ vorbelegt, Rückweg im Toast',async t=>{
  const base=join(root,'www');
  const server=createServer(async(req,res)=>{try{
    const path=resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(path!==base&&!path.startsWith(base+'/'))throw Error();
    const file=path===base?join(path,'index.html'):path;
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
  const browser=await chromium.launch(process.env.WFP_CHROMIUM?{executablePath:process.env.WFP_CHROMIUM}:{});t.after(()=>browser.close());
  async function seite(mitScan,anfrage){
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(([mitScan,anfrage])=>{
      const f={};for(const m of ['begin','append','finish','abort','save','share','print','openLink'])f[m]=async()=>({});f.appInfo=async()=>({version:'1.0.8'});
      const plugins={WorkflowFiles:f};
      if(mitScan){let offen=anfrage;let hoerer=null;
        plugins.WorkflowScanDirekt={offen:async()=>{const r=offen;offen=null;return r||{scan:false,von:''};},addListener:(n,fn)=>{if(n==='scan')hoerer=fn;return {remove(){}};}};
        window.__scanIntent=von=>{offen={scan:true,von};hoerer&&hoerer({});};}
      window.Capacitor={isNativePlatform:()=>true,Plugins:plugins};
      localStorage.setItem('wfpdf_scan_v1',JSON.stringify({durchsuchbar:false}));
    },[mitScan,anfrage]);
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>window.__wfpdf&&window.WFP?.Scanner);
    return {page,errors};
  }
  // Gegenprobe: ohne Anfrage (normaler Start) kein Scanner
  {const {page}=await seite(true,null);await new Promise(r=>setTimeout(r,800));
   assert.equal(await page.locator('.scan').count(),0,'normaler Start öffnet keinen Scanner');
   // laufende App: der Intent kommt, der Scanner geht auf
   await page.evaluate(()=>__scanIntent('BookLedgerPro'));
   await page.waitForSelector('.scan',{timeout:15000});
   const d=await page.evaluate(()=>({d:window.__wfpdfDirektstart,s:WFP.Scanner.zustand().durchsuchbar,url:location.search,toast:document.getElementById('toast').textContent}));
   assert.equal(d.d.von,'BookLedgerPro');assert.equal(d.s,true,'„Durchsuchbar“ für diesen Scan');
   assert.equal(await page.evaluate(()=>document.querySelector('.scan [data-durch]')?.checked),true,'Haken „Durchsuchbar“ sichtbar gesetzt (Befund Tablet 2026-10-29)');
   assert.equal(d.url,'','Adresse geputzt');assert.match(d.toast,/BookLedgerPro/);assert.match(d.toast,/Teilen/);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('wfpdf_scan_v1')).durchsuchbar),false,'gemerkte Wahl bleibt');
   // zweiter Intent, während der Scanner offen ist: kein zweiter Scanner darüber
   await page.evaluate(()=>__scanIntent('BookLedgerPro'));await new Promise(r=>setTimeout(r,600));
   assert.equal(await page.locator('.scan').count(),1);
   await page.close();}
  // Kaltstart: die Anfrage liegt schon beim Laden bereit
  {const {page,errors}=await seite(true,{scan:true,von:'BookLedgerPro'});
   await page.waitForSelector('.scan',{timeout:15000});
   assert.equal(await page.evaluate(()=>window.__wfpdfDirektstart?.von),'BookLedgerPro');
   assert.deepEqual(errors,[]);await page.close();}
  // ohne Plugin (ältere Hülle, Windows): nichts
  {const {page}=await seite(false,null);await new Promise(r=>setTimeout(r,800));
   assert.equal(await page.evaluate(()=>typeof window.WFPNativeScanDirekt),'undefined');await page.close();}
});
