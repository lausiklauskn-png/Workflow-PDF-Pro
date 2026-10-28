/* Workflow PDF Pro. Platform adapters are separate from the pinned upstream core. */
(() => {
  'use strict';
  if (!window.Capacitor?.isNativePlatform?.()) return;
  document.documentElement.dataset.wfpNative = 'android';
  window.WFPNative = Object.freeze({
    appId: 'de.familyprojekt.workflowpdf.pro',
    sourceCommit: '19374781441b21a020e79886d1ad813637969c98'
  });
  /* Versionsnummer (Klaus 2026-10-22): der Kern zeigt, was in <meta name="wfp-version"> steht, im Fuß
     und in den Einstellungen. Die Pro trägt dort ihre App-Nummer ein — unter Android aus dem Paket
     (versionName), unter Windows aus Tauri. Bis die Antwort da ist, steht keine Nummer da (prepare-web
     leert das Meta), nie die Nummer der Webversion. */
  const files = window.Capacitor?.Plugins?.WorkflowFiles;
  if (typeof files?.appInfo === 'function') files.appInfo().then(info => {
    // Prüf-Builds tragen „-debug" am Ende; angezeigt wird nur die Nummer selbst.
    const version = (String(info?.version || '').match(/^\d+\.\d+\.\d+/) || [''])[0];
    const meta = document.querySelector('meta[name="wfp-version"]');
    if (!meta || !version) return;
    meta.content = version;
    document.dispatchEvent(new Event('wfp-version'));
  }).catch(() => {});
})();
