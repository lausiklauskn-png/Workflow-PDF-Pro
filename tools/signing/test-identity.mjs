import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, X509Certificate, verify } from 'node:crypto';
import { readFile, writeFile, stat, access } from 'node:fs/promises';
import path from 'node:path';
import { createIdentity, withIdentity, privateDirectory, saveNewIdentity, verifyPinnedIdentity, checked, APP_ID } from './identity.mjs';

const key = randomBytes(32).toString('hex');
let envelope;
before(async () => { envelope = await createIdentity(key); });
after(() => { envelope = null; });

test('Echter temporärer Android-Keystore wird authentifiziert verschlüsselt; kein Produktionsschlüssel', () => {
  assert.equal(envelope.applicationId, APP_ID);
  assert.equal(envelope.algorithm, 'aes-256-gcm');
  assert.match(envelope.certificateSha256, /^[a-f0-9]{64}$/);
  assert.equal(Buffer.from(envelope.nonce, 'base64').length, 12);
  const text = JSON.stringify(envelope);
  assert.ok(!text.includes('password')); assert.ok(!text.includes('PRIVATE KEY')); assert.ok(!text.includes(key));
});

test('Zwei getrennte Wiederherstellungen nutzen dasselbe echte Zertifikat und denselben privaten Schlüssel', async () => {
  const payload = Buffer.from('synthetic-update-artifact');
  const sign = async () => withIdentity(envelope, key, async identity => {
    assert.equal((await stat(identity.file)).mode & 0o777, 0o600);
    assert.equal((await stat(identity.directory)).mode & 0o777, 0o700);
    const encryptedPem = path.join(identity.directory, 'private-encrypted.pem');
    const env = { WF_PDF_STORE_PASSWORD: identity.password, WF_PDF_TEST_PEM_PASSWORD: randomBytes(32).toString('hex') };
    checked('openssl', ['pkcs12', '-in', identity.file, '-passin', 'env:WF_PDF_STORE_PASSWORD', '-nocerts', '-out', encryptedPem, '-passout', 'env:WF_PDF_TEST_PEM_PASSWORD'], env);
    const dataFile = path.join(identity.directory, 'input'); await writeFile(dataFile, payload, { mode: 0o600 });
    const signature = checked('openssl', ['dgst', '-sha256', '-sign', encryptedPem, '-passin', 'env:WF_PDF_TEST_PEM_PASSWORD', dataFile], env);
    assert.ok(verify('sha256', payload, new X509Certificate(identity.certificate).publicKey, signature));
    return { fingerprint: identity.fingerprint, signature, directory: identity.directory };
  });
  const a = await sign(), b = await sign();
  assert.equal(a.fingerprint, b.fingerprint); assert.deepEqual(a.signature, b.signature);
  assert.notEqual(a.directory, b.directory);
  await assert.rejects(access(a.directory)); await assert.rejects(access(b.directory));
});

test('Falsche Freigabe kann nichts entschlüsseln', async () => {
  let used = false;
  await assert.rejects(withIdentity(envelope, randomBytes(32).toString('hex'), () => { used = true; }), /nicht authentisch|Freigabe falsch/);
  assert.equal(used, false);
  await assert.rejects(withIdentity(envelope, 'proxy-placeholder', () => {}), /64 Hexzeichen/);
});

test('Manipulierte Chiffre, Nonce, Tag und Zertifikat werden vor Verwendung abgewiesen', async () => {
  for (const field of ['ciphertext', 'nonce', 'tag']) {
    const changed = structuredClone(envelope), bytes = Buffer.from(changed[field], 'base64'); bytes[0] ^= 1; changed[field] = bytes.toString('base64');
    await assert.rejects(withIdentity(changed, key, () => assert.fail('Beschädigter Schlüssel wurde benutzt')));
  }
  await assert.rejects(withIdentity({ ...envelope, certificateSha256: '0'.repeat(64) }, key, () => assert.fail()), /authentisch/);
});

test('Private-Brain-/fremde App-Kennung und falsche Formate werden abgewiesen', async () => {
  for (const patch of [{ applicationId: 'de.familyprojekt.privatebrain.pro' }, { version: 2 }, { algorithm: 'aes-256-cbc' }, { tag: 'bad!' }]) {
    await assert.rejects(withIdentity({ ...envelope, ...patch }, key, () => assert.fail()));
  }
});

test('Zertifikats-Pin und bereits vorhandene Identität werden nicht ersetzt', async () => {
  await privateDirectory(async directory => {
    await saveNewIdentity(directory, envelope);
    assert.equal(await verifyPinnedIdentity(directory, key), true);
    const original = await readFile(path.join(directory, 'android-release.enc.json'));
    await assert.rejects(saveNewIdentity(directory, envelope), /niemals automatisch ersetzen/);
    assert.deepEqual(await readFile(path.join(directory, 'android-release.enc.json')), original);
    const metadata = path.join(directory, 'android-certificate.json');
    await writeFile(metadata, JSON.stringify({ applicationId: APP_ID, certificateSha256: '0'.repeat(64) }));
    await assert.rejects(verifyPinnedIdentity(directory, key), /Pin stimmt nicht/);
  });
});

test('Auch bei abgebrochenem Signierbefehl bleibt kein entpackter Schlüssel zurück', async () => {
  let directory;
  await assert.rejects(withIdentity(envelope, key, async identity => { directory = identity.directory; throw new Error('synthetischer Abbruch'); }), /synthetischer Abbruch/);
  await assert.rejects(access(directory));
});
