import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const code = await readFile(new URL('../bridge/updates.js', import.meta.url), 'utf8');
function page({failSave = false, failDrain = false, noDocument = false, blocked = false, fault = false} = {}) {
  const calls = [], doc = {id: 'document-1', fields: [{value: 'Müller'}]};
  const gate = {blocked, fault, pause: async () => {calls.push('pause');}};
  const window = {__TAURI_INTERNALS__: {invoke() {throw Error('No update network request expected');}},
    WFPNativeVault: {gate}, __wfpdf: {S: {doc: noDocument ? null : doc}}, WFP: {DB: {keys: async () => {calls.push('drained'); if (failDrain) throw Error('Journal unavailable'); return [];}, put: async (store, copy) => {
      assert.equal(store, 'docs'); assert.notEqual(copy, doc); assert.deepEqual(copy, doc); calls.push('saved');
      if (failSave) throw Error('Disk disconnected');
    }}}};
  vm.runInNewContext(code, {window, location: {origin: 'https://tauri.localhost'}, structuredClone,
    document: {documentElement: {lang: 'de'}, activeElement: {blur() {calls.push('blur');}}, addEventListener() {}}});
  return {api: window.WFPWindowsUpdates, calls};
}
test('current document is durably saved before the database is paused for restart', async () => {
  const p = page(); await p.api.saveBeforeRestart(); assert.deepEqual(p.calls, ['blur', 'saved', 'drained', 'pause']);
});
test('failed save never proceeds to the restart boundary', async () => {
  const p = page({failSave: true}); await assert.rejects(p.api.saveBeforeRestart(), /Disk disconnected/); assert.deepEqual(p.calls, ['blur', 'saved']);
});
test('locked, missing or failed storage blocks update installation', async () => {
  for (const state of [{blocked: true}, {fault: true}]) {const p = page(state); await assert.rejects(p.api.saveBeforeRestart(), /STORAGE_NOT_READY/); assert.deepEqual(p.calls, []);}
});
test('preference journal is drained even without an open document', async () => {
  const p = page({noDocument: true}); await p.api.saveBeforeRestart(); assert.deepEqual(p.calls, ['blur', 'drained', 'pause']);
});
test('journal failure also prevents the restart boundary', async () => {
  const p = page({failDrain: true}); await assert.rejects(p.api.saveBeforeRestart(), /Journal unavailable/); assert.deepEqual(p.calls, ['blur', 'saved', 'drained']);
});
