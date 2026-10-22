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
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const [phase = 'erst', out = 'abnahme.json'] = process.argv.slice(2);
const env = name => { const v = process.env[name]; if (!v) throw new Error('Umgebung fehlt: ' + name); return v; };
const PASSWORT = 'Prüf-Passwort für Windows 2026';
const result = { phase, zeit: new Date().toISOString(), checks: {}, fehler: [], rot: [] };
const save = () => writeFile(out, JSON.stringify(result, null, 2));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

if (phase === 'erst') {
  await step('sicherheitUndUpdates', async () => {
    const policy = await page.evaluate(async () => {
      let evalBlocked = false;
      try { (0, eval)('window.__wfpUnsafeEval=1'); } catch {evalBlocked = true;}
      const script = document.createElement('script'); script.textContent = 'window.__wfpUnsafeInline=1'; document.body.append(script);
      await new Promise(resolve => setTimeout(resolve, 100)); script.remove();
      return {evalBlocked, inlineBlocked: !window.__wfpUnsafeInline,
        updateAdapter: typeof window.WFPWindowsUpdates?.check === 'function',
        status: await window.__TAURI_INTERNALS__.invoke('wfp_update', {operation: 'status'})};
    });
    expect(policy.evalBlocked && policy.inlineBlocked && policy.updateAdapter && policy.status.current === '1.0.2', 'CSP/update adapter did not enforce the intended rules');
    return policy;
  });
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
  await step('texterkennung', () => page.evaluate(async () => {
    if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/tesseract/tesseract.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const abs = u => new URL(u, location.href).href;
    const w = await Tesseract.createWorker('deu', 1, { workerPath: abs('vendor/tesseract/worker.min.js'), corePath: abs('vendor/tesseract/'), langPath: abs('vendor/tesseract/lang'), gzip: false, cacheMethod: 'none' });
    const c = document.createElement('canvas'); c.width = 1200; c.height = 200; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 1200, 200); g.fillStyle = '#000'; g.font = '64px Arial'; g.fillText('Antrag Bewohnerparkausweis', 30, 120);
    const r = await w.recognize(c); await w.terminate(); return r.data.text.trim();
  }).then(v => { expect(/Bewohnerparkausweis/.test(v), 'Texterkennung falsch'); return v; }));
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
    await clickText('Tresor sperren');
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

if (phase === 'abgezogen') {
  await step('ordnerFehlt', async () => {
    await page.waitForFunction(() => 'wfpVaultLocked' in document.documentElement.dataset, null, { timeout: 60000 });
    const state = await vaultState();
    const text = await page.locator('dialog[open] p').first().textContent();
    expect(!state.unlocked && /nicht durch eine leere/.test(text), 'Kein klarer Sperrhinweis');
    return { problem: state.problem, hinweis: text };
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

