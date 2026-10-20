import { randomBytes } from 'node:crypto';
import { realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
try {
  const destination = process.argv[2];
  if (!destination || !path.isAbsolute(destination)) throw new Error('Absoluten neuen Dateipfad außerhalb des Repos angeben.');
  const root = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
  const parent = await realpath(path.dirname(destination));
  if (parent === root || parent.startsWith(root + path.sep)) throw new Error('Die Entschlüsselungsfreigabe gehört außerhalb des Repositories.');
  const key = randomBytes(32);
  try { await writeFile(path.join(parent, path.basename(destination)), key.toString('hex'), { mode: 0o600, flag: 'wx' }); }
  finally { key.fill(0); }
  console.log('Freigabedatei mit Modus 0600 erstellt; Inhalt nicht ausgegeben. Separat sicher sichern und in GitHub als Environment-Secret hinterlegen.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
