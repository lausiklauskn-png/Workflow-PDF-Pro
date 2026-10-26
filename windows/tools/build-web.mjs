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
const dialogAssets = new Map();
for (const name of await readdir(join(here, 'dialog'))) dialogAssets.set(name, await readFile(join(here, 'dialog', name)));
for (const [name, source] of dialogAssets) {
  let bytes = source;
  if (name.endsWith('.html')) {
    bytes = Buffer.from(source.toString().replace(/\b(src|href)="([^"?]+)"/g, (tag, attribute, target) => {
      if (!dialogAssets.has(target)) return tag;
      const hash = createHash('sha256').update(dialogAssets.get(target)).digest('hex');
      return `${attribute}="${target}?v=${hash}"`;
    }));
  }
  await writeFile(join(dist, 'windows', name), bytes);
  extra.push({ path: 'windows/' + name, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const bridge = await readFile(join(here, 'bridge', 'capacitor-tauri.js'));
const updateHashes = {};
for (const name of ['updates.js', 'updates.css']) {
  const bytes = await readFile(join(here, 'bridge', name));
  await writeFile(join(dist, 'windows', name), bytes);
  const hash = createHash('sha256').update(bytes).digest('hex');
  updateHashes[name] = hash;
  extra.push({path: 'windows/' + name, sha256: hash});
}
const indexPath = join(dist, 'index.html');
let html = await readFile(indexPath, 'utf8');
const anchor = '<script defer src="assets/app.js?v=71"></script>';
if (html.split(anchor).length !== 2) throw Error('Windows update injection anchor changed');
let probe = '';
if (process.env.WFP_WINDOWS_PROBE === '1') {
  const bytes = await readFile(join(here, 'pruefung', 'csp-probe.js'));
  await writeFile(join(dist, 'windows', 'csp-probe.js'), bytes);
  extra.push({path:'windows/csp-probe.js',sha256:createHash('sha256').update(bytes).digest('hex')});
  probe = '<script defer src="windows/csp-probe.js"></script>\n';
}
html = html.replace(anchor, probe + '<script defer src="windows/updates.js?v=' + updateHashes['updates.js'] + '"></script>\n' + anchor);
html = html.replace('</head>', '<link rel="stylesheet" href="windows/updates.css?v=' + updateHashes['updates.css'] + '">\n</head>');
await writeFile(indexPath, html);
receipt.files.find(f => f.path === 'index.html').sha256 = createHash('sha256').update(html).digest('hex');
receipt.coreByteIdenticalExcept.push('index.html: Windows update adapter tags');
const windowsReceipt = { ...receipt, host: 'windows-tauri', windowsFiles: extra,
  bridge: { path: 'windows/bridge/capacitor-tauri.js (Initialisierungsskript, nicht im Bündel)', sha256: createHash('sha256').update(bridge).digest('hex') } };
await writeFile(join(dist, 'native-bundle.json'), JSON.stringify(windowsReceipt, null, 2) + '\n');
console.log('Windows-Bündel: ' + receipt.files.length + ' Kerndateien, ' + extra.length + ' Windows-Dialogdateien');

