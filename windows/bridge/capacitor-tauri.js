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
  const Plugins = Object.freeze({
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
