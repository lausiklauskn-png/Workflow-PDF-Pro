import { readFile, writeFile, mkdir, rm, cp, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const runtimeRoots = ['assets/', 'vendor/', 'icons/', 'sbkim/', 'beispiele/'];
export const runtimeFiles = ['index.html', 'sw.js', 'manifest.webmanifest', 'impressum.html',
  'sicherheit.html', 'LICENSE', 'RECHTE.md', 'THIRD_PARTY.md'];
export const vaultFiles=['vault-codec.js','vault-records.js','vault-journal.js','vault-db.js','vault-gate.js','vault-preferences.js','vault-migration.js','native-vault.js','native-tresorordner.js'];
export const nativeFiles = ['native-bootstrap.js', 'native-files.js', 'native-import.js', 'native-incoming.js', 'native-chrome.js', 'native-speech.js', 'native-translate.js', 'chrome/helper.html', 'chrome/helper.js', ...vaultFiles, 'native.css', 'PRIVATE-BRAIN-LICENSE.txt'];
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
  const adapterUrl = name => 'native/' + name + '?v=' + digest(adapters.get(name));
  let html = contents.get('index.html').toString('utf8');
  html = replaceOnce(html, '<title>Workfloh PDF —', '<title>Workflow PDF Pro —');
  html = replaceOnce(html, 'content="Workfloh PDF"', 'content="Workflow PDF Pro"');
  html = replaceOnce(html, 'Workfloh <b>PDF</b>', 'Workflow <b>PDF Pro</b>');
  html = replaceOnce(html, '</head>', '<link rel="stylesheet" href="' + adapterUrl('native.css') + '">\n</head>');
  // Classic deferred scripts preserve source execution order. The source worker stays intact:
  // model caches and share receipt must remain functional in the native host as well.
  // Versionsnummer (Klaus 2026-10-22): die Webversion trägt ihre eigene Nummer im Meta. In der App steht
  // dort zuerst nichts; native-bootstrap.js setzt die App-Nummer (Android-Paket bzw. Tauri) ein.
  const versionMeta = html.match(/<meta name="wfp-version" content="[^"]*"/g) || [];
  if (versionMeta.length !== 1) throw new Error('Native injection anchor changed: wfp-version');
  html = html.replace(versionMeta[0], '<meta name="wfp-version" content=""');
  html = replaceOnce(html, '<script defer src="assets/app.js?v=71"></script>',
    ['native-bootstrap.js','native-files.js','native-import.js','native-incoming.js','native-chrome.js','native-speech.js','native-translate.js',...vaultFiles].map(name=>'<script defer src="'+adapterUrl(name)+'"></script>').join('\n')+'\n<script defer src="assets/app.js?v=71"></script>');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const receipt = { sourceCommit: manifest.commit, coreByteIdenticalExcept: ['index.html: native branding, adapter tags and empty wfp-version (filled by the app)'], files: [] };
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
