// Messprobe für den Windows-Host: hängt sich per CDP an das WebView2-Fenster der
// installierten Tauri-App und misst, was der unveränderte Kern dort wirklich kann.
// Aufruf: node probe.mjs <phase> <ausgabe.json>   phase = erst | neustart | neuinstallation
// Läuft auf einem GitHub-Windows-Runner, nicht auf Klaus' Rechner.
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [phase = 'erst', out = 'probe-ergebnis.json'] = process.argv.slice(2);
const result = { phase, zeit: new Date().toISOString(), checks: {}, fehler: [] };
const ok = (name, value) => { result.checks[name] = value; console.log(name + ': ' + JSON.stringify(value)); };

let browser;
for (let i = 0; i < 60 && !browser; i++) {
  try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222'); }
  catch { await new Promise(r => setTimeout(r, 1000)); }
}
if (!browser) throw new Error('WebView2 nicht per CDP erreichbar');
let page;
for (let i = 0; i < 60 && !page; i++) {
  page = browser.contexts().flatMap(c => c.pages()).find(p => /tauri\.localhost/.test(p.url()));
  if (!page) await new Promise(r => setTimeout(r, 1000));
}
if (!page) throw new Error('App-Seite nicht gefunden: ' + browser.contexts().flatMap(c => c.pages()).map(p => p.url()));
page.on('pageerror', e => result.fehler.push(String(e.message)));
await page.waitForFunction(() => window.__wfpdf && window.PDFLib && window.WFP?.DB, null, { timeout: 60000 });

ok('umgebung', await page.evaluate(async () => {
  const sw = 'serviceWorker' in navigator ? await Promise.race([
    navigator.serviceWorker.ready.then(r => 'aktiv:' + (r.active?.scriptURL || '?')),
    new Promise(r => setTimeout(() => r('nicht-bereit-nach-15s'), 15000))]) : 'fehlt';
  const paare = [['de', 'en'], ['en', 'de'], ['de', 'ru'], ['ru', 'de'], ['en', 'ru'], ['ru', 'en']];
  const translator = {};
  if ('Translator' in self) for (const [s, t] of paare) {
    try { translator[s + '>' + t] = await Translator.availability({ sourceLanguage: s, targetLanguage: t }); }
    catch (e) { translator[s + '>' + t] = 'fehler:' + e.message; }
  }
  const simd = WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]));
  const est = await navigator.storage?.estimate?.();
  return {
    url: location.href, userAgent: navigator.userAgent, secureContext: isSecureContext, crossOriginIsolated,
    serviceWorker: sw, translatorApi: 'Translator' in self, translator, languageDetector: 'LanguageDetector' in self,
    wasmSimd: simd, sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    showOpenFilePicker: typeof showOpenFilePicker, showSaveFilePicker: typeof showSaveFilePicker, showDirectoryPicker: typeof showDirectoryPicker,
    print: typeof print, share: typeof navigator.share, speechSynthesis: typeof speechSynthesis,
    stimmen: (speechSynthesis?.getVoices?.() || []).map(v => v.lang).slice(0, 20),
    speechRecognition: typeof (self.SpeechRecognition || self.webkitSpeechRecognition),
    subtle: typeof crypto?.subtle?.encrypt, indexedDB: typeof indexedDB,
    speicherKontingentMB: est ? Math.round(est.quota / 1e6) : null, persistiert: await navigator.storage?.persisted?.()
  };
}));

if (phase === 'erst') {
  // Echtes Formular über das unveränderte Datei-Eingabefeld des Kerns einlesen.
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 2; i++) pdf.addPage([595, 842]).drawText('Workflow PDF Pro Windows ' + (i + 1), { x: 45, y: 770, font });
  const f = pdf.getForm().createTextField('Name'); f.setText('Müller'); f.addToPage(pdf.getPage(0), { x: 50, y: 650, width: 220, height: 25 });
  const bytes = Buffer.from(await pdf.save());
  const dir = await mkdtemp(join(tmpdir(), 'wfp-')), file = join(dir, 'Formular.pdf');
  await writeFile(file, bytes);
  await page.setInputFiles('#inDatei', file);
  await page.waitForFunction(() => window.__wfpdf.S.doc?.fields?.length > 0, null, { timeout: 60000 });
  ok('einlesen', await page.evaluate(async n => {
    const d = window.__wfpdf.S.doc, b = await WFP.DB.getFile(d.id);
    return { seiten: d.pages.length, feld: d.fields[0].value, originalGleich: b.length === n };
  }, bytes.length));
  ok('ausgabe', await page.evaluate(async () => {
    const w = window.__wfpdf, r = {};
    for (const m of ['ausfuellbar', 'fest', 'vorlage']) {
      const e = await WFP.Export.exportieren(w.S.doc, w.S.bytes, m);
      r[m] = { bytes: e.bytes.length, pdf: new TextDecoder('latin1').decode(e.bytes.slice(0, 5)) === '%PDF-' };
    }
    return r;
  }));
  // Texterkennung mit den lokal gebündelten Tesseract-Dateien (WASM + Worker).
  ok('texterkennung', await page.evaluate(async () => {
    const t0 = performance.now();
    if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/tesseract/tesseract.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const abs = u => new URL(u, location.href).href;
    const w = await Tesseract.createWorker('deu', 1, { workerPath: abs('vendor/tesseract/worker.min.js'), corePath: abs('vendor/tesseract/'), langPath: abs('vendor/tesseract/lang'), gzip: false, cacheMethod: 'none' });
    const c = document.createElement('canvas'); c.width = 1200; c.height = 200;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1200, 200); g.fillStyle = '#000'; g.font = '64px Arial';
    g.fillText('Antrag Bewohnerparkausweis', 30, 120);
    const r = await w.recognize(c); await w.terminate();
    return { text: r.data.text.trim(), ms: Math.round(performance.now() - t0) };
  }));
  ok('pdfjsRender', await page.evaluate(async () => {
    const d = window.__wfpdf.S.doc;
    return { seitenBilder: document.querySelectorAll('canvas').length, seiten: d.pages.length };
  }));
  await page.screenshot({ path: out.replace(/\.json$/, '.png') });
}
if (phase !== 'erst') {
  await page.waitForFunction(() => window.__wfpdf.S.docs.length > 0, null, { timeout: 30000 }).catch(() => {});
  ok('datenerhalt', await page.evaluate(async () => {
    const docs = window.__wfpdf.S.docs;
    const d = docs[0]; const b = d && await WFP.DB.getFile(d.id);
    return { dokumente: docs.length, feld: d?.fields?.[0]?.value ?? null, originalBytes: b?.length ?? 0 };
  }));
}
ok('seitenfehler', result.fehler);
await writeFile(out, JSON.stringify(result, null, 2));
await browser.close().catch(() => {});
