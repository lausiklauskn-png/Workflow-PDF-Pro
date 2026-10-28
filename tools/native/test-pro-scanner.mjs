// tools/native/test-pro-scanner.mjs — Scanner/Kamera-Baustein der Pro-Apps (native/pro-scanner.js) im echten Chromium.
// GESTELLT: das Plugin ProScanner der Windows-Hülle (WIA) und der Scanner-Kern (WFP.Scanner.hinzu). ECHT: die Datei selbst,
// das Einhängen ins Scan-Fenster, die Auswahl, und die Kamera über Chromiums Prüfkamera (--use-fake-device-for-media-stream).
// Byte-gleich in BookLedgerPro (Pin native/pro-scanner-herkunft.json). Rückgabe: 0 grün · 1 ROT · 2 nicht lauffähig.
//   node tools/native/test-pro-scanner.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright-core'); } catch { try { pw = require('playwright'); } catch { console.log('nicht lauffähig: playwright(-core) fehlt'); process.exit(2); } }
const CHROMIUM = [process.env.CHROMIUM, '/opt/pw-browsers/chromium/chrome'].find((p) => p && existsSync(p));
let gruen = 0, rot = 0;
const ok = (n, c, i) => { if (c) { gruen++; console.log('  ✓ ' + n); } else { rot++; console.log('  ✗ ROT: ' + n + (i ? '  — ' + i : '')); } };
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const STUB = (mitPlugin) => `<script>
window.__aufrufe = []; window.__hinzu = []; window.__fehler = null;
window.__stroeme = []; if (navigator.mediaDevices) { const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = async (c) => { const s = await gum(c); window.__stroeme.push(s); return s; }; }
window.WFP = { Scanner: { hinzu: async (f) => { for (const x of f) window.__hinzu.push(x.name + ':' + x.type + ':' + x.size); } } };
${mitPlugin ? `window.Capacitor = { Plugins: { ProScanner: {
  geraete: async () => (window.__aufrufe.push(['geraete']), { geraete: [
    { id: '{6BDD1FC6-810F-11D0-BEC7-08002BE2092F}\\\\0000', name: 'Canon LiDE 300', art: 'scanner', verbindung: 'usb', einzug: false, glas: true },
    { id: '{6BDD1FC6-810F-11D0-BEC7-08002BE2092F}\\\\0001', name: 'HP OfficeJet Pro', art: 'scanner', verbindung: 'netz', einzug: true, glas: true } ] }),
  scannen: async (o) => { window.__aufrufe.push(['scannen', o]); if (window.__fehler) throw Object.assign(new Error(window.__fehler), { code: window.__fehler });
    return { seiten: o.quelle === 'einzug' ? [{ mime: 'image/jpeg', data: '${PNG}' }, { mime: 'image/jpeg', data: '${PNG}' }] : [{ mime: 'image/jpeg', data: '${PNG}' }] }; } } } };` : ''}
</script>`;
const SEITE = (mitPlugin) => `<!doctype html><html lang="de"><head><meta charset="utf-8"><link rel="stylesheet" href="/native/pro-scanner.css">${STUB(mitPlugin)}<script src="/native/pro-scanner.js"></script></head>
<body><button id="oeffne">Scan öffnen</button><script>
document.getElementById('oeffne').onclick = () => { const d = document.createElement('div'); d.className = 'scan';
  d.innerHTML = '<div class="scan-buehne"><div class="scan-leer"><div class="zeile"><button class="knopf rot" data-kamera>Kamera</button></div></div></div><div class="scan-leiste"></div>'; document.body.append(d); };
</script></body></html>`;
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/mit.html' || p === '/ohne.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(SEITE(p === '/mit.html')); }
  if (!p.startsWith('/native/pro-scanner.')) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.css') ? 'text/css' : 'text/javascript' }); res.end(await readFile(join(WURZEL, p)));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASIS = 'http://127.0.0.1:' + server.address().port;
let browser;
try { browser = await pw.chromium.launch({ ...(CHROMIUM ? { executablePath: CHROMIUM } : {}), args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }); }
catch (e) { console.log('nicht lauffähig: Chromium startet nicht — ' + e.message); server.close(); process.exit(2); }
try {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  await ctx.grantPermissions(['camera'], { origin: BASIS });
  const page = await ctx.newPage(); const fehler = []; page.on('pageerror', (e) => fehler.push(e.message));

  console.log('— A. ohne Hülle (Android, PWA) —');
  await page.goto(BASIS + '/ohne.html'); await page.click('#oeffne'); await page.waitForTimeout(150);
  ok('ohne Plugin ProScanner: kein Knopf, ProScanner nicht verfügbar', await page.evaluate(() => !document.querySelector('[data-pro-scanner-knopf]') && !window.ProScanner.verfuegbar()));

  console.log('— B. Scanner über WIA —');
  await page.goto(BASIS + '/mit.html'); await page.click('#oeffne');
  await page.waitForSelector('.scan-leer [data-pro-scanner-knopf]');
  ok('Knopf „Scanner oder Kamera …“ steht im leeren Scan-Fenster und in der Leiste, nicht farbig (ein farbiger Knopf bleibt der des Kerns)',
    await page.evaluate(() => document.querySelectorAll('[data-pro-scanner-knopf]').length === 2 && !document.querySelector('.scan-leer [data-pro-scanner-knopf]').classList.contains('rot')
      && document.querySelector('.scan-leer [data-pro-scanner-knopf]').textContent === 'Scanner oder Kamera …'));
  await page.click('.scan-leer [data-pro-scanner-knopf]');
  await page.waitForSelector('[data-pro-scanner] [data-pros-geraet]');
  const liste = await page.evaluate(() => [...document.querySelectorAll('[data-pros-geraet]')].map((b) => b.textContent));
  ok('Liste: beide Scanner (USB und Netz) und die Kamera', liste.length === 3 && /Canon LiDE 300USB/.test(liste[0]) && /HP OfficeJet ProNetz/.test(liste[1]) && /^Kamera/.test(liste[2]), liste.join(' | '));
  ok('erster Scanner vorgewählt; ohne Einzug keine Wahl der Vorlage', await page.evaluate(() => document.querySelector('[data-pros-geraet][aria-checked="true"]')?.textContent.includes('Canon') && !document.querySelector('[data-pros-feld="Vorlage"]')));
  ok('genau ein farbiger Knopf: „Scannen“', await page.evaluate(() => [...document.querySelectorAll('[data-pro-scanner] .pros-haupt')].map((b) => b.textContent).join() === 'Scannen'));
  ok('Knöpfe und Auswahlfelder höchstens 32 px hoch', await page.evaluate(() => [...document.querySelectorAll('[data-pro-scanner] button, [data-pro-scanner] select')].every((e) => e.getBoundingClientRect().height <= 32.5)));
  ok('keine Emojis im Fenster', await page.evaluate(() => !/\p{Extended_Pictographic}/u.test(document.querySelector('[data-pro-scanner]').textContent)));
  await page.click('[data-pros-geraet*="0001"]');
  ok('Netz-Scanner mit Einzug: Vorlage wählbar', await page.locator('[data-pros-feld="Vorlage"]').count() === 1);
  await page.selectOption('[data-pros-feld="Vorlage"]', 'einzug'); await page.selectOption('[data-pros-feld="Auflösung"]', '200'); await page.selectOption('[data-pros-feld="Farbe"]', 'grau');
  await page.click('[data-pros-scannen]');
  await page.waitForFunction(() => window.__hinzu.length === 2, null, { timeout: 5000 }).catch(() => {});
  const auf = await page.evaluate(() => window.__aufrufe.find((a) => a[0] === 'scannen')?.[1]);
  ok('Scannen mit den gewählten Werten', auf && auf.quelle === 'einzug' && auf.dpi === 200 && auf.farbe === 'grau' && /0001$/.test(auf.geraet), JSON.stringify(auf));
  ok('zwei Blätter aus dem Einzug gehen als JPEG in den Scanner-Kern', await page.evaluate(() => window.__hinzu.length === 2 && window.__hinzu.every((x) => /^Scan-.*-0[12]\.jpg:image\/jpeg:\d+$/.test(x))), JSON.stringify(await page.evaluate(() => window.__hinzu)));
  ok('Fenster danach zu', await page.locator('[data-pro-scanner]').count() === 0);
  await page.click('.scan-leer [data-pro-scanner-knopf]'); await page.waitForSelector('[data-pros-geraet]');
  ok('letzte Wahl gemerkt (Netz-Scanner, Einzug, 200 dpi, Grau)', await page.evaluate(() => document.querySelector('[aria-checked="true"]').textContent.includes('HP') && document.querySelector('[data-pros-feld="Vorlage"]').value === 'einzug' && document.querySelector('[data-pros-feld="Auflösung"]').value === '200'));
  await page.evaluate(() => { window.__fehler = 'SCANNER_KEIN_PAPIER'; });
  await page.click('[data-pros-scannen]'); await page.waitForTimeout(200);
  ok('Fehler wird verständlich genannt, Fenster bleibt offen', await page.evaluate(() => document.querySelector('.pros-status').textContent === 'Im Einzug liegt kein Papier.' && !document.querySelector('[data-pros-scannen]').disabled));
  await page.click('[data-pros-abbrechen]');
  ok('Abbrechen: nichts geht in den Kern', await page.evaluate(() => window.__hinzu.length === 2 && !document.querySelector('[data-pro-scanner]')));

  console.log('— C. Kamera als Livebild (Chromiums Prüfkamera) —');
  await page.click('.scan-leer [data-pro-scanner-knopf]'); await page.waitForSelector('[data-pros-geraet]');
  await page.click('[data-pros-geraet^="cam:"]');
  await page.waitForFunction(() => { const v = document.querySelector('[data-pros-video]'); return v && v.videoWidth > 0 && !document.querySelector('[data-pros-aufnehmen]').disabled; }, null, { timeout: 8000 }).catch(() => {});
  ok('Livebild läuft', await page.evaluate(() => (document.querySelector('[data-pros-video]')?.videoWidth || 0) > 0));
  ok('„Fertig“ erst nach einer Aufnahme', await page.evaluate(() => document.querySelector('[data-pros-fertig]').disabled));
  await page.click('[data-pros-aufnehmen]'); await page.waitForTimeout(300); await page.click('[data-pros-aufnehmen]'); await page.waitForTimeout(300);
  ok('Zähler zeigt zwei Seiten', await page.evaluate(() => document.querySelector('[data-pros-zahl]').textContent === '2 Seiten'));
  await page.click('[data-pros-fertig]'); await page.waitForTimeout(200);
  ok('zwei Kamera-Bilder gehen in den Kern, Kamera ist danach aus', await page.evaluate(() => window.__hinzu.filter((x) => /^Kamera-\d+\.jpg:image\/jpeg:\d+$/.test(x)).length === 2 && window.__stroeme.length >= 1 && window.__stroeme.every((s) => s.getTracks().every((t) => t.readyState === 'ended'))));
  ok('keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
} finally { await browser.close(); server.close(); console.log(`\n${gruen} grün · ${rot} ROT`); process.exitCode = rot ? 1 : 0; }
