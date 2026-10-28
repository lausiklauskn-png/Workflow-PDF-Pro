/* Workflow PDF Pro für Windows: stellt den gemeinsamen Geräteadaptern (native/*.js)
   dieselbe Plugin-Schnittstelle bereit wie Capacitor unter Android. Jeder Aufruf geht
   an den Rust-Host (Tauri). Der Webkern und die Adapter bleiben unverändert.
   Läuft als Initialisierungsskript vor allen Seitenskripten, nur im Hauptfenster. */
(() => {
  'use strict';
  if (window.Capacitor || window.top !== window || location.host !== 'tauri.localhost') return;
  const internals = window.__TAURI_INTERNALS__;
  if (!internals?.invoke) return;
  const listeners = new Map();
  // Rust meldet Ereignisse über diese eine Funktion (siehe events.rs).
  Object.defineProperty(window, '__wfpHostEvent', { value(plugin, event, data) {
    for (const fn of listeners.get(plugin + ':' + event) || []) { try { fn(data); } catch (error) { console.error(error); } }
  } });
  class HostError extends Error { constructor(code) { super(code); this.code = code; } }
  function call(plugin, method, options) {
    return internals.invoke('wfp_call', { plugin, method, options: options ?? {} })
      .catch(error => { throw new HostError(typeof error === 'string' ? error : String(error?.message || error)); });
  }
  function plugin(name, methods) {
    const api = {};
    for (const method of methods) api[method] = options => call(name, method, options);
    api.addListener = (event, fn) => {
      const key = name + ':' + event;
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(fn);
      return { remove: async () => { listeners.get(key)?.delete(fn); } };
    };
    return Object.freeze(api);
  }
  // „Auf Updates prüfen“ unter Windows wie unter Android (Klaus 2026-10-28): der Tauri-Updater ist ohne Schlüssel und ohne
  // latest.json nie eingerichtet worden. Gelesen werden die öffentlichen Veröffentlichungen „windows-vX.Y.Z“ mit hochgeladenem
  // Setup; „Herunterladen“ öffnet deren feste Seite, installiert nichts. Gleiche Regel wie UpdateRegel.java (Android).
  const REPO = 'lausiklauskn-png/Workflow-PDF-Pro';
  const teile = (text, re) => { const m = re.exec(text || ''); return m ? [+m[1], +m[2], +m[3]] : null; };
  const neuer = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
  function auswerten(installiert, releases) {
    const ich = teile(installiert, /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})(?:-[A-Za-z0-9.]+)?$/);
    if (!ich) throw new HostError('UPDATE_VERSION_UNBEKANNT');
    let best = ich, bestTag = null;
    for (const r of Array.isArray(releases) ? releases : []) {
      if (!r || r.draft !== false || r.prerelease !== false) continue;
      const v = teile(r.tag_name, /^windows-v(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/);
      if (!v || !neuer(v, best)) continue;
      const name = 'Workflow-PDF-Pro-Windows-' + v.join('.') + '-Setup.exe';
      if (!(r.assets || []).some(a => a && a.name === name && a.state === 'uploaded' && a.size > 0)) continue;
      best = v; bestTag = r.tag_name;
    }
    const text = ich.join('.');
    return bestTag ? { status: 'available', version: best.join('.'), installiert: text, tag: bestTag } : { status: 'current', version: text, installiert: text };
  }
  let updateTag = null;
  const WorkflowUpdates = Object.freeze({
    async check() {
      updateTag = null;
      const { version } = await call('WorkflowFiles', 'appInfo', {});
      let antwort;
      try { antwort = await fetch('https://api.github.com/repos/' + REPO + '/releases?per_page=30', { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store', credentials: 'omit' }); }
      catch { throw new HostError('UPDATE_UNAVAILABLE'); }
      if (!antwort.ok) throw new HostError('UPDATE_UNAVAILABLE');
      const out = auswerten(version, await antwort.json());
      updateTag = out.tag || null; return out;
    },
    async openDownload() {
      if (!updateTag || !/^windows-v\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(updateTag)) throw new HostError('UPDATE_CHECK_REQUIRED');
      return call('WorkflowFiles', 'openLink', { url: 'https://github.com/' + REPO + '/releases/tag/' + updateTag });
    },
    addListener: async () => ({ remove: async () => {} })
  });
  const Plugins = Object.freeze({
    WorkflowUpdates,
    WorkflowFiles: plugin('WorkflowFiles', ['begin', 'append', 'finish', 'abort', 'save', 'share', 'print', 'openLink', 'appInfo']),
    WorkflowImport: plugin('WorkflowImport', ['chooseFolder', 'read', 'release']),
    WorkflowIncoming: plugin('WorkflowIncoming', ['pending', 'read', 'acknowledge', 'history', 'restore', 'discardArchived']),
    WorkflowVault: plugin('WorkflowVault', ['state', 'locations', 'migration', 'prepareMigration', 'completeMigration', 'cancelMigration',
      'beginBatch', 'commitBatch', 'abortBatch', 'setPrimary', 'volumes', 'choose', 'unlock', 'lock', 'begin', 'append', 'finish', 'abort',
      'info', 'read', 'list', 'remove', 'recoveryInfo', 'createRecovery']),
    WorkflowChrome: plugin('WorkflowChrome', ['begin', 'translate', 'close']),
    // Scanner über Windows-WIA (windows/scanner/scanner.rs, gemeinsamer Baustein der Pro-Hüllen).
    ProScanner: plugin('ProScanner', ['geraete', 'scannen'])
  });
  window.Capacitor = Object.freeze({
    isNativePlatform: () => true,
    getPlatform: () => 'windows',
    Plugins
  });
  // Maus-Zurücktaste und Alt+Links entsprechen der Android-Zurücktaste.
  const back = event => {
    if (window.WFPNativeNavigation?.back?.() === true) event.preventDefault();
  };
  window.addEventListener('mouseup', event => { if (event.button === 3) back(event); }, true);
  window.addEventListener('keydown', event => { if (event.altKey && event.key === 'ArrowLeft') back(event); }, true);
  // Teilen: zuerst das Teilen-Fenster von Windows (Web Share der WebView2), sonst
  // der Adapterweg (Datei im Explorer zeigen). Eine Zustellung wird nie bestätigt.
  const systemShare = typeof navigator.share === 'function' ? navigator.share.bind(navigator) : null;
  const systemCanShare = typeof navigator.canShare === 'function' ? navigator.canShare.bind(navigator) : null;
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.dataset.wfpHost = 'windows';
    const adapterShare = navigator.share, adapterCanShare = navigator.canShare;
    if (!systemShare || typeof adapterShare !== 'function') return;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => Boolean(systemCanShare?.(data)) || Boolean(adapterCanShare?.(data)) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      if (!systemCanShare || systemCanShare(data)) {
        try { return await systemShare(data); }
        catch (error) { if (error?.name === 'AbortError') throw error; }
      }
      return adapterShare(data);
    } });
  });
})();
