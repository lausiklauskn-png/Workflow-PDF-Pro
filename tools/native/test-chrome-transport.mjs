import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openChromeTransport } from '../../native/chrome/transport.mjs';
import { chromeTranslator } from '../../native/chrome/adapter.mjs';
import { chromium } from '/workspace/setup/workflow-pdf-baseline/node_modules/playwright-core/index.mjs';
import { PDFDocument, StandardFonts, rgb } from '/workspace/setup/workflow-pdf-baseline/node_modules/pdf-lib/cjs/index.js';

function client(session) {
  const url = new URL(session.browserURL), secret = url.hash.slice(1);
  return { origin: url.origin, send: (path, data, headers = {}) => fetch(url.origin + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Bearer ' + secret, ...(data === undefined ? {} : { Origin: url.origin, 'Content-Type': 'application/json' }), ...headers },
    ...(data === undefined ? {} : { body: JSON.stringify(data) })
  }) };
}
const result = (id, texte) => ({ id, texte, stat: { ohne: 0, zeichen: 20, anfragen: id } });

test('Ungültige Sprachpaare eröffnen keine Sitzung', async () => {
  await assert.rejects(openChromeTransport({ von: 'de', nach: 'de' }), /language-pair/);
  await assert.rejects(openChromeTransport({ von: 'ar', nach: 'ru' }), /language-pair/);
});

test('Ohne Sitzungsschlüssel keine Dokumenttexte; Assets ohne fremde Ressourcen', async () => {
  const host = await openChromeTransport({ von: 'de', nach: 'ru' });
  try {
    const c = client(host);
    const job = host.translate(['Vertraulicher synthetischer Satz']);
    const r = await fetch(c.origin + '/batch'); assert.equal(r.status, 401);
    assert.doesNotMatch(await r.text(), /Vertraulicher/);
    const asset = await fetch(c.origin + '/'); const html = await asset.text();
    assert.equal(asset.headers.get('cache-control'), 'no-store');
    assert.match(asset.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(asset.headers.get('referrer-policy'), 'no-referrer');
    assert.doesNotMatch(html, /Vertraulicher|https?:\/\//);
    assert.match(new URL(host.browserURL).hash, /^#[a-f0-9]{64}$/);
    host.close(); await assert.rejects(job, /cancelled/);
  } finally { host.close(); }
});

test('Fremder Origin, Preflight und manipuliertes Hostfeld werden abgewiesen', async () => {
  const host = await openChromeTransport({ von: 'de', nach: 'en' });
  try {
    const c = client(host);
    assert.equal((await c.send('/batch', undefined, { Origin: 'https://fremd.invalid' })).status, 403);
    const preflight = await fetch(c.origin + '/result', { method: 'OPTIONS' });
    assert.equal(preflight.status, 403); assert.equal(preflight.headers.get('access-control-allow-origin'), null);
    const status = await new Promise((resolve, reject) => {
      const request = http.get(c.origin + '/', { headers: { Host: 'fremd.invalid' } }, r => { r.resume(); resolve(r.statusCode); }); request.on('error', reject);
    });
    assert.equal(status, 403);
    assert.equal((await c.send('/cancel', {}, { Origin: '' })).status, 403);
  } finally { host.close(); }
});

test('Seiten bleiben geordnet; falsche Anzahl, Wiederholung und alte Antworten greifen nicht', async () => {
  const host = await openChromeTransport({ von: 'de', nach: 'ru' });
  try {
    const c = client(host), pending = host.translate(['Müller', 'Кириллица']);
    await assert.rejects(host.translate(['andere Seite']), /already-pending/);
    const batch = await (await c.send('/batch')).json();
    assert.deepEqual(batch.texte, ['Müller', 'Кириллица']);
    assert.equal((await c.send('/result', result(batch.id + 1, ['a', 'b']))).status, 409);
    assert.equal((await c.send('/result', result(batch.id, ['a']))).status, 422);
    assert.equal((await c.send('/result', result(batch.id, ['Müller RU', 'Кириллица RU']))).status, 200);
    assert.deepEqual((await pending).texte, ['Müller RU', 'Кириллица RU']);
    assert.equal((await c.send('/result', result(batch.id, ['a', 'b']))).status, 409);
    const next = host.translate(['Seite 2']);
    const second = await (await c.send('/batch')).json(); assert.equal(second.id, batch.id + 1);
    assert.equal((await c.send('/result', result(batch.id, ['a', 'b']))).status, 409);
    await c.send('/result', result(second.id, ['Страница 2']));
    assert.deepEqual((await next).texte, ['Страница 2']);
  } finally { host.close(); }
});

test('Beschädigte Nachrichten und übergroße Texte werden ehrlich abgewiesen, nie gekürzt', async () => {
  const host = await openChromeTransport({ von: 'en', nach: 'ru' });
  try {
    const c = client(host);
    await assert.rejects(host.translate([null]), /invalid-paragraphs/);
    await assert.rejects(host.translate(['x'.repeat(16 * 1024 * 1024)]), /too-large/);
    const job = host.translate(['Ein Absatz']), id = (await (await c.send('/batch')).json()).id;
    assert.equal((await c.send('/result', { ...result(id, ['One']), stat: { ohne: -1 } })).status, 422);
    assert.equal((await c.send('/result', null)).status, 400);
    await c.send('/result', result(id, ['One'])); assert.deepEqual((await job).texte, ['One']);
  } finally { host.close(); }
});

test('Abbruch im Browser verwirft die wartende Antwort; keine Originaltexte als Erfolg', async () => {
  const host = await openChromeTransport({ von: 'ru', nach: 'de' });
  try {
    const c = client(host), pending = host.translate(['Страница']);
    const rejection = assert.rejects(pending, /cancelled-in-browser/);
    assert.equal((await c.send('/cancel', {})).status, 200); await rejection;
    await assert.rejects(host.translate(['weiter']), /session-closed/);
  } finally { host.close(); }
});

test('Abgelaufene Sitzung und neue Sitzung teilen weder Schlüssel noch Seiten', async () => {
  const old = await openChromeTransport({ von: 'de', nach: 'en', idleMs: 80 });
  const oldClient = client(old), pending = old.translate(['Nur alte Sitzung']);
  const rejection = assert.rejects(pending, /session-expired/);
  // An unauthenticated request cannot keep the native session alive.
  await fetch(oldClient.origin + '/batch'); await rejection;
  const fresh = await openChromeTransport({ von: 'de', nach: 'en' });
  try {
    assert.notEqual(new URL(fresh.browserURL).hash, new URL(old.browserURL).hash);
    assert.equal((await client(fresh).send('/batch', undefined, { Authorization: 'Bearer ' + new URL(old.browserURL).hash.slice(1) })).status, 401);
    assert.deepEqual(await (await client(fresh).send('/batch')).json(), { waiting: true });
  } finally { fresh.close(); old.close(); }
});

test('Adapter öffnet vor erstem Text nichts und kann auch während des Öffnens abbrechen', async () => {
  let opens = 0, closes = 0, release, translated = 0, stops = 0;
  const adapter = chromeTranslator({ open: () => { opens++; return new Promise(resolve => { release = resolve; }); } }, 'de', 'ru');
  assert.equal(opens, 0);
  adapter.beimHalt = () => { stops++; };
  const pending = adapter(['bereits gereinigt']); await Promise.resolve();
  assert.equal(opens, 1); adapter.halt();
  release({ close: async () => { closes++; }, translate: async () => { translated++; } });
  await assert.rejects(pending, /Angehalten/);
  assert.equal(translated, 0); assert.equal(stops, 1); assert.ok(closes >= 1);
});

test('Browser-Helfer und echter Loopback-Transport: zwei Seiten und unveränderter Originalkern', { timeout: 20000 }, async () => {
  const host = await openChromeTransport({ von: 'de', nach: 'ru' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
  try {
    const page = await browser.newPage();
    const outgoing = [], errors = [];
    page.on('request', request => outgoing.push(request.url())); page.on('pageerror', e => errors.push(e.message));
    const adapter = chromeTranslator({ open: async () => host }, 'de', 'ru');
    const first = adapter(['Ein synthetischer längerer Satz für den Transport.', 'Hamburg']);
    await page.goto(host.browserURL); await page.waitForSelector('#wfp-chrome [data-liste] p');
    assert.equal(new URL(page.url()).hash, '');
    assert.equal(await page.locator('#wfp-chrome [data-liste] p').first().textContent(), 'Ein synthetischer längerer Satz für den Transport.');
    assert.equal(await page.locator('main').getAttribute('translate'), 'no');
    // Only DOM translation is simulated. TCP, HTTP, helper, original engine,
    // result delivery, sequencing and adapter are real. No Google run is claimed.
    const translateDOM = () => page.evaluate(() => {
      document.documentElement.classList.add('translated-ltr');
      for (const p of document.querySelectorAll('#wfp-chrome [data-liste] p')) {
        const font = document.createElement('font'); font.textContent = p.textContent === 'Hamburg' ? 'Hamburg' : 'Это синтетический перевод для проверки передачи документа.'; p.replaceChildren(font);
      }
    });
    await translateDOM(); assert.deepEqual(await first, ['Это синтетический перевод для проверки передачи документа.', 'Hamburg']);
    assert.equal(adapter.stat.ohne, 0);
    const second = adapter(['Zweite Seite — <script>kein Code</script>']);
    await page.waitForFunction(() => document.querySelector('#wfp-chrome [data-liste] p')?.textContent.startsWith('Zweite'));
    assert.equal(await page.locator('#wfp-chrome script').count(), 0);
    await translateDOM(); assert.deepEqual(await second, ['Это синтетический перевод для проверки передачи документа.']);
    assert.equal(adapter.stat.anfragen, 2);
    const served = await (await fetch(client(host).origin + '/uebersetzung.js')).text();
    assert.equal(served, await readFile(new URL('../../upstream/workflow-pdf/assets/uebersetzung.js', import.meta.url), 'utf8'));
    assert.ok(outgoing.every(url => new URL(url).origin === client(host).origin)); assert.deepEqual(errors, []);
    adapter.zu();
    await page.waitForFunction(() => !document.querySelector('#wfp-chrome'));
  } finally { await browser.close(); host.close(); }
});

test('Browser-Abbrechen erreicht die wartende App über den echten Transport', { timeout: 15000 }, async () => {
  const host = await openChromeTransport({ von: 'de', nach: 'en' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
  try {
    const pending = host.translate(['Nichts ungefragt übersetzen']);
    const rejection = assert.rejects(pending, /cancelled-in-browser/);
    const page = await browser.newPage(); await page.goto(host.browserURL);
    await page.click('#wfp-chrome [data-halt]'); await rejection;
    await page.waitForFunction(() => !document.querySelector('#wfp-chrome'));
  } finally { await browser.close(); host.close(); }
});

test('Unveränderte App: Reinigung vor Transport, Abbruch ohne Senden, PDF und Vermerk zurück in App', { timeout: 60000 }, async () => {
  const root = fileURLToPath(new URL('../../upstream/workflow-pdf/', import.meta.url));
  const server = http.createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
      if (!file.startsWith(root)) throw new Error('path');
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(await readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
  const hosts = []; let adapter, opened = 0;
  const sent = [];
  try {
    const app = await browser.newPage();
    await app.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
    const bridge = { open: async options => {
      opened++;
      const host = await openChromeTransport(options); hosts.push(host);
      const chrome = await browser.newPage();
      await chrome.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
      await chrome.addInitScript(() => {
        // Explicit synthetic DOM translation; no Google service is used here.
        addEventListener('DOMContentLoaded', () => {
          const translate = () => {
            document.documentElement.classList.add('translated-ltr');
            for (const p of document.querySelectorAll('#wfp-chrome [data-liste] p')) {
              if (p.querySelector('font')) continue;
              const font = document.createElement('font'); font.textContent = '[en] ' + p.textContent; p.replaceChildren(font);
            }
          };
          new MutationObserver(translate).observe(document.body, { childList: true, subtree: true }); translate();
        });
      });
      await chrome.goto(host.browserURL);
      return { translate: texte => { sent.push(...texte); return host.translate(texte); }, close: () => host.close() };
    } };
    await app.exposeFunction('transportTranslate', async texte => {
      const translated = await adapter(texte); return { texte: translated, stat: adapter.stat };
    });
    await app.goto('http://127.0.0.1:' + server.address().port);
    await app.waitForFunction(() => !!window.__wfpdf);
    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 2; i++) {
      const page = pdf.addPage([595, 842]);
      page.drawText('Sichtbarer synthetischer Inhalt Seite ' + (i + 1), { x: 60, y: 700, size: 12, font });
      page.drawText('VERSTECKTES_TRANSPORTMUSTER', { x: 60, y: 600, size: 12, font, color: rgb(1, 1, 1) });
    }
    const original = Buffer.from(await pdf.save());
    const id = await app.evaluate(async b64 => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const docs = await __wfpdf.importDateien([new File([bytes], 'Synthetischer-Transport.pdf', { type: 'application/pdf' })], 'Transport', { still: true });
      __wfpdf.EINST.ueRueck = false;
      return docs[0].id;
    }, original.toString('base64'));
    const run = () => {
      adapter = chromeTranslator(bridge, 'de', 'en');
      return app.evaluate(async id => {
        const hin = async texte => { const r = await window.transportTranslate(texte); Object.assign(hin.stat, r.stat); return r.texte; };
        hin.stat = { zeichen: 0, anfragen: 0, ohne: 0, modell: 'Chrome (Google)' }; hin.art = 'chrome';
        await __wfpdf.uebersetzeViele([id], 'de', 'en', hin, null, 'chrome');
      }, id).finally(() => adapter.zu());
    };
    const cancelled = run();
    await app.waitForSelector('[data-ki-halt]'); assert.equal(opened, 0); assert.deepEqual(sent, []);
    await app.click('.dlg:has([data-ki-halt]) [data-n]'); await cancelled;
    assert.equal(opened, 0); assert.deepEqual(sent, []);
    assert.equal(await app.evaluate(async id => (await WFP.DB.get('docs', id)).kiEntfernt?.length || 0, id), 0);
    await app.evaluate(() => document.querySelectorAll('.dlg [data-x]').forEach(button => button.click()));
    const completed = run();
    await app.waitForSelector('[data-ki-halt]'); assert.equal(opened, 0);
    await app.click('.dlg:has([data-ki-halt]) [data-j]'); await completed;
    assert.equal(opened, 1);
    assert.ok(sent.some(t => t.includes('Sichtbarer synthetischer Inhalt')));
    assert.ok(sent.every(t => !t.includes('VERSTECKTES_TRANSPORTMUSTER')));
    const state = await app.evaluate(async id => {
      const original = await WFP.DB.get('docs', id), bytes = await WFP.DB.getFile(id);
      const translation = (await WFP.DB.all('docs')).find(d => d.uebersetzung?.quelle === id);
      const out = translation && await WFP.DB.getFile(translation.id);
      let outputText = '';
      if (out) { const pdf = await pdfjsLib.getDocument({ data: out.slice() }).promise; for (let n = 1; n <= pdf.numPages; n++) outputText += (await (await pdf.getPage(n)).getTextContent()).items.map(i => i.str).join(' '); }
      return { originalBytes: [...bytes], notes: original.kiEntfernt, translation, outputText, pendingJobs: (await WFP.DB.keys('files')).filter(k => String(k).startsWith('ue:')) };
    }, id);
    assert.deepEqual(Buffer.from(state.originalBytes), original);
    assert.ok(state.notes.some(note => note.weg === 'chrome' && note.text.includes('VERSTECKTES_TRANSPORTMUSTER')));
    assert.equal(state.translation.pages.length, 2); assert.equal(state.translation.uebersetzung.nach, 'en');
    assert.match(state.outputText, /\[en\]/); assert.deepEqual(state.pendingJobs, []);
  } finally {
    hosts.forEach(host => host.close()); await browser.close(); await new Promise(resolve => server.close(resolve));
  }
});
