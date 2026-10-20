import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_ID } from './identity.mjs';
import { validateReceipt, validateUpdate, compareTags } from './release-policy.mjs';
const commit = '1'.repeat(40);
const receipt = { applicationId: APP_ID, versionName: '1.2.0', versionCode: 7, commit,
  filename: 'Workflow-PDF-Pro-1.2.0.apk', certificateSha256: 'a'.repeat(64), apkSha256: 'b'.repeat(64) };
test('Regulärer Nachweis muss exakt zur Version, App und zum geprüften Commit gehören', () => {
  validateReceipt(receipt, 'v1.2.0', commit);
  for (const patch of [{ commit: '2'.repeat(40) }, { applicationId: 'de.familyprojekt.privatebrain.pro' }, { versionName: '1.2.0-preview.1' },
    { filename: '../fremd.apk' }, { versionCode: 0 }, { versionCode: 1.5 }, { certificateSha256: 'bad' }, { apkSha256: null }]) {
    assert.throws(() => validateReceipt({ ...receipt, ...patch }, 'v1.2.0', commit));
  }
});
test('Gleicher Signierer und beide höheren Versionsnummern erlauben ein Update', () => {
  validateUpdate(receipt, { ...receipt, versionName: '1.1.9', versionCode: 6 });
  for (const patch of [{ certificateSha256: 'c'.repeat(64) }, { applicationId: 'fremd' }, { versionCode: 7 }, { versionCode: 8 }, { versionName: '1.2.0' }, { versionName: '2.0.0' }]) {
    assert.throws(() => validateUpdate(receipt, { ...receipt, versionName: '1.1.9', versionCode: 6, ...patch }));
  }
});
test('Numerische Versionsreihenfolge und Ausschluss von Preview-/falschen Tags', () => {
  assert.equal(compareTags('v1.10.0', 'v1.9.99'), 1); assert.equal(compareTags('v1.2.0', 'v2.0.0'), -1);
  assert.equal(compareTags('v1.2.0', 'v1.2.0'), 0);
  for (const tag of ['v1.0.0-preview.1', 'v01.2.0', 'main', 'v1.0.0;echo']) assert.throws(() => compareTags(tag, 'v1.0.0'));
});
