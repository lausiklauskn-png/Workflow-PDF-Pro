// „Auf Updates prüfen“ unter Windows über die öffentlichen GitHub-Veröffentlichungen (Klaus 2026-10-28: wie Android).
// Lädt die echte Brücke windows/bridge/capacitor-tauri.js in eine Sandbox mit gestelltem Tauri und gestelltem fetch.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const J = (x) => JSON.parse(JSON.stringify(x));
const quelle = readFileSync(new URL('../bridge/capacitor-tauri.js', import.meta.url), 'utf8');
function bruecke(version, releases, status = 200) {
  const aufrufe = [], abrufe = [];
  const window = { top: null, __TAURI_INTERNALS__: { invoke: async (cmd, a) => { aufrufe.push(a); if (a.method === 'appInfo') return { version }; return {}; } },
    addEventListener() {} };
  window.top = window;
  const ctx = { window, location: { host: 'tauri.localhost' }, document: { addEventListener() {}, documentElement: { dataset: {} } }, navigator: {}, console,
    fetch: async (url, o) => { abrufe.push([url, o]); return { ok: status === 200, json: async () => releases }; } };
  vm.runInNewContext(quelle, ctx);
  return { U: window.Capacitor.Plugins.WorkflowUpdates, aufrufe, abrufe };
}
const rel = (tag, name, extra = {}) => ({ tag_name: tag, draft: false, prerelease: false, assets: name ? [{ name, state: 'uploaded', size: 10 }] : [], ...extra });
const LIVE = [rel('v1.0.7', 'Workflow-PDF-Pro-1.0.7.apk'), rel('windows-v1.0.5', 'Workflow-PDF-Pro-Windows-1.0.5-Setup.exe'), rel('windows-v1.0.3', 'Workflow-PDF-Pro-Windows-1.0.3-Setup.exe')];
let n = 0; const ok = (name, f) => f().then(() => { n++; console.log('PASS ' + name); });
await ok('installiert 1.0.3 → Neu: 1.0.5 (Android-Version 1.0.7 zählt nicht)', async () => {
  const { U, abrufe } = bruecke('1.0.3', LIVE); const r = await U.check();
  assert.deepEqual(J(r), { status: 'available', version: '1.0.5', installiert: '1.0.3', tag: 'windows-v1.0.5' });
  assert.equal(abrufe[0][0], 'https://api.github.com/repos/lausiklauskn-png/Workflow-PDF-Pro/releases?per_page=30'); assert.equal(abrufe[0][1].credentials, 'omit');
});
await ok('installiert 1.0.7 (Windows 1.0.5 veröffentlicht) → aktuell', async () => { assert.deepEqual(J(await bruecke("1.0.7", LIVE).U.check()), { status: 'current', version: '1.0.7', installiert: '1.0.7' }); });
await ok('ohne Setup, Vorabfassung, Entwurf, fremder Name → zählen nicht', async () => {
  const r = await bruecke('1.0.5', [rel('windows-v1.0.9', null), rel('windows-v1.0.8', 'Workflow-PDF-Pro-Windows-1.0.8-Setup.exe', { prerelease: true }),
    rel('windows-v1.0.7', 'Workflow-PDF-Pro-Windows-1.0.7-Setup.exe', { draft: true }), rel('windows-v1.0.6', 'anderes.exe'), rel('windows-v1.0.6-beta', 'Workflow-PDF-Pro-Windows-1.0.6-Setup.exe')]).U.check();
  assert.equal(r.status, 'current');
});
await ok('Herunterladen öffnet nur die feste Seite der gefundenen Veröffentlichung', async () => {
  const b = bruecke('1.0.3', LIVE); await assert.rejects(b.U.openDownload(), /UPDATE_CHECK_REQUIRED/);
  await b.U.check(); await b.U.openDownload();
  assert.deepEqual(J(b.aufrufe.at(-1)), { plugin: 'WorkflowFiles', method: 'openLink', options: { url: 'https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/windows-v1.0.5' } });
});
await ok('GitHub nicht erreichbar → UPDATE_UNAVAILABLE', async () => { await assert.rejects(bruecke('1.0.3', [], 503).U.check(), /UPDATE_UNAVAILABLE/); });
console.log(n + ' grün');
