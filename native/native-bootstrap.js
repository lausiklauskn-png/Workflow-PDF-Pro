/* Workflow PDF Pro. Platform adapters are separate from the pinned upstream core. */
(() => {
  'use strict';
  if (!window.Capacitor?.isNativePlatform?.()) return;
  document.documentElement.dataset.wfpNative = 'android';
  window.WFPNative = Object.freeze({
    appId: 'de.familyprojekt.workflowpdf.pro',
    sourceCommit: '7227c543d4a536cf8f3354a56fbba7574645703e'
  });
})();
