// Windows-Webinhalt bauen: denselben geprüften Bündel wie Android (tools/native/prepare-web.mjs,
// Kern bytegleich) erzeugen, nach windows/dist kopieren und nur die eigenen Windows-
// Dialogseiten unter windows/ ergänzen. Android-Dateien werden nicht verändert.
import { cp, mkdir, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareWeb, root } from '../../tools/native/prepare-web.mjs';

const here = fileURLToPath(new URL('..', import.meta.url));
const dist = join(here, 'dist');
const receipt = await prepareWeb();
await rm(dist, { recursive: true, force: true });
await cp(join(root, 'www'), dist, { recursive: true });
await mkdir(join(dist, 'windows'), { recursive: true });
const extra = [];
for (const name of await readdir(join(here, 'dialog'))) {
  const bytes = await readFile(join(here, 'dialog', name));
  await writeFile(join(dist, 'windows', name), bytes);
  extra.push({ path: 'windows/' + name, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const bridge = await readFile(join(here, 'bridge', 'capacitor-tauri.js'));
for (const name of ['updates.js', 'updates.css']) {
  const bytes = await readFile(join(here, 'bridge', name));
  await writeFile(join(dist, 'windows', name), bytes);
  extra.push({path: 'windows/' + name, sha256: createHash('sha256').update(bytes).digest('hex')});
}
const indexPath = join(dist, 'index.html');
let html = await readFile(indexPath, 'utf8');
const anchor = '<script defer src="assets/app.js?v=67"></script>';
if (html.split(anchor).length !== 2) throw Error('Windows update injection anchor changed');
html = html.replace(anchor, '<script defer src="windows/updates.js"></script>\n' + anchor);
html = html.replace('</head>', '<link rel="stylesheet" href="windows/updates.css">\n</head>');
await writeFile(indexPath, html);
receipt.files.find(f => f.path === 'index.html').sha256 = createHash('sha256').update(html).digest('hex');
receipt.coreByteIdenticalExcept.push('index.html: Windows update adapter tags');
const windowsReceipt = { ...receipt, host: 'windows-tauri', windowsFiles: extra,
  bridge: { path: 'windows/bridge/capacitor-tauri.js (Initialisierungsskript, nicht im Bündel)', sha256: createHash('sha256').update(bridge).digest('hex') } };
await writeFile(join(dist, 'native-bundle.json'), JSON.stringify(windowsReceipt, null, 2) + '\n');
console.log('Windows-Bündel: ' + receipt.files.length + ' Kerndateien, ' + extra.length + ' Windows-Dialogdateien');

