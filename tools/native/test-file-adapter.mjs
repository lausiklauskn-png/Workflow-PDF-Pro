import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { chromium } from 'playwright-core';
import { root } from './prepare-web.mjs';

test('native file adapter simulation: chunks, cancellation, faults, sharing and PDF return', async () => {
  const base = join(root, 'www');
  const server = createServer(async (req, res) => {
    try {
      const path = resolve(base, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (!path.startsWith(base + '/') && path !== base) throw new Error();
      const file = path === base ? join(path, 'index.html') : path;
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' })[extname(file)] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch { res.statusCode = 404; res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch(process.env.WFP_CHROMIUM ? { executablePath: process.env.WFP_CHROMIUM } : {});
    const page = await browser.newPage();
    await page.addInitScript(() => {
      let serial = 0;
      window.__bridge = { calls: [], fail: false, cancelled: false };
      const api = {};
      for (const name of ['begin', 'append', 'finish', 'save', 'abort', 'share', 'print', 'openLink']) api[name] = async data => {
        __bridge.calls.push({ name, data });
        if (name === 'begin') return { id: 'ticket-' + (++serial) };
        if (name === 'append' && __bridge.fail) throw new Error('STORAGE_FULL');
        if (name === 'save') return __bridge.cancelled ? { cancelled: true } : { saved: true };
        return { opened: true, deliveryConfirmed: false };
      };
      window.Capacitor = { isNativePlatform: () => true, Plugins: { WorkflowFiles: api } };
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/');
    await page.waitForFunction(() => window.__wfpdf && window.WFPNativeFiles && window.PDFLib);
    const bytes = await page.evaluate(async () => {
      const original = new Uint8Array(600001); for (let i = 0; i < original.length; i++) original[i] = i % 251;
      await WFPNativeFiles.save(new Blob([original], { type: 'application/pdf' }), 'Müller — Документ.pdf');
      const parts = __bridge.calls.filter(c => c.name === 'append');
      const out = new Uint8Array(original.length);
      for (const part of parts) out.set(Uint8Array.from(atob(part.data.data), c => c.charCodeAt(0)), part.data.offset);
      return { equal: original.every((b, i) => out[i] === b), offsets: parts.map(p => p.data.offset),
        name: __bridge.calls[0].data.name, order: __bridge.calls.map(c => c.name), status: document.getElementById('nativeFileStatus').textContent };
    });
    assert.equal(bytes.equal, true); assert.equal(bytes.name, 'Müller — Документ.pdf');
    assert.deepEqual(bytes.offsets, [0, 262144, 524288]);
    assert.deepEqual(bytes.order, ['begin', 'append', 'append', 'append', 'finish', 'save', 'abort']);
    const cancelled = await page.evaluate(async () => {
      __bridge.calls = []; __bridge.cancelled = true; document.getElementById('nativeFileStatus').textContent = '';
      const result = await WFPNativeFiles.save(new Blob(['original']), 'x.txt');
      return { result, status: document.getElementById('nativeFileStatus').textContent, names: __bridge.calls.map(c => c.name) };
    });
    assert.equal(cancelled.result.cancelled, true); assert.equal(cancelled.status, '');
    assert.equal(cancelled.names.at(-1), 'abort');
    const failed = await page.evaluate(async () => {
      __bridge.calls = []; __bridge.fail = true; let failed = false;
      try { await WFPNativeFiles.save(new Blob(['unchanged']), 'x.txt'); } catch { failed = true; }
      return { failed, names: __bridge.calls.map(c => c.name) };
    });
    assert.equal(failed.failed, true); assert.deepEqual(failed.names, ['begin', 'append', 'abort']);
    const shared = await page.evaluate(async () => {
      __bridge.calls = []; __bridge.fail = false;
      const files = [new File(['one'], 'eins.txt'), new File(['два'], 'два.txt')];
      await navigator.share({ files, text: 'Auftrag', title: 'Dokumente' });
      return { canShare: navigator.canShare({ files }), share: __bridge.calls.find(c => c.name === 'share').data,
        aborted: __bridge.calls.some(c => c.name === 'abort') };
    });
    assert.equal(shared.canShare, true); assert.equal(shared.share.ids.length, 2); assert.equal(shared.share.text, 'Auftrag'); assert.equal(shared.aborted, false);
    await page.evaluate(async () => {
      const pdf = await PDFLib.PDFDocument.create(); pdf.addPage(); pdf.addPage();
      const url = URL.createObjectURL(new Blob([await pdf.save()], { type: 'application/pdf' }));
      window.open(url, '_blank'); URL.revokeObjectURL(url);
    });
    await page.waitForFunction(() => document.querySelectorAll('.native-pdf-view canvas').length === 2 && document.querySelector('.native-pdf-view canvas').width > 300);
    assert.equal(await page.evaluate(() => WFPNativeNavigation.back()), true);
    assert.equal(await page.locator('.native-pdf-view').count(), 0);
    assert.equal(await page.evaluate(() => location.origin), 'http://127.0.0.1:' + server.address().port);
    const halted = await page.evaluate(async () => {
      const original = { id: 'synthetic' }, cleaner = __wfpdf.kiReiniger('chrome');
      const pending = cleaner.halt(original, [{ text: 'hidden fixture', seite: 1, grund: 'unsichtbar' }]);
      const handled = WFPNativeNavigation.back();
      return { handled, accepted: await pending, removal: Boolean(original.kiEntfernt) };
    });
    assert.deepEqual(halted, { handled: true, accepted: false, removal: false });
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
