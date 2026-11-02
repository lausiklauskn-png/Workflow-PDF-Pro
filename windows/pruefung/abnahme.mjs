// Windows-Abnahme: hängt sich per CDP an die installierte App (Prüfbau "messprobe")
// und übt die Produktfälle im echten WebView2-Fenster aus.
// Aufruf: node abnahme.mjs <phase> <ausgabe.json>
//   erst        – Einlesen, Ausgaben, Texterkennung, Speichern, Ordner, Tresor anlegen, Öffnen mit, Chrome-Abbruch
//   neustart    – Daten aus dem Tresor, Sperren, falsches/richtiges Passwort
//   abgezogen   – Tresorordner fehlt: gesperrt statt leerer Bibliothek
//   neuinstallation – Daten nach Deinstallation + Neuinstallation
// Läuft auf einem GitHub-Windows-Rechner, nicht auf Klaus' PC.
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFile, readFile, readdir, mkdir } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { join, delimiter } from 'node:path';
import { createHash } from 'node:crypto';

const [phase = 'erst', out = 'abnahme.json'] = process.argv.slice(2);
const env = name => { const v = process.env[name]; if (!v) throw new Error('Umgebung fehlt: ' + name); return v; };
const PASSWORT = 'Prüf-Passwort für Windows 2026';
const NEUES_PASSWORT = 'Neues Prüf-Passwort nach Ersatzschlüsseln';
const result = { phase, zeit: new Date().toISOString(), checks: {}, fehler: [], rot: [] };
const save = () => writeFile(out, JSON.stringify(result, null, 2));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));
// App-Version aus derselben Quelle wie der Bau (tauri.conf.json), nicht fest im Test
const APP_VERSION = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8')).version;

async function step(name, fn, ms = 180000) {
  console.log('-> ' + name);
  try {
    const value = await Promise.race([fn(), sleep(ms).then(() => { throw new Error('Zeitgrenze ' + ms + ' ms'); })]);
    result.checks[name] = value ?? true;
  } catch (error) {
    result.checks[name] = { fehler: String(error?.message || error) };
    result.rot.push(name);
  }
  console.log('   ' + JSON.stringify(result.checks[name]).slice(0, 600));
  await save();
}
const expect = (ok, text) => { if (!ok) throw new Error(text); };

let browser;
for (let i = 0; i < 60 && !browser; i++) {
  try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 10000 }); } catch { await sleep(1000); }
}
if (!browser) throw new Error('WebView2 nicht per CDP erreichbar');
const pages = () => browser.contexts().flatMap(c => c.pages());
// Rohliste aller WebView2-Ziele, unabhängig davon, was Playwright schon verbunden hat.
const targets = () => fetch('http://127.0.0.1:9222/json').then(r => r.json()).then(list => list.map(t => t.type + ':' + t.url)).catch(e => ['CDP: ' + e.message]);
async function findPage(test, ms = 60000) {
  const end = Date.now() + ms;
  let reconnected = false;
  while (Date.now() < end) {
    const page = pages().find(p => test(p.url()));
    if (page) return page;
    // Ein neues Fenster, das Playwright noch nicht kennt: neu verbinden.
    if (!reconnected && (await targets()).some(t => test(t.replace(/^[a-z_]+:/, '')))) {
      reconnected = true;
      browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 10000 });
      continue;
    }
    await sleep(500);
  }
  throw new Error('Fenster nicht gefunden; Playwright: ' + pages().map(p => p.url()).join(', ') + ' | WebView2: ' + (await targets()).join(', '));
}
const isMain = url => /^https:\/\/tauri\.localhost\/(index\.html)?(\?[^#]*)?(#.*)?$/.test(url);
let page = await findPage(isMain);
const watch = p => p.on('pageerror', e => result.fehler.push(String(e.message)));
watch(page);
async function ready() {
  page = await findPage(isMain);
  await page.waitForFunction(() => window.__wfpdf && window.PDFLib && window.WFP?.DB && window.WFPNativeVault, null, { timeout: 90000 });
}
await ready();
const docs = () => page.evaluate(() => window.__wfpdf.S.docs.length);
const vaultState = () => page.evaluate(() => Capacitor.Plugins.WorkflowVault.state({}));
async function waitDocs(n, ms = 60000) {
  await page.waitForFunction(n => window.__wfpdf?.S?.docs?.length === n, n, { timeout: ms });
  return n;
}
async function makePdf(title, withField) {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 2; i++) pdf.addPage([595, 842]).drawText(title + ' ' + (i + 1), { x: 45, y: 770, font });
  if (withField) { const f = pdf.getForm().createTextField('Name'); f.setText('Müller'); f.addToPage(pdf.getPage(0), { x: 50, y: 650, width: 220, height: 25 }); }
  return Buffer.from(await pdf.save());
}
async function password(text, expectFailure) {
  const dialog = await findPage(url => url.includes('/windows/kennwort.html'));
  watch(dialog);
  const denied = await dialog.evaluate(() => window.__TAURI_INTERNALS__.invoke('wfp_update', {operation: 'status'}).then(() => false, error => String(error) === 'NOT_ALLOWED'));
  expect(denied, 'Password window must not have update privileges');
  await dialog.waitForSelector('#erstes');
  await dialog.fill('#erstes', text);
  if (await dialog.isVisible('#zweites')) await dialog.fill('#zweites', text);
  if (await dialog.isVisible('#hinweis')) await dialog.check('#hinweis');
  await dialog.check('#merken');
  await dialog.click('#weiter');
  if (expectFailure) {
    await dialog.waitForFunction(() => /falsch/.test(document.getElementById('status').textContent), null, { timeout: 120000 });
    return dialog;
  }
  const end = Date.now() + 120000;
  while (pages().some(p => p.url().includes('/windows/kennwort.html'))) {
    if (Date.now() > end) throw new Error('Passwortfenster blieb offen: ' + await dialog.textContent('#status').catch(() => '?'));
    await sleep(300);
  }
  return null;
}
const clickText = (text) => page.locator('dialog[open] button', { hasText: text }).first().click();

await step('umgebung', () => page.evaluate(async () => ({
  url: location.href, plattform: Capacitor.getPlatform(), host: document.documentElement.dataset.wfpHost,
  adapter: ['WFPNativeFiles', 'WFPNativeImport', 'WFPNativeIncoming', 'WFPNativeVault', 'WFPNativeNavigation'].filter(n => !window[n]),
  chromeTransport: WFP.Uebersetzung?.chromeUebersetzer?.toString().includes('api.begin') ?? false,
  translator: 'Translator' in self ? await Translator.availability({ sourceLanguage: 'de', targetLanguage: 'en' }).catch(e => 'fehler:' + e.message) : 'fehlt',
  serviceWorker: await Promise.race([navigator.serviceWorker.ready.then(() => 'aktiv'), new Promise(r => setTimeout(() => r('nicht bereit'), 15000))]),
  userAgent: navigator.userAgent
})).then(v => { expect(v.plattform === 'windows' && v.host === 'windows' && !v.adapter.length, 'Brücke/Adapter fehlen'); return v; }));

// Diese Phasen prüfen die native Brücke mit erfundenen Daten und einem kanonischen
// Familienakte-Akteur. Der normale App-Import und zwei installierte Apps sind eigene Proben.
const commonFile=()=>join(env('WFP_PRUEF_ARBEIT'),'pro-tresor-probe.json');
if(phase==='proErst') {
  await step('freiwilligeNativeVerbindungOhneEigeneAblage',async()=>{
    const ownBefore=await vaultState();expect(!ownBefore.configured,'Probe verlangt noch keine eigene Workflow-Ablage');
    const fixture=JSON.parse(await readFile(commonFile(),'utf8'));
    await page.evaluate(()=>{window.__proConnect={};Capacitor.Plugins.WorkflowVault.tresorVerbinden({language:'de',neuWaehlen:true}).then(value=>{window.__proConnect={value};},error=>{window.__proConnect={error:String(error)};});});
    await password('falsches Pro-Kennwort 2026',true);
    await password('Erfundene Pro-Probe ä 2026');
    await page.waitForFunction(()=>window.__proConnect?.value||window.__proConnect?.error);
    const connected=await page.evaluate(()=>window.__proConnect);expect(!connected.error,connected.error);
    expect(connected.value.offen&&connected.value.gemerkt&&!connected.value.eingezogen&&connected.value.kennung===fixture.vaultId,'Eigenständige Verbindung fehlt');
    const result=await page.evaluate(async fixture=>{
      const api=Capacitor.Plugins.WorkflowVault,base={vaultId:fixture.vaultId,entryId:fixture.entryId};
      const inbox=await api.tresorUebergabe({...base,aktion:'eingang'});
      const file=await api.tresorUebergabe({...base,aktion:'lesen'});
      const afterRead=await api.tresorUebergabe({...base,aktion:'eingang'});
      const wrong=await api.tresorUebergabe({...base,vaultId:'falscher-tresor',aktion:'lesen'}).then(()=>false,e=>String(e.code||e.message).includes('TRESOR_UEBERGABE_FREMD'));
      const wrongHash=await api.tresorUebergabe({...base,aktion:'quittieren',sha256:'0'.repeat(64)}).then(()=>false,e=>String(e.code||e.message).includes('TRESOR_UEBERGABE_PRUEFSUMME'));
      await api.tresorSperren({});const locked=await api.tresorZustand({});
      const denied=await api.tresorUebergabe({...base,aktion:'lesen'}).then(()=>false,e=>String(e.code||e.message).includes('TRESOR_GESPERRT'));
      const again=await api.tresorVerbinden({language:'de'});
      const contract={vertrag:'familienakte-uebergabe/1',id:'windows-workflow-17',quelle:'workflow-pdf-pro',ziel:'familienakte',dokumentId:'native-probe-17',bezug:'windows-family-17',name:'Probe.txt',mime:'text/plain',groesse:fixture.size,sha256:fixture.sha256};
      const send={vaultId:fixture.vaultId,aktion:'senden',vertrag:contract,dataBase64:file.dataBase64};
      const first=await api.tresorUebergabe(send),repeat=await api.tresorUebergabe(send);
      const waiting=await api.tresorUebergabe({...base,aktion:'stand',ziel:'familienakte',entryId:first.id});
      // Explizite native Methodenprobe, keine Behauptung eines gewöhnlichen Workflow-Imports.
      await api.tresorUebergabe({...base,aktion:'quittieren',sha256:fixture.sha256});
      return {count:inbox.items.length,unmarked:afterRead.items.length,wrong,wrongHash,locked:!locked.offen,denied,again:again.offen,back:first.id,repeat:repeat.id,waiting:waiting.bestaetigt,data:file.dataBase64};
    },fixture);
    expect(result.count===1&&result.unmarked===1&&result.wrong&&result.wrongHash&&result.locked&&result.denied&&result.again,'Native Schutzregeln: '+JSON.stringify({...result,data:undefined}));
    expect(sha(Buffer.from(result.data,'base64'))===fixture.sha256&&result.back===result.repeat&&!result.waiting,'Original/Idempotenz/Rückmeldung');
    expect(!(await vaultState()).configured,'Verbindung hat eine eigene Ablage eingerichtet');
    await writeFile(commonFile(),JSON.stringify({...fixture,back:result.back}));
    return {ohneEigeneAblage:true,dialogUndDPAPI:true,manuellesSperren:true,originalGeprueft:true,rueckwegOffen:true};
  });
}
if(phase==='proNeustart'||phase==='proNeuinstallation') {
  await step('gemerkterProTresorNachNeustart',async()=>{
    const fixture=JSON.parse(await readFile(commonFile(),'utf8'));
    const state=await page.evaluate(()=>Capacitor.Plugins.WorkflowVault.tresorZustand({}));
    expect(state.offen&&state.gemerkt&&state.kennung===fixture.vaultId,'DPAPI/Ordnerbindung nach Neustart fehlen');
    const status=await page.evaluate(async fixture=>{
      const api=Capacitor.Plugins.WorkflowVault;
      return {inbox:await api.tresorUebergabe({aktion:'eingang',vaultId:fixture.vaultId}),back:await api.tresorUebergabe({aktion:'stand',vaultId:fixture.vaultId,ziel:'familienakte',entryId:fixture.back})};
    },fixture);
    expect(status.inbox.items.length===0,'Quittierter nativer Eingang wieder offen');
    if(phase==='proNeustart') {
      expect(!status.back.bestaetigt,'Senden wurde als Empfang ausgegeben');
      const java=join(process.env.JAVA_HOME,'bin','java.exe');
      const cp=[join(process.cwd(),'work/pro-tresor-probe'),join(process.cwd(),'windows/src-tauri/pro-tresor/workflow-pro-tresor.jar')].join(delimiter);
      const received=JSON.parse(execFileSync(java,['-cp',cp,'de.familyprojekt.workflowpdf.pro.ProVerbundProbe','confirm',env('WFP_PRUEF_PRO_TRESOR')],{encoding:'utf8'}));
      expect(received.confirmed,'Kanonischer Empfänger bestätigt nicht');
    }
    const confirmed=await page.evaluate(f=>Capacitor.Plugins.WorkflowVault.tresorUebergabe({aktion:'stand',vaultId:f.vaultId,ziel:'familienakte',entryId:f.back}),fixture);
    expect(confirmed.bestaetigt,'Empfängermarke nicht sichtbar');
    return {gemerkt:true,quittungDauerhaft:true,echteEmpfaengermarke:true,probenart:'native Brücke; Familienakte als kanonischer Java-Akteur'};
  });
}
if(phase==='proAbgezogen') {
  await step('entfernterProTresorBleibtUnerreichbar',async()=>{
    const fixture=JSON.parse(await readFile(commonFile(),'utf8'));
    const result=await page.evaluate(async f=>({state:await Capacitor.Plugins.WorkflowVault.tresorZustand({}),denied:await Capacitor.Plugins.WorkflowVault.tresorUebergabe({aktion:'eingang',vaultId:f.vaultId}).then(()=>false,()=>true)}),fixture);
    expect(result.state.erreichbar===false&&!result.state.offen&&result.denied,'Entfernter Ordner wird weiter benutzt');
    return result;
  });
}
// Ordinary packaged Workflow UI plus native Java/DPAPI/real files. The partner
// remains the explicitly labelled canonical Family actor, not an installed app.
const commonUiFile=()=>join(env('WFP_PRUEF_ARBEIT'),'pro-ui-proof.json');
function commonUiActor(action,file){
  const java=join(process.env.JAVA_HOME,'bin','java.exe');
  const cp=[join(process.cwd(),'work/pro-tresor-probe'),join(process.cwd(),'windows/src-tauri/pro-tresor/workflow-pro-tresor.jar')].join(delimiter);
  return JSON.parse(execFileSync(java,['-cp',cp,'de.familyprojekt.workflowpdf.pro.ProVerbundProbe',action,env('WFP_PRUEF_PRO_TRESOR'),file],{encoding:'utf8'}));
}
if(phase==='proBedienung') {
  await step('auswahlDauerhaftEinlesenUndNormalZurueckgeben',async()=>{
    await page.waitForFunction(()=>window.WFPProVerbund&&!WFPNativeVault.gate.blocked);
    const before=await docs(),input=await makePdf('Erfundener Pro-Verbund',true),path=join(env('WFP_PRUEF_ARBEIT'),'pro-ui-input.pdf');await writeFile(path,input);
    const fixture=commonUiActor('ui-seed',path);
    await page.evaluate(()=>WFPProVerbund.dialog());
    await page.locator(`[data-pro-entry="${fixture.entryId}"] input`).check();await page.click('#nativeProVerbund [data-pro-action="receive"]');
    await page.waitForFunction(()=>document.querySelector('#nativeProVerbund [data-pro-status]')?.textContent.includes('Auswahl gespeichert'));
    expect(await docs()===before+1,'Auswahl wurde nicht genau einmal aufgenommen');
    const received=await page.evaluate(async()=>{
      const row=(await WFPProTransferStore.snapshot()).find(r=>r.kind==='eingang'&&r.source.transfer==='windows-family-ui');
      const doc=await WFP.DB.get('docs',row.docId),original=await WFP.DB.get('files',row.docId+'~original');
      return {id:doc.id,stand:row.stand,hash:await WFPProTransferStore.hash(original.bytes),pages:doc.pages.length,checked:!!doc.pruefung};
    });
    expect(received.stand==='gespeichert'&&received.hash===fixture.sha256&&received.pages===2&&!received.checked,'Original/Quittung/manueller Prüfstatus fehlen');
    await page.click('#nativeProVerbund [data-pro-action="close"]');
    const shareConsole=[];page.on('console',m=>{if(m.type()==='error')shareConsole.push(m.text());});
    await page.evaluate(id=>{window.__proShare={};void __wfpdf.dlg.teilenDocs([id]).then(()=>window.__proShare.done=true,error=>window.__proShare.error=String(error));},received.id);
    try {await page.click('#nativeProTarget [data-pro-action="familienakte"]');}
    catch(error){
      const detail=await page.evaluate(()=>({share:window.__proShare,output:window.__wfpdfTeilen,dialogs:[...document.querySelectorAll('dialog,.dlg')].map(d=>d.textContent.slice(0,1500)),toast:document.querySelector('#toast')?.textContent}));
      await page.screenshot({path:out.replace(/\.json$/,'.png')});
      throw Error(error.message+' '+JSON.stringify({detail,shareConsole}));
    }
    await page.waitForSelector('#nativeProTarget',{state:'detached'});
    const rows=await page.evaluate(()=>WFPProTransfers.outbox());expect(rows.length===1&&rows[0].stand==='weitergegeben','Keine dauerhafte offene Ausgabe');
    expect(rows[0].vertrag.dokumentId==='family-doc-ui'&&rows[0].vertrag.bezug==='windows-family-ui','Ausgabe der falschen Akte zugeordnet');
    await writeFile(commonUiFile(),JSON.stringify({fixture,received,row:rows[0],docs:before+1}));
    return {bibliothek:true,originalGeprueft:true,normalesTeilen:true,empfangNochOffen:true};
  });
}
if(phase==='proBedienungNeustart') {
  await step('ausgangNachNeustartUndTatsaechlicherEmpfang',async()=>{
    await page.waitForFunction(()=>window.WFPProVerbund&&!WFPNativeVault.gate.blocked);
    const saved=JSON.parse(await readFile(commonUiFile(),'utf8'));expect(await docs()===saved.docs,'Bibliothek nach Neustart verändert');
    const retry=await page.evaluate(id=>WFPProTransfers.retry(id),saved.row.id);
    expect(retry.entryId===saved.row.entryId&&retry.vertrag.sha256===saved.row.vertrag.sha256&&retry.stand==='weitergegeben','Wiederholung erzeugte andere Ausgabe oder falsche Quittung');
    const output=join(env('WFP_PRUEF_ARBEIT'),'pro-ui-return.pdf'),receipt=commonUiActor('ui-confirm',output);
    expect(receipt.confirmed&&receipt.workflowAccepted,'Der kanonische Partner sieht keinen dauerhaften Workflow-Empfang');
    const bytes=await readFile(output);expect(sha(bytes)===saved.row.vertrag.sha256&&(await PDFDocument.load(bytes)).getPageCount()===2,'Gewählte PDF-Ausgabe ist verändert');
    await page.evaluate(()=>WFPProVerbund.dialog());await page.click(`[data-pro-outgoing="${saved.row.id}"] [data-pro-action="confirm"]`);
    await page.waitForFunction(()=>document.querySelector('#nativeProVerbund [data-pro-status]')?.textContent==='In der Ziel-App gespeichert');
    const row=(await page.evaluate(()=>WFPProTransfers.outbox()))[0];expect(row.stand==='im-eingang','Empfängermarke wurde nicht dauerhaft gespeichert');
    expect(await page.evaluate(id=>WFP.DB.get('files',id).then(Boolean),saved.row.payloadId)===false,'Bestätigte Arbeitskopie wurde nicht freigegeben');
    return {neustart:true,identischeAusgabe:true,empfaengermarke:true,probenart:'installierte Workflow-App; Familienakte als kanonischer Java-Akteur'};
  });
}

if (phase === 'erst') {
  await step('sicherheitUndUpdates', async () => {
    const policy = await page.evaluate(async () => {
      const probe=await window.__WFPCspProbe;
      return {...probe,
        updateAdapter: typeof window.WFPWindowsUpdates?.check === 'function',
        status: await window.__TAURI_INTERNALS__.invoke('wfp_update', {operation: 'status'})};
    });
    expect(policy.evalBlocked && policy.inlineBlocked && policy.updateAdapter && policy.status.current === APP_VERSION, 'CSP/update adapter: ' + JSON.stringify(policy));
    return policy;
  });
  // Versionsnummer (Klaus 2026-10-22): im Fuß die App-Nummer aus Tauri, nie die der Webversion
  await step('versionsnummer', async () => {
    await page.waitForFunction(v => document.getElementById('versionFuss')?.textContent === 'Version ' + v, APP_VERSION, { timeout: 15000 }).catch(() => {});
    const v = await page.evaluate(() => ({ fuss: document.getElementById('versionFuss')?.textContent || '', sichtbar: !!document.getElementById('versionFuss')?.checkVisibility() }));
    expect(v.fuss === 'Version ' + APP_VERSION && v.sichtbar, 'Versionsnummer im Fuß: ' + JSON.stringify(v));
    return v;
  });
  await step('eingebetteteSicherheitshilfe', () => page.evaluate(async () => {
    // The existing Mycel wizard embeds this local help page.
    const frame=document.createElement('iframe');frame.src='sicherheit.html';frame.hidden=true;document.body.append(frame);
    try {
      await new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=reject;setTimeout(()=>reject(Error('Sicherheitshilfe lädt nicht')),15000);});
      if((frame.contentDocument?.body?.textContent||'').trim().length<100) throw Error('Sicherheitshilfe durch CSP blockiert');
      return {lokaleHilfeErreichbar:true};
    } finally {frame.remove();}
  }));
  const form = await makePdf('Workflow PDF Pro Windows', true);
  const dir = env('WFP_PRUEF_ARBEIT');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'Formular.pdf'), form);
  await step('einlesen', async () => {
    await page.setInputFiles('#inDatei', join(dir, 'Formular.pdf'), { timeout: 30000 });
    await page.waitForFunction(() => window.__wfpdf.S.doc?.fields?.length > 0, null, { timeout: 60000 });
    const v = await page.evaluate(async () => { const d = window.__wfpdf.S.doc; const b = await WFP.DB.getFile(d.id); return { seiten: d.pages.length, feld: d.fields[0].value, bytes: b.length, sha: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b))).map(x => x.toString(16).padStart(2, '0')).join('') }; });
    expect(v.seiten === 2 && v.feld === 'Müller' && v.sha === sha(form), 'Original/Felder abweichend');
    return v;
  });
  await step('ausgaben', () => page.evaluate(async () => {
    const w = window.__wfpdf, r = {};
    for (const m of ['ausfuellbar', 'fest', 'vorlage']) { const e = await WFP.Export.exportieren(w.S.doc, w.S.bytes, m); r[m] = new TextDecoder('latin1').decode(e.bytes.slice(0, 5)) === '%PDF-' ? e.bytes.length : 0; }
    return r;
  }).then(v => { expect(v.ausfuellbar && v.fest && v.vorlage, 'PDF-Ausgabe fehlt'); return v; }));
  await step('arbeitsstandVorUpdate', () => page.evaluate(async () => {
    const doc=window.__wfpdf.S.doc, original=doc.fields[0].value;
    doc.fields[0].value='Müller – Update-Speicherprobe';
    const gate=await WFPWindowsUpdates.saveBeforeRestart();
    try {
      const saved=await gate.target.get('docs',doc.id);
      if(saved.fields[0].value!==doc.fields[0].value || !gate.blocked) throw Error('Arbeitsstand nicht vor Neustart gespeichert');
      return {gespeichert:true,angehalten:gate.blocked};
    } finally {
      gate.resume();doc.fields[0].value=original;await WFP.DB.put('docs',structuredClone(doc));
    }
  }));
  await step('texterkennung', () => page.evaluate(async () => {
    if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/tesseract/tesseract.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const abs = u => new URL(u, location.href).href;
    const w = await Tesseract.createWorker('deu', 1, { workerPath: abs('vendor/tesseract/worker.min.js'), corePath: abs('vendor/tesseract/'), langPath: abs('vendor/tesseract/lang'), gzip: false, cacheMethod: 'none' });
    const c = document.createElement('canvas'); c.width = 1200; c.height = 200; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 1200, 200); g.fillStyle = '#000'; g.font = '64px Arial'; g.fillText('Antrag Bewohnerparkausweis', 30, 120);
    const r = await w.recognize(c); await w.terminate(); return r.data.text.trim();
  }).then(v => { expect(/Bewohnerparkausweis/.test(v), 'Texterkennung falsch'); return v; }));
  await step('bedeutungBibliothekUnterCsp', () => page.evaluate(async () => {
    const url=URL.createObjectURL(new Blob([`import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2').then(m=>self.postMessage({ok:typeof m.pipeline==='function'})).catch(e=>self.postMessage({error:String(e)}));`], {type:'text/javascript'}));
    const worker=new Worker(url,{type:'module'});
    try {
      const result=await new Promise((resolve,reject)=>{worker.onmessage=e=>resolve(e.data);worker.onerror=e=>reject(Error(e.message));setTimeout(()=>reject(Error('Modellbibliothek lädt nicht')),60000);});
      if(!result.ok)throw Error(result.error||'Bedeutungssuche durch CSP blockiert');
      return {modellBibliothekImWorker:true,keinModellDownload:true};
    } finally {worker.terminate();URL.revokeObjectURL(url);}
  }));
  await step('speichernUnter', async () => {
    const target = env('WFP_PRUEF_SPEICHERN');
    await mkdir(target, { recursive: true });
    const answer = await page.evaluate(async () => {
      const w = window.__wfpdf, e = await WFP.Export.exportieren(w.S.doc, w.S.bytes, 'fest');
      const r = await WFPNativeFiles.save(new Blob([e.bytes], { type: 'application/pdf' }), 'Ausgabe Prüfung.pdf');
      return { r, sha: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', e.bytes))).map(x => x.toString(16).padStart(2, '0')).join('') };
    });
    const written = await readFile(join(target, 'Ausgabe Prüfung.pdf'));
    expect(answer.r.saved === true && sha(written) === answer.sha, 'Gespeicherte Datei weicht ab');
    return { ...answer.r, bytes: written.length };
  });
  await step('ordnerEinlesen', async () => {
    const folder = env('WFP_PRUEF_IMPORT');
    await mkdir(join(folder, 'Unterordner'), { recursive: true });
    await writeFile(join(folder, 'Brief 2.pdf'), await makePdf('Brief zwei'));
    await writeFile(join(folder, 'Unterordner', 'Brief 10.pdf'), await makePdf('Brief zehn'));
    const before = await docs();
    await page.evaluate(() => WFPNativeImport.choose(document.getElementById('inOrdner')));
    return { vorher: before, nachher: await waitDocs(before + 2) };
  });
  await step('tresorAnlegen', async () => {
    const before = await docs();
    await page.evaluate(() => { void WFPNativeVault.manage(); });
    await clickText('Ordner wählen');
    try { await password(PASSWORT); }
    catch (error) {
      const info = await page.evaluate(async () => ({ state: await Capacitor.Plugins.WorkflowVault.state({}).catch(e => e.message), dialoge: [...document.querySelectorAll('dialog[open]')].map(d => d.textContent.slice(0, 160)) })).catch(e => e.message);
      throw new Error(error.message + ' | Zustand: ' + JSON.stringify(info));
    }
    await clickText('Übernahme starten');
    await sleep(3000);
    await ready();
    await waitDocs(before, 90000);
    const state = await vaultState();
    const root = join(env('WFP_PRUEF_TRESOR'), 'Workflow PDF Pro');
    const names = await readdir(root);
    expect(state.unlocked === true && state.primary === true && names.includes('workflow-pdf-pro.tresor.json') && names.filter(n => n.endsWith('.wpv')).length > 3, 'Tresor nicht angelegt: ' + JSON.stringify(state));
    // Die PDF-Bytes liegen verschlüsselt im Ordner, nicht im Klartext.
    for (const name of names.filter(n => n.endsWith('.wpv'))) expect(!(await readFile(join(root, name))).includes(Buffer.from('%PDF-')), 'Klartext im Tresor');
    return { dokumente: before, datensaetze: state.records, dateien: names.length };
  });
  await step('ersatzschluesselErzeugen', async () => {
    await page.evaluate(() => { void WFPNativeVault.manage(); });
    await page.waitForFunction(() => /Noch keine Ersatzschlüssel/.test(document.getElementById('nativeVaultRecovery')?.textContent || ''), null, { timeout: 30000 });
    await clickText('Ersatzschlüssel für die Ablage erzeugen');
    const win = await findPage(url => url.includes('/windows/ersatz.html'), 60000);
    watch(win);
    await win.waitForFunction(() => document.querySelectorAll('#teile li').length === 5, null, { timeout: 60000 });
    const shares = await win.evaluate(() => [...document.querySelectorAll('#teile li')].map(li => li.textContent));
    expect(shares.every(s => /^WFP1(-[0-9A-Z]{1,5})+$/.test(s)) && new Set(shares).size === 5, 'Teile ungültig: ' + shares.join(' '));
    // Das Hauptfenster darf die Teile nicht abrufen.
    const mainDenied = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('wfp_dialog', { action: 'anzeigen' }).then(() => false, e => String(e) === 'NOT_ALLOWED'));
    expect(mainDenied, 'Hauptfenster konnte Ersatzschlüssel lesen');
    expect(await win.isDisabled('#fertig'), 'Fertig ohne Bestätigung möglich');
    await win.click('#speichern');
    await win.waitForFunction(() => /gespeichert/.test(document.getElementById('status').textContent), null, { timeout: 30000 });
    const file = await readFile(join(env('WFP_PRUEF_SPEICHERN'), 'Workflow-PDF-Pro-Ersatzschluessel.txt'), 'utf8');
    expect(shares.every(s => file.includes(s)), 'Datei enthält nicht alle Teile');
    await win.check('#bestaetigt');
    await win.click('#fertig');
    const end = Date.now() + 30000;
    while (pages().some(p => p.url().includes('/windows/ersatz.html'))) { if (Date.now() > end) throw new Error('Ersatzschlüsselfenster blieb offen'); await sleep(300); }
    await page.waitForFunction(() => /Ersatzschlüssel vorhanden/.test(document.getElementById('nativeVaultRecovery')?.textContent || ''), null, { timeout: 30000 });
    await clickText('Schließen');
    const names = await readdir(join(env('WFP_PRUEF_TRESOR'), 'Workflow PDF Pro'));
    expect(names.filter(n => n.startsWith('workflow-pdf-pro.ersatz-')).length === 1, 'Ersatzschlüsseldatei fehlt');
    await writeFile(join(env('WFP_PRUEF_ARBEIT'), 'ersatz.json'), JSON.stringify(shares));
    return { teile: shares.length, datei: true, hauptfensterGesperrt: mainDenied };
  });
  await step('oeffnenMit', async () => {
    const file = join(env('WFP_PRUEF_ARBEIT'), 'Geteilt.pdf');
    await writeFile(file, await makePdf('Geöffnet mit'));
    const before = await docs();
    spawn(env('WFP_APP_EXE'), [file], { detached: true, stdio: 'ignore' }).unref();
    await page.waitForSelector('#nativeIncoming button', { state: 'attached', timeout: 60000 });
    const button = page.locator('#nativeIncoming').getByRole('button', { name: 'Einlesen', exact: true });
    const sichtbar = await button.isVisible();
    const offen = await page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map(d => d.textContent.slice(0, 80)));
    await button.click({ timeout: 10000 }).catch(() => button.evaluate(b => b.click()));
    return { vorher: before, nachher: await waitDocs(before + 1), sichtbar, offeneDialoge: offen };
  });
  await step('chromeAbbruch', async () => {
    const begin = await page.evaluate(() => Capacitor.Plugins.WorkflowChrome.begin({ von: 'de', nach: 'en', language: 'de' }));
    const status = await findPage(url => url.includes('/windows/uebersetzung.html'), 30000);
    await page.evaluate(id => { window.__wfpChromeProbe = Capacitor.Plugins.WorkflowChrome.translate({ id, texte: ['Guten Tag'] }).then(() => 'fertig', e => e.message); window.__wfpStopped = null; Capacitor.Plugins.WorkflowChrome.addListener('stopped', e => { window.__wfpStopped = e.reason; }); }, begin.id);
    await sleep(8000);
    await status.click('#abbrechen');
    const outcome = await page.evaluate(() => window.__wfpChromeProbe);
    await page.waitForFunction(() => window.__wfpStopped, null, { timeout: 20000 });
    const stopped = await page.evaluate(() => window.__wfpStopped);
    expect(['CHROME_CANCELLED', 'CHROME_NOT_INSTALLED'].includes(outcome), 'Unerwartet: ' + outcome);
    return { ergebnis: outcome, beendet: stopped };
  });
  await page.screenshot({ path: out.replace(/\.json$/, '.png'), timeout: 20000 }).catch(() => {});
}

if (phase === 'neustart') {
  await step('tresorNachNeustart', async () => {
    const state = await vaultState();
    await waitDocs(4, 90000);
    const first = await page.evaluate(async () => { const d = window.__wfpdf.S.docs.find(x => /Formular/.test(x.name)); return d ? (await WFP.DB.getFile(d.id)).length : 0; });
    expect(state.unlocked && first > 1000, 'Tresordaten nach Neustart fehlen');
    return { entsperrt: state.unlocked, dokumente: 4, originalBytes: first };
  });
  await step('sperrenUndEntsperren', async () => {
    await page.evaluate(() => { void WFPNativeVault.manage(); });
    await clickText('Ablage sperren');
    await page.waitForFunction(() => 'wfpVaultLocked' in document.documentElement.dataset, null, { timeout: 60000 });
    const locked = await vaultState();
    expect(!locked.unlocked, 'nicht gesperrt');
    await clickText('Entsperren');
    const dialog = await password('falsches Passwort 123', true);
    const wrong = await dialog.textContent('#status');
    await password(PASSWORT);
    await sleep(2000);
    await ready();
    await waitDocs(4, 90000);
    return { gesperrt: locked.problem, falschesPasswort: wrong, danach: (await vaultState()).unlocked };
  });
}

if (phase === 'neustart') {
  await step('passwortVergessen', async () => {
    const shares = JSON.parse(await readFile(join(env('WFP_PRUEF_ARBEIT'), 'ersatz.json'), 'utf8'));
    await page.evaluate(() => { void WFPNativeVault.manage(); });
    await clickText('Ablage sperren');
    await page.waitForFunction(() => 'wfpVaultLocked' in document.documentElement.dataset, null, { timeout: 60000 });
    await clickText('Entsperren');
    const dialog = await findPage(url => url.includes('/windows/kennwort.html'));
    watch(dialog);
    await dialog.click('#vergessen');
    await dialog.waitForSelector('#teil1');
    // Tippfehler in einem Teil wird erkannt; nichts wird verändert.
    const typo = shares[0].slice(0, 12) + (shares[0][12] === 'A' ? 'B' : 'A') + shares[0].slice(13);
    await dialog.fill('#teil1', typo); await dialog.fill('#teil2', shares[1]); await dialog.fill('#teil3', shares[3]);
    await dialog.fill('#neu1', NEUES_PASSWORT); await dialog.fill('#neu2', NEUES_PASSWORT);
    await dialog.click('#weiter');
    await dialog.waitForFunction(() => /falsch abgetippt/.test(document.getElementById('status').textContent), null, { timeout: 60000 });
    const typoText = await dialog.textContent('#status');
    // Nur zwei Teile reichen nicht.
    await dialog.fill('#teil1', ''); await dialog.fill('#neu1', NEUES_PASSWORT); await dialog.fill('#neu2', NEUES_PASSWORT);
    await dialog.click('#weiter');
    await dialog.waitForFunction(() => /drei verschiedene/.test(document.getElementById('status').textContent), null, { timeout: 60000 });
    // Drei richtige Teile (lowercase, ohne Bindestriche) und ein neues Passwort.
    await dialog.fill('#teil1', shares[4].toLowerCase().replace(/-/g, ' '));
    await dialog.fill('#neu1', NEUES_PASSWORT); await dialog.fill('#neu2', NEUES_PASSWORT);
    await dialog.check('#merken');
    await dialog.click('#weiter');
    const end = Date.now() + 120000;
    while (pages().some(p => p.url().includes('/windows/kennwort.html'))) { if (Date.now() > end) throw new Error('Wiederherstellung hängt: ' + await dialog.textContent('#status').catch(() => '?')); await sleep(300); }
    await sleep(2000);
    await ready();
    await waitDocs(4, 90000);
    const names = await readdir(join(env('WFP_PRUEF_TRESOR'), 'Workflow PDF Pro'));
    expect(names.filter(n => n.startsWith('workflow-pdf-pro.kennwort-')).length === 1, 'Passwortfach fehlt');
    // Danach öffnet auch das neue Passwort.
    await page.evaluate(() => { void WFPNativeVault.manage(); });
    await clickText('Ablage sperren');
    await page.waitForFunction(() => 'wfpVaultLocked' in document.documentElement.dataset, null, { timeout: 60000 });
    await clickText('Entsperren');
    await password(NEUES_PASSWORT);
    await sleep(2000);
    await ready();
    await waitDocs(4, 90000);
    return { tippfehler: typoText, entsperrt: (await vaultState()).unlocked, dokumente: 4 };
  });
}

if (phase === 'abgezogen') {
  await step('ordnerFehlt', async () => {
    await page.waitForFunction(() => 'wfpVaultLocked' in document.documentElement.dataset, null, { timeout: 60000 });
    const state = await vaultState();
    const text = await page.locator('dialog[open] #nativeAblageZeile').textContent();   // Sperr-Zeile der Ablage (die Erklärung steht hinter ⓘ)
    expect(!state.unlocked && /nicht durch eine leere/.test(text), 'Kein klarer Sperrhinweis');
    const updateBlocked=await page.evaluate(() => WFPWindowsUpdates.saveBeforeRestart().then(()=>false,()=>true));
    expect(updateBlocked,'Update must not restart with unavailable storage');
    return { problem: state.problem, hinweis: text, updateBlockiert:updateBlocked };
  });
}

if (phase === 'neuinstallation') {
  await step('datenNachNeuinstallation', async () => {
    const state = await vaultState();
    await waitDocs(4, 90000);
    expect(state.unlocked, 'Tresor nach Neuinstallation gesperrt');
    return { entsperrt: state.unlocked, dokumente: 4 };
  });
}

result.checks.seitenfehler = result.fehler;
await save();
console.log(result.rot.length ? 'ROT: ' + result.rot.join(', ') : 'GRÜN: ' + phase);
await Promise.race([browser.close().catch(() => {}), sleep(5000)]);
process.exit(result.rot.length ? 1 : 0);

