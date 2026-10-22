// Real Android Java <-> Apple CryptoKit <-> Windows Rust codec probes.
// Runs on macOS; generated keys are public synthetic fixtures, never user data.
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash, pbkdf2Sync } from 'node:crypto';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workspace = await mkdtemp(join(tmpdir(), 'wfp-apple-compat-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 300_000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.error?.message || result.stderr.slice(-6000)}`);
  return result.stdout.trim();
}
try {
  const classes = join(workspace, 'classes'); await mkdir(classes);
  const android = resolve(root, 'android/app/src/main/java/de/familyprojekt/workflowpdf/pro');
  run('javac', ['-d', classes, join(android, 'VaultCrypto.java'), join(android, 'VaultRecovery.java'), 'ios/compat/VaultCodecCompat.java', 'windows/core/compat/RecoveryCompat.java', 'windows/core/compat/VaultCompat.java']);
  run('cargo', ['build', '--locked', '--release', '--manifest-path', 'ios/compat/rust/Cargo.toml', '--target-dir', join(workspace, 'rust')]);
  run('swift', ['build', '--package-path', 'ios/WorkflowNativeCore', '--product', 'WorkflowVaultCompat']);
  const swiftBin = run('swift', ['build', '--package-path', 'ios/WorkflowNativeCore', '--show-bin-path']);
  const codecs = [
    ['Android', 'java', ['-cp', classes, 'de.familyprojekt.workflowpdf.pro.VaultCodecCompat']],
    ['Apple', join(swiftBin, 'WorkflowVaultCompat'), []],
    ['Windows', join(workspace, 'rust/release/wfp-apple-compat'), []],
  ];
  let transfers = 0;
  for (const size of [0, 1, 262143, 262144, 262145, 900000]) {
    const bytes = Buffer.alloc(size); for (let i = 0; i < size; i++) bytes[i] = i % 251;
    const source = join(workspace, `plain-${size}`); await writeFile(source, bytes);
    const expected = createHash('sha256').update(bytes).digest('hex');
    for (const [writer, command, prefix] of codecs) {
      const target = join(workspace, `${writer}-${size}.wpv`);
      run(command, [...prefix, 'write', source, target]);
      for (const [reader, readCommand, readPrefix] of codecs) {
        assert.equal(run(readCommand, [...readPrefix, 'read', target]), expected, `${writer} -> ${reader}, ${size}`);
        transfers++;
      }
    }
  }
  const derived = pbkdf2Sync('Gemäßigtes Passwort €', Buffer.from(Array.from({length:16}, (_,i)=>i)), 600000, 32, 'sha256').toString('hex');
  for (const [name, command, prefix] of codecs) assert.equal(run(command, [...prefix, 'derive']), derived, name + ' NFC PBKDF2');
  const recovery = [
    ['Android', 'java', ['-cp', classes, 'de.familyprojekt.workflowpdf.pro.RecoveryCompat']],
    ...codecs.slice(1),
  ];
  const secret = Buffer.from(Array.from({length:32}, (_,i)=>i)).toString('hex');
  let combinations = 0;
  for (const [writer, command, prefix] of recovery) {
    const shares = run(command, [...prefix, 'split', ...(writer === 'Android' ? [secret] : [])]).split(/\r?\n/);
    assert.equal(shares.length, 5);
    for (const [reader, readCommand, readPrefix] of recovery) {
      for (let a=0;a<3;a++) for (let b=a+1;b<4;b++) for (let c=b+1;c<5;c++) {
        assert.equal(run(readCommand, [...readPrefix, 'combine', shares[a], shares[b], shares[c]]), secret, `${writer} -> ${reader} recovery`);
        combinations++;
      }
    }
  }
  // Whole portable folder: header, password wrapping, commit marker, encrypted
  // index and actual record. Reuse the unchanged Windows/Android fixture CLIs.
  run('cargo', ['build', '--locked', '--release', '--example', 'compat', '--manifest-path', 'windows/core/Cargo.toml', '--target-dir', join(workspace, 'windows')]);
  const passwordFile = join(workspace, 'password'); await writeFile(passwordFile, 'Gema\u0308ßigtes Passwort €');
  const source = join(workspace, 'plain-900000');
  const expected = createHash('sha256').update(Buffer.from(Array.from({length:900000},(_,i)=>i%251))).digest('hex');
  let folderDirections=0;
  const windows = join(workspace, 'windows/release/examples/compat');
  const apple = join(swiftBin, 'WorkflowVaultCompat');
  const java = ['-cp', classes, 'de.familyprojekt.workflowpdf.pro.VaultCompat'];
  for (const writer of ['Android', 'Apple', 'Windows']) {
    const selected = join(workspace, `folder-${writer}`); await mkdir(selected);
    let actual = selected;
    if (writer === 'Android') assert.equal(run('java', [...java, 'write', selected, passwordFile, source]), expected);
    if (writer === 'Apple') assert.equal(run(apple, ['vault-write', selected, source]), expected);
    if (writer === 'Windows') {
      assert.equal(run(windows, ['write', selected, 'Gemäßigtes Passwort €', source]), expected);
      actual = join(selected, 'Workflow PDF Pro');
    }
    assert.equal(run('java', [...java, 'read', actual, passwordFile]), expected); folderDirections++;
    assert.equal(run(apple, ['vault-read', actual]), expected); folderDirections++;
    assert.equal(run(windows, ['read', actual, 'Gemäßigtes Passwort €']), expected); folderDirections++;
  }
  console.log(JSON.stringify({transfers, kdfImplementations:3, recoveryCombinations:combinations, folderDirections, skipped:0}));
} finally { await rm(workspace, { recursive: true, force: true }); }
