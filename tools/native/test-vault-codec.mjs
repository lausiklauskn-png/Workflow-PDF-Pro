import test from 'node:test';
import assert from 'node:assert/strict';
await import('../../native/vault-codec.js');
const { encode, decode } = globalThis.WFPVaultCodec;

test('vault record preserves binary originals, translation work, fields and shared views without base64 growth', async () => {
  const buffer = new ArrayBuffer(1000000), bytes = new Uint8Array(buffer); for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
  const record = { id: 'ue:dokument:de-ru', bytes, job: { seiten: [{ text: 'Müller — Документ', fertig: true }], n: 1 },
    fields: [{ value: 'Änderung', type: 'text', geprueft: true }], view: new Uint16Array(buffer, 16, 4), missing: undefined };
  record.same = record.bytes;
  const blob = encode(record); assert.ok(blob.size < 1005000);
  const restored = await decode(blob);
  assert.deepEqual(restored, record); assert.equal(restored.bytes, restored.same); assert.equal(restored.bytes.buffer, restored.view.buffer);
  assert.equal(Object.hasOwn(restored, 'missing'), true);
});
test('vault record handles graphs, maps, dates, blobs, sparse arrays and prototype-like labels safely', async () => {
  const map = new Map(), set = new Set(), record = { map, set, date: new Date(12345), nonfinite: [NaN, Infinity, -Infinity, -0], sparse: new Array(3), blob: new Blob(['Копия'], { type: 'text/plain' }) };
  record.self = record; map.set(record, set); set.add(map); record.sparse[2] = 'end';
  Object.defineProperty(record, '__proto__', { value: { harmless: true }, enumerable: true });
  const restored = await decode(encode(record));
  assert.equal(restored.self, restored); assert.equal(restored.map.get(restored), restored.set); assert.equal(restored.set.has(restored.map), true);
  assert.equal(restored.date.getTime(), 12345); assert.equal(Object.is(restored.nonfinite[3], -0), true);
  assert.equal(0 in restored.sparse, false); assert.equal(await restored.blob.text(), 'Копия');
  assert.equal(Object.getPrototypeOf(restored), Object.prototype); assert.equal(Object.hasOwn(restored, '__proto__'), true); assert.equal({}.harmless, undefined);
});
test('truncation, trailing data, invalid references and unsupported executable values are rejected', async () => {
  const blob = encode({ id: 'x', bytes: new Uint8Array([1,2,3]) });
  for (const changed of [blob.slice(0, blob.size - 1), new Blob([blob, 'extra']), new Blob(['bad'])]) await assert.rejects(decode(changed));
  const prefix = new TextEncoder().encode('WFPKV1\n'), header = new TextEncoder().encode(JSON.stringify({ format: 'workflow-record', v: 1, nodes: [], blocks: [], root: { r: 3 } }));
  const length = new Uint8Array(4); new DataView(length.buffer).setUint32(0, header.length);
  await assert.rejects(decode(new Blob([prefix, length, header])));
  assert.throws(() => encode({ executable() {} }), /UNSUPPORTED/);
});
