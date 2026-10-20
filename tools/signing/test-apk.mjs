import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { APP_ID, createIdentity, saveNewIdentity, checked } from './identity.mjs';
import { signApk } from './apk.mjs';

// Actual Google Android 36 tools, checksum-verified during setup. APKs contain
// only a synthetic no-code manifest; never publish them as an app version.
const sdk = '/workspace/setup/signing-sdk';
const tools = path.join(sdk, 'build-tools/android-16');
const signer = path.join(tools, 'apksigner'), aapt = path.join(tools, 'aapt');
const key = randomBytes(32).toString('hex'), commit = '7'.repeat(40);
let directory, counter = 0, envelope;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'wf-apk-fixture-'));
  envelope = await createIdentity(key); await saveNewIdentity(directory, envelope);
});
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

async function fixture({ app = APP_ID, version = '1.0.0', code = 1, debug = false } = {}) {
  const folder = path.join(directory, 'apk-' + (++counter)); await import('node:fs/promises').then(fs => fs.mkdir(folder));
  const manifest = path.join(folder, 'AndroidManifest.xml');
  await writeFile(manifest, `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="${app}" android:versionCode="${code}" android:versionName="${version}"><uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36"/><application android:label="Synthetic signing fixture" android:hasCode="false" android:debuggable="${debug}"/></manifest>`);
  const raw = path.join(folder, 'raw.apk'), input = path.join(folder, 'unsigned.apk'), output = path.join(folder, 'signed.apk');
  checked(aapt, ['package', '-f', '-M', manifest, '-I', path.join(sdk, 'platform/android-36/android.jar'), '-F', raw], {});
  checked(path.join(tools, 'zipalign'), ['-f', '4', raw, input], {});
  return { input, output, signer, aapt, tag: 'v' + version, commit, directory, key };
}

test('Echte APK wird signiert; Kennung, Version, Zertifikat und Prüfsumme stimmen', async () => {
  const args = await fixture(), before = await readFile(args.input);
  const receipt = await signApk(args);
  assert.equal(receipt.applicationId, APP_ID); assert.equal(receipt.versionCode, 1);
  assert.equal(receipt.certificateSha256, envelope.certificateSha256);
  assert.deepEqual(await readFile(args.input), before);
  assert.equal(JSON.parse(await readFile(args.output + '.json', 'utf8')).commit, commit);
  assert.match(await readFile(args.output + '.sha256', 'utf8'), new RegExp('^' + receipt.apkSha256));
  assert.equal(spawnSync(signer, ['verify', args.output]).status, 0);
});

test('Nächste APK verwendet dieselbe Identität bei höherer regulärer Version/Buildnummer', async () => {
  const args = await fixture({ version: '1.0.1', code: 2 }); const receipt = await signApk(args);
  assert.equal(receipt.versionCode, 2); assert.equal(receipt.versionName, '1.0.1');
  assert.equal(receipt.certificateSha256, envelope.certificateSha256);
});

test('Fremde App (Private Brain) wird nicht unter Workflow PDF Pro ausgeliefert', async () => {
  const args = await fixture({ app: 'de.familyprojekt.privatebrain.pro' });
  await assert.rejects(signApk(args), /nicht zu Workflow PDF Pro/); await assert.rejects(access(args.output));
});

test('Debugflag und nicht passende Versionskennung verhindern eine reguläre Ausgabe', async () => {
  const debug = await fixture({ debug: true }); await assert.rejects(signApk(debug), /Debug-APK/); await assert.rejects(access(debug.output));
  const wrongVersion = await fixture(); await assert.rejects(signApk({ ...wrongVersion, tag: 'v9.0.0' }), /APK-Version/);
  await assert.rejects(access(wrongVersion.output));
  const preview = await fixture(); await assert.rejects(signApk({ ...preview, tag: 'v1.0.0-preview.1' }), /Regulärer Release-Tag/);
});

test('Änderung an der tatsächlich signierten APK wird vom echten apksigner entdeckt', async () => {
  const args = await fixture(); await signApk(args);
  const bytes = await readFile(args.output); bytes[64] ^= 1; await writeFile(args.output, bytes);
  assert.notEqual(spawnSync(signer, ['verify', args.output], { stdio: 'pipe' }).status, 0);
});

test('Vorhandene Ausgabe wird nicht ersetzt; falsche Freigabe hinterlässt keine neue APK', async () => {
  const existing = await fixture(); await writeFile(existing.output, 'existing-user-file');
  await assert.rejects(signApk(existing), /EEXIST/); assert.equal(await readFile(existing.output, 'utf8'), 'existing-user-file');
  const wrongKey = await fixture();
  await assert.rejects(signApk({ ...wrongKey, key: randomBytes(32).toString('hex') }), /Freigabe falsch/);
  await assert.rejects(access(wrongKey.output));
});
