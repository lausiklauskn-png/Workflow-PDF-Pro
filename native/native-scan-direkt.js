/* Scanner-Direktstart aus einer anderen Pro-App (Pro-Umbau 5, Klaus 2026-10-28). BookLedgerPro startet Workflow PDF Pro mit
   dem Intent „de.familyprojekt.workflowpdf.pro.SCANNEN“ (Extra „von“); Android meldet ihn über WorkflowScanDirekt.
   Hier geht derselbe Weg wie in der PWA mit ?scan=1&von=…: der Kern (scanDirektstart) öffnet den Scanner, setzt
   „Durchsuchbar“ für diesen Scan und nennt den Rückweg (📤 Teilen → die App wählen). Kaltstart und laufende App gleich. */
(() => {
  'use strict';
  if (!window.Capacitor?.isNativePlatform?.()) return;
  const api = window.Capacitor?.Plugins?.WorkflowScanDirekt;
  if (!api || typeof api.offen !== 'function') return;
  let laeuft = false;
  const bereit = () => new Promise(res => { const t = () => (window.__wfpdf?.scanDirektstart && window.WFP?.Scanner) ? res() : setTimeout(t, 100); t(); });
  async function abholen() {
    if (laeuft) return; laeuft = true;
    try {
      const r = await api.offen();
      if (!r || !r.scan) return;
      await bereit();
      const von = String(r.von || '').slice(0, 40);
      // Ist schon ein Scanner offen, nicht noch einen darüber öffnen.
      if (document.querySelector('.scan')) return;
      history.replaceState(null, '', location.pathname + '?scan=1' + (von ? '&von=' + encodeURIComponent(von) : '') + location.hash);
      window.__wfpdf.scanDirektstart();
    } catch { /* ohne Anfrage nichts tun */ }
    finally { laeuft = false; }
  }
  try { api.addListener('scan', abholen); } catch { /* ältere Hülle ohne Ereignis */ }
  void abholen();
  window.WFPNativeScanDirekt = Object.freeze({ abholen });
})();
