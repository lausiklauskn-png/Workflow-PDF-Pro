import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash, randomBytes, sign } from 'node:crypto';
import { regularVersion, assertNewer, verifyUpdate } from './update-feed.mjs';

function fixture(version = '1.0.2') {
  const {publicKey, privateKey} = generateKeyPairSync('ed25519');
  const keyId = randomBytes(8), bytes = Buffer.from('Synthetic Windows installer fixture');
  const raw = publicKey.export({format: 'der', type: 'spki'}).subarray(-32);
  const key = Buffer.concat([Buffer.from('Ed'), keyId, raw]);
  const publicText = Buffer.from('untrusted comment: minisign public key\n' + key.toString('base64') + '\n').toString('base64');
  const sig = sign(null, createHash('blake2b512').update(bytes).digest(), privateKey);
  const trusted = `timestamp:123\tfile:fixture.exe\tversion:${version}`;
  const global = sign(null, Buffer.concat([sig, Buffer.from(trusted)]), privateKey);
  const text = ['untrusted comment: test signature', Buffer.concat([Buffer.from('ED'), keyId, sig]).toString('base64'), 'trusted comment: ' + trusted, global.toString('base64')].join('\n');
  return {bytes, publicKey: publicText, signature: Buffer.from(text).toString('base64'), version};
}
test('only increasing regular Windows versions are released', () => {
  assert.equal(regularVersion('1.0.2'), '1.0.2'); assertNewer('1.10.0', '1.9.9');
  for (const version of ['1.0.1', '0.9.9']) assert.throws(() => assertNewer(version, '1.0.1'));
  for (const version of ['1.2.3-beta', '01.2.3', '../1.2.3', '1.2.3\n']) assert.throws(() => regularVersion(version));
});
test('authentic artifact and signed version are accepted', () => {
  const f = fixture(); assert.equal(verifyUpdate(f.bytes, f.signature, f.publicKey, f.version), true);
});
test('modified installer, foreign key, substituted version and trusted-comment tampering are rejected', () => {
  const f = fixture(), other = fixture();
  assert.throws(() => verifyUpdate(Buffer.concat([f.bytes, Buffer.from('tamper')]), f.signature, f.publicKey, f.version));
  assert.throws(() => verifyUpdate(f.bytes, f.signature, other.publicKey, f.version));
  assert.throws(() => verifyUpdate(f.bytes, f.signature, f.publicKey, '9.0.0'));
  const changed = Buffer.from(Buffer.from(f.signature, 'base64').toString().replace('version:1.0.2', 'version:9.0.0')).toString('base64');
  assert.throws(() => verifyUpdate(f.bytes, changed, f.publicKey, '9.0.0'));
});
test('missing signatures or keys fail closed', () => {
  const f = fixture();
  for (const [sig, key] of [['', f.publicKey], [f.signature, ''], ['bogus', 'bogus']]) assert.throws(() => verifyUpdate(f.bytes, sig, key, f.version));
});
