import { readFile, writeFile, mkdir, rm, cp, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const runtimeRoots = ['assets/', 'vendor/', 'icons/', 'sbkim/', 'beispiele/'];
export const runtimeFiles = ['index.html', 'sw.js', 'manifest.webmanifest', 'impressum.html',
  'sicherheit.html', 'LICENSE', 'RECHTE.md', 'THIRD_PARTY.md'];
export const vaultFiles=['vault-codec.js','vault-records.js','vault-journal.js','vault-db.js','vault-gate.js','vault-preferences.js','vault-migration.js','native-vault.js','native-tresorordner.js','native-wo-liegt-was.js'];
// Gemeinsame Bedien-Bausteine aller Pro-Apps (Quelle Private Brain Pro, byte-gleich, Pin native/pro-bedienung-herkunft.json).
export const bedienFiles = ['pro-bedienung.js', 'pro-bedienung.css', 'pro-hintergrund.js', 'pro-geraet.js', 'pro-ueberall.js', 'pro-ueberall.css', 'pro-chefcode.js'];
// Scanner und Kamera unter Windows (Pro-Umbau 5): hier gepflegt, byte-gleich nach BookLedgerPro (Pin native/pro-scanner-herkunft.json).
export const scannerFiles = ['pro-scanner.js', 'pro-scanner.css'];
export const nativeFiles = [...bedienFiles, ...scannerFiles, 'native-ohne-web.js', 'native-ueberall.js', 'native-chefcode.js', 'native-netz.js', 'native-kopf.js', 'native-verbund-karte.js', 'pro-verbund.html', 'native-updates.js', 'native-hintergrund.js', 'native-scan-direkt.js', 'native-sicherung.js', 'native-bootstrap.js', 'native-files.js', 'native-import.js', 'pro-transfer-contract.js', 'pro-transfer-store.js', 'native-durable-import.js', 'native-pro-transfers.js', 'native-pro-verbund.js', 'native-incoming.js', 'native-chrome.js', 'native-speech.js', 'native-translate.js', 'chrome/helper.html', 'chrome/helper.js', ...vaultFiles, 'native.css', 'PRIVATE-BRAIN-LICENSE.txt'];
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// This allowlist is deliberately independent of a recursive checkout copy.
// Documents, signing material, sessions, tests and repository metadata never enter the APK.
export function isRuntime(path) {
  return runtimeFiles.includes(path) || runtimeRoots.some(prefix => path.startsWith(prefix));
}
function replaceOnce(html, before, after) {
  if (html.split(before).length !== 2) throw new Error('Native injection anchor changed: ' + before);
  return html.replace(before, after);
}
export async function prepareWeb(out = join(root, 'www')) {
  out = resolve(out);
  if (out !== join(root, 'www')) throw new Error('Bundle output must be the dedicated www directory.');
  const manifest = JSON.parse(await readFile(join(root, 'docs/portierung/QUELLDATEIEN-SHA256.json'), 'utf8'));
  const selected = manifest.files.filter(file => isRuntime(file.path));
  const contents = new Map();
  // Validate everything before replacing any generated output, including protected modules.
  for (const file of manifest.files) {
    const parts = file.path.split('/');
    if (parts.some(part => !part || part === '.' || part === '..' || part.includes('\\'))) throw new Error('Unsafe manifest path');
    let cursor = join(root, 'upstream/workflow-pdf');
    for (const part of parts) {
      cursor = join(cursor, part);
      if ((await lstat(cursor)).isSymbolicLink()) throw new Error('Symlink in source path: ' + file.path);
    }
    const path = join(root, 'upstream/workflow-pdf', file.path);
    if (!relative(join(root, 'upstream/workflow-pdf'), path).startsWith('..') && !(await lstat(path)).isSymbolicLink()) {
      const bytes = await readFile(path);
      if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error('Upstream hash mismatch: ' + file.path);
      if (isRuntime(file.path)) contents.set(file.path, bytes);
    } else throw new Error('Unsafe upstream path: ' + file.path);
  }
  const adapters = new Map();
  for (const name of nativeFiles) {
    const path = join(root, 'native', name);
    if ((await lstat(path)).isSymbolicLink()) throw new Error('Unsafe native adapter: ' + name);
    adapters.set(name, await readFile(path));
  }
  // Pro-App-Verbund (Vorschau): byte-gleiche Kopie aus BookLedgerPro, nie von Hand ändern.
  const verbundPin = JSON.parse(await readFile(join(root, 'native/pro-verbund.herkunft.json'), 'utf8'));
  if (digest(adapters.get('pro-verbund.html')) !== verbundPin.sha256) throw new Error('pro-verbund.html weicht vom Pin native/pro-verbund.herkunft.json ab');
  const adapterUrl = name => 'native/' + name + '?v=' + digest(adapters.get(name));
  let html = contents.get('index.html').toString('utf8');
  html = replaceOnce(html, '<title>Workfloh PDF —', '<title>Workflow PDF Pro —');
  html = replaceOnce(html, 'content="Workfloh PDF"', 'content="Workflow PDF Pro"');
  html = replaceOnce(html, 'Workfloh <b>PDF</b>', 'Workflow <b>PDF Pro</b>');
  // The native adapter already owns this opt-in and its stored preference.
  // Loading the newer web controller as well would create two independent
  // switches controlling the same Mycel responder. Keep all source bytes; only
  // the native entry page selects which existing adapter runs.
  html = replaceOnce(html, '<script defer src="assets/netz.js?v=1"></script>', '');
  html = replaceOnce(html, '</head>', '<link rel="stylesheet" href="' + adapterUrl('pro-bedienung.css') + '">\n<link rel="stylesheet" href="' + adapterUrl('pro-ueberall.css') + '">\n<link rel="stylesheet" href="' + adapterUrl('pro-scanner.css') + '">\n<link rel="stylesheet" href="' + adapterUrl('native.css') + '">\n</head>');
  // Classic deferred scripts preserve source execution order. The source worker stays intact:
  // model caches and share receipt must remain functional in the native host as well.
  // Versionsnummer (Klaus 2026-10-22): die Webversion trägt ihre eigene Nummer im Meta. In der App steht
  // dort zuerst nichts; native-bootstrap.js setzt die App-Nummer (Android-Paket bzw. Tauri) ein.
  const versionMeta = html.match(/<meta name="wfp-version" content="[^"]*"/g) || [];
  if (versionMeta.length !== 1) throw new Error('Native injection anchor changed: wfp-version');
  html = html.replace(versionMeta[0], '<meta name="wfp-version" content=""');
  const appTag = html.match(/<script defer src="assets\/app\.js\?v=\d+"><\/script>/g);
  if (appTag?.length !== 1) throw new Error('Native injection anchor changed: app.js');
  html = replaceOnce(html, appTag[0],
    ['pro-bedienung.js','pro-hintergrund.js','pro-geraet.js','native-bootstrap.js','native-files.js','native-import.js','pro-transfer-contract.js','pro-transfer-store.js','native-durable-import.js','native-pro-transfers.js','native-pro-verbund.js','native-incoming.js','native-chrome.js','native-speech.js','native-translate.js',...vaultFiles,'native-updates.js','native-hintergrund.js','native-scan-direkt.js','native-sicherung.js','native-ohne-web.js','pro-scanner.js','pro-ueberall.js','native-ueberall.js','pro-chefcode.js','native-chefcode.js','native-netz.js','native-kopf.js','native-verbund-karte.js'].map(name=>'<script defer src="'+adapterUrl(name)+'"></script>').join('\n')+'\n'+appTag[0]);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const receipt = { sourceCommit: manifest.commit, coreByteIdenticalExcept: ['index.html: native branding, adapter tags, native network controller instead of web network script tag, empty wfp-version (filled by the app)'], files: [] };
  for (const file of selected) {
    await mkdir(dirname(join(out, file.path)), { recursive: true });
    const bytes = file.path === 'index.html' ? Buffer.from(html) : contents.get(file.path);
    await writeFile(join(out, file.path), bytes);
    receipt.files.push({ path: file.path, sha256: digest(bytes), sourceSha256: file.sha256 });
  }
  for (const [name, bytes] of adapters) {
    await mkdir(dirname(join(out, 'native', name)), { recursive: true });
    await writeFile(join(out, 'native', name), bytes);
  }
  await cp(join(root, 'node_modules/@capacitor/core/LICENSE'), join(out, 'CAPACITOR-LICENSE'));
  await writeFile(join(out, 'native-bundle.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log('Local native bundle: ' + selected.length + ' public source files; source ' + manifest.commit);
  return receipt;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await prepareWeb();
