// Real CLI interoperability, using a short-lived key that never enters artifacts.
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyUpdate } from './update-feed.mjs';
const dir = await mkdtemp(join(tmpdir(), 'wfp-update-signature-test-'));
function cli(args) {
  const r = spawnSync(process.execPath, ['node_modules/@tauri-apps/cli/tauri.js', ...args], {cwd: new URL('..', import.meta.url), env: {...process.env, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ''}, encoding: 'utf8'});
  if (r.error || r.status !== 0) throw Error('Tauri signature interoperability command failed; output withheld.');
}
try {
  const key = join(dir, 'key'), file = join(dir, 'fixture.exe');
  const bytes = Buffer.from('Synthetic updater transport fixture'); await writeFile(file, bytes);
  cli(['signer', 'generate', '--ci', '--write-keys', key]);
  cli(['signer', 'sign', '--private-key-path', key, '--app-version', '1.0.2', file]);
  const signature = await readFile(file + '.sig', 'utf8'), publicKey = await readFile(key + '.pub', 'utf8');
  verifyUpdate(bytes, signature, publicKey, '1.0.2');
  for (const [data, version] of [[Buffer.from('modified'), '1.0.2'], [bytes, '9.0.0']]) {
    let rejected = false; try {verifyUpdate(data, signature, publicKey, version);} catch {rejected = true;}
    if (!rejected) throw Error('Tampered updater fixture was accepted');
  }
  console.log('Real Tauri CLI signatures: authentic bytes accepted; modified bytes and substituted version rejected.');
} finally {await rm(dir, {recursive: true, force: true});}
