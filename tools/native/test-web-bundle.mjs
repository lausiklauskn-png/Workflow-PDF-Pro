import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { prepareWeb, root, digest, isRuntime, vaultFiles } from './prepare-web.mjs';

const receipt = await prepareWeb();
test('bundle contains the complete public runtime and unchanged protected files', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'docs/portierung/QUELLDATEIEN-SHA256.json')));
  assert.deepEqual(receipt.files.map(f => f.path).sort(), manifest.files.filter(f => isRuntime(f.path)).map(f => f.path).sort());
  for (const entry of receipt.files) {
    const bytes = await readFile(join(root, 'www', entry.path));
    assert.equal(digest(bytes), entry.sha256);
    if (entry.path !== 'index.html') assert.equal(entry.sha256, entry.sourceSha256, entry.path);
  }
  assert.ok(receipt.files.some(f => f.path === 'assets/schluesseltresor.js'));
  assert.ok(receipt.files.some(f => f.path === 'sw.js'));
  assert.ok(receipt.files.some(f => f.path === 'vendor/tesseract/lang/rus.traineddata'));
  const html = await readFile(join(root, 'www/index.html'), 'utf8');
  assert.match(html, /<title>Workflow PDF Pro/);
  assert.ok(html.indexOf('native/native-bootstrap.js') < html.indexOf('assets/app.js'));
  for (const name of ['native-bootstrap.js','native-files.js','native-import.js','native-incoming.js','native-chrome.js',...vaultFiles,'native.css']) {
    assert.ok(html.includes('native/' + name + '?v=' + digest(await readFile(join(root,'www/native',name)))));
  }
  assert.ok(html.indexOf('assets/db.js')<html.indexOf('native/native-vault.js'));
  assert.ok(html.indexOf('native/vault-gate.js')<html.indexOf('native/native-vault.js'));
  assert.ok(html.indexOf('native/native-vault.js')<html.indexOf('assets/app.js'));
});
test('bundle excludes development material, signing files and private data', async () => {
  async function walk(path, relative = '') {
    for (const item of await readdir(path, { withFileTypes: true })) {
      const name = relative + item.name;
      assert.doesNotMatch(name, /(^|\/)(?:\.git|tests|tools|docs|signing|node_modules)(\/|$)|\.(?:jks|keystore|p12|enc\.json)$|CLAUDE\.md|AGENTS\.md|package-lock\.json/);
      if (item.isDirectory()) await walk(join(path, item.name), name + '/');
    }
  }
  await walk(join(root, 'www'));
});

// A real browser runs the actual generated bundle. The native bridge is absent:
// this verifies bundling/core parity, never Android permissions or Google translation.
test('generated bundle imports a real form, preserves its original and survives restart', async () => {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json' };
  const www = join(root, 'www');
  const server = createServer(async (req, res) => {
    try {
      const path = resolve(www, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (path !== www && !path.startsWith(www + '/')) throw new Error('path');
      const file = path === www ? join(path, 'index.html') : path;
      res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch { res.statusCode = 404; res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch(process.env.WFP_CHROMIUM ? { executablePath: process.env.WFP_CHROMIUM } : {});
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port + '/');
    await page.waitForFunction(() => window.__wfpdf && window.PDFLib);
    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 2; i++) pdf.addPage([595, 842]).drawText('Workflow PDF Pro ' + (i + 1), { x: 45, y: 770, font });
    const form = pdf.getForm().createTextField('Name'); form.setText('Müller'); form.addToPage(pdf.getPage(0), { x: 50, y: 650, width: 220, height: 25 });
    const bytes = Buffer.from(await pdf.save());
    await page.setInputFiles('#inDatei', { name: 'Formular.pdf', mimeType: 'application/pdf', buffer: bytes });
    await page.waitForFunction(() => window.__wfpdf.S.doc?.fields?.length > 0);
    const state = await page.evaluate(async () => {
      const doc = window.__wfpdf.S.doc;
      return { id: doc.id, pages: doc.pages.length, value: doc.fields[0].value,
        bytes: Array.from(await WFP.DB.getFile(doc.id)), status: doc.pruefung || null };
    });
    assert.equal(state.pages, 2); assert.equal(state.value, 'Müller');
    assert.deepEqual(Buffer.from(state.bytes), bytes);
    // A normal import must not acquire a fabricated clean security result.
    assert.ok(!state.status || !['sauber', 'clean'].includes(state.status.status));
    await page.reload();
    await page.waitForFunction(() => window.__wfpdf?.S.docs.length === 1);
    assert.deepEqual(await page.evaluate(async id => Array.from(await WFP.DB.getFile(id)), state.id), [...bytes]);
    // New storage-index boundary with the real, unchanged IndexedDB schema.
    // This does not activate a vault or simulate a successful Android write.
    await page.addScriptTag({ path: join(root, 'native/vault-db.js') });
    const indexResult = await page.evaluate(async () => {
      const local = await WFPVaultDB.localIndex(WFP.DB);
      await WFP.DB.put('texte', { id: 'atomic-index', text: 'keep until committed' });
      let rejected = false;
      try {
        await local.commit([
          { kind: 'delete', store: 'texte', id: 'atomic-index' },
          { kind: 'put', store: 'docs', record: { /* missing key: abort the entire transaction */ } }
        ]);
      } catch { rejected = true; }
      const preserved = (await WFP.DB.get('texte', 'atomic-index'))?.text;
      await local.commit([
        { kind: 'delete', store: 'texte', id: 'atomic-index' },
        { kind: 'put', store: 'files', record: { id: 'atomic-reference', __wfpVault: { hash: 'synthetic-reference' } } }
      ]);
      const removed = await WFP.DB.get('texte', 'atomic-index');
      const ref = await WFP.DB.get('files', 'atomic-reference');
      await WFP.DB.del('files', 'atomic-reference'); local.close();
      return { rejected, preserved, removed: removed === undefined, ref: ref.__wfpVault.hash };
    });
    assert.deepEqual(indexResult, { rejected: true, preserved: 'keep until committed', removed: true, ref: 'synthetic-reference' });
    await page.addScriptTag({ path: join(root, 'native/vault-journal.js') });
    const replayResult = await page.evaluate(async () => {
      const local = await WFPVaultDB.localIndex(WFP.DB), values = new Map();
      // Only the remote protocol is a fixture; local transactions and the DB
      // wrapper are real. Native encryption has separate Android coverage.
      const key = (store, id) => JSON.stringify([store, id]);
      const records = {
        async save(location, store, record) {
          values.set(key(store, record.id), structuredClone(record));
          return { saved: true, hash: 'a'.repeat(64) };
        },
        async load(location, store, id) { return { record: structuredClone(values.get(key(store, id))) }; }
      };
      const bridge = {
        async state() { return { location: 'fixture', id: 'fixture-vault', unlocked: true, reachable: true }; },
        async info({ store, id }) { return { exists: values.has(key(store, id)), hash: 'a'.repeat(64) }; },
        async remove({ store, id }) { values.delete(key(store, id)); return { saved: true }; }
      };
      let loseAck = true;
      const first = new WFPVaultJournal({ bridge, records, location: 'fixture', vaultId: 'fixture-vault',
        local: { ...local, async commit(changes) { await local.commit(changes); if (loseAck) { loseAck = false; throw Error('LOST_INDEX_ACK'); } } } });
      await first.recover();
      const db = WFPVaultDB.create({ journal: first, local, records });
      let blocked = false;
      try { await db.putFile('journal-browser', new Uint8Array([7, 8, 9])); } catch { blocked = first.blocked; }
      const second = new WFPVaultJournal({ bridge, records, local, location: 'fixture', vaultId: 'fixture-vault' });
      await second.recover();
      const restored = WFPVaultDB.create({ journal: second, local, records });
      const bytes = Array.from(await restored.getFile('journal-browser'));
      const stored = await WFP.DB.get('files', 'journal-browser');
      await restored.del('files', 'journal-browser'); local.close();
      return { blocked, bytes, noInternalBytes: !Object.hasOwn(stored, 'bytes'), reference: stored.__wfpVault.location };
    });
    assert.deepEqual(replayResult, { blocked: true, bytes: [7, 8, 9], noInternalBytes: true, reference: 'fixture' });
    assert.deepEqual(errors, []);
    for (const file of ['vendor/scanic/ort-wasm-simd-threaded.mjs', 'vendor/tesseract/lang/rus.traineddata']) {
      const response = await page.request.get('http://127.0.0.1:' + server.address().port + '/' + file);
      assert.equal(response.status(), 200);
      assert.ok((await response.body()).length > 0);
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
