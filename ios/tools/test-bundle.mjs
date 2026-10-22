import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url);
const base = new URL('ios/App/App/public/', root);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = JSON.parse(await readFile(new URL('native-bundle.json', base)));
test('Apple bundle uses the exact common source and preserves every protected runtime byte', async () => {
  const manifest = JSON.parse(await readFile(new URL('docs/portierung/QUELLDATEIEN-SHA256.json', root)));
  assert.equal(receipt.sourceCommit, manifest.commit);
  assert.equal(receipt.host, 'ios-capacitor');
  const expected = new Map(manifest.files.map(file => [file.path, file.sha256]));
  for (const file of receipt.files) {
    const digest = hash(await readFile(new URL(file.path, base)));
    assert.equal(digest, file.sha256, file.path);
    if (file.path !== 'index.html') assert.equal(digest, expected.get(file.path), file.path);
  }
  for (const name of ['pruefer-anhang.js', 'pruefer-formate.js', 'pruefer-mail.js', 'schluesseltresor.js']) {
    assert.ok(receipt.files.some(file => file.path === 'assets/' + name));
  }
});
test('Apple packaging contains only explicitly selected public runtime files and native adapters', async () => {
  const allowed = new Set(['native-bundle.json', 'CAPACITOR-LICENSE', 'capacitor.js', 'cordova.js', 'cordova_plugins.js']);
  for (const file of receipt.files) allowed.add(file.path);
  for (const file of receipt.iosFiles) allowed.add(file.path);
  async function nativeFiles(url, prefix = '') {
    for (const item of await readdir(url, { withFileTypes: true })) {
      const name = prefix + item.name;
      if (item.isDirectory()) await nativeFiles(new URL(item.name + '/', url), name + '/');
      else allowed.add('native/' + name);
    }
  }
  await nativeFiles(new URL('native/', root));
  async function inspect(url, prefix = '') {
    for (const item of await readdir(url, { withFileTypes: true })) {
      const name = prefix + item.name;
      assert.equal(item.isSymbolicLink(), false, name);
      if (item.isDirectory()) await inspect(new URL(item.name + '/', url), name + '/');
      else {
        assert.equal(allowed.has(name), true, 'Unexpected bundled file: ' + name);
        if (name.startsWith('native/')) assert.equal(hash(await readFile(new URL(name, base))), hash(await readFile(new URL(name, root))), name);
      }
    }
  }
  await inspect(base);
});
test('Apple entry point sets its CSP before scripts and keeps the core entry point after the host adapter', async () => {
  const html = await readFile(new URL('index.html', base), 'utf8');
  const policy = html.indexOf('http-equiv="Content-Security-Policy"');
  assert.ok(policy > 0 && policy < html.indexOf('<script'));
  assert.match(html, /object-src 'none'/);
  assert.match(html, /base-uri 'none'/);
  assert.match(html, /<meta name="wfp-version" content=""/);
  assert.ok(html.indexOf('ios/host.js?') < html.indexOf('src="assets/app.js?'));
  for (const file of receipt.iosFiles) assert.equal(hash(await readFile(new URL(file.path, base))), file.sha256);
});
