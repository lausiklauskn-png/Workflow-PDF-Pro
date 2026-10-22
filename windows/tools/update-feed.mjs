import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = 'https://github.com/lausiklauskn-png/Workflow-PDF-Pro';
export function regularVersion(value) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value || '')) throw Error('A regular Windows version is required');
  return value;
}
export function assertNewer(version, previous) {
  const next = regularVersion(version).split('.').map(BigInt), old = regularVersion(previous).split('.').map(BigInt);
  for (let i = 0; i < 3; i++) { if (next[i] > old[i]) return; if (next[i] < old[i]) break; }
  throw Error('Windows versions must increase');
}
function base64(text, size) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw Error('Invalid signature encoding');
  const bytes = Buffer.from(text, 'base64');
  if (bytes.toString('base64') !== text || size && bytes.length !== size) throw Error('Invalid signature encoding');
  return bytes;
}
// Independent verification of the Tauri/minisign signature before publication.
// The application's updater repeats verification before downloading/installing.
export function verifyUpdate(bytes, signature, publicKey, version) {
  regularVersion(version);
  const keyLines = base64(publicKey.trim()).toString('utf8').trim().split(/\r?\n/);
  const key = base64(keyLines[1], 42);
  if (key.subarray(0, 2).toString() !== 'Ed') throw Error('Unsupported update key');
  const lines = base64(signature.trim()).toString('utf8').trim().split(/\r?\n/);
  if (lines.length !== 4 || !lines[2].startsWith('trusted comment: ')) throw Error('Invalid update signature');
  const sig = base64(lines[1], 74), global = base64(lines[3], 64);
  if (sig.subarray(0, 2).toString() !== 'ED' || !sig.subarray(2, 10).equals(key.subarray(2, 10))) throw Error('Wrong signature key');
  const pk = createPublicKey({key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.subarray(10)]), format: 'der', type: 'spki'});
  const trusted = lines[2].slice('trusted comment: '.length);
  if (!verify(null, createHash('blake2b512').update(bytes).digest(), pk, sig.subarray(10)) ||
      !verify(null, Buffer.concat([sig.subarray(10), Buffer.from(trusted)]), pk, global)) throw Error('Update signature rejected');
  const fields = trusted.split('\t').filter(field => field.startsWith('version:'));
  if (fields.length !== 1 || fields[0] !== 'version:' + version) throw Error('Signed version does not match manifest');
  return true;
}
export async function createFeed({directory, version, publicKeyPath, previous}) {
  regularVersion(version); if (previous) assertNewer(version, previous);
  const name = `Workflow-PDF-Pro-Windows-${version}-Setup.exe`;
  const bytes = await readFile(join(directory, name));
  const signature = (await readFile(join(directory, name + '.sig'), 'utf8')).trim();
  verifyUpdate(bytes, signature, await readFile(publicKeyPath, 'utf8'), version);
  const feed = {version, notes: `Workflow PDF Pro für Windows ${version}`, pub_date: new Date().toISOString(),
    platforms: {'windows-x86_64': {signature, url: `${repo}/releases/download/windows-v${version}/${name}`}}};
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await writeFile(join(directory, name + '.sha256'), `${sha256}  ${name}\n`);
  await writeFile(join(directory, 'latest.json'), JSON.stringify(feed, null, 2) + '\n');
  return {name, sha256, size: bytes.length};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [directory, version, publicKeyPath, previous] = process.argv.slice(2);
  if (!directory || !version || !publicKeyPath) throw Error('Usage: update-feed.mjs directory version public-key-file [previous-version]');
  console.log(JSON.stringify(await createFeed({directory, version, publicKeyPath, previous})));
}
