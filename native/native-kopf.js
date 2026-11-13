/* Kopfleiste nach Leitfaden § 1.7/1.8 (Klaus 2026-10-29, Pro-Umbau 12 für Workflow PDF Pro, wie BookLedgerPro 0.1.5):
   • Schriftgröße „A··A“ vor dem Zahnrad (gemeinsamer Baustein ProBedienung.schriftKnopf, 85–150 %, gemerkt, nur die Schrift wächst);
   • die Version klein neben dem Namen („v1.0.10“); ein Tipp prüft auf Updates und lädt ein neues gleich (nur in der App, Klaus 2026-11-13:
     nicht mehr die Einstellungen – dafür ist das Zahnrad da).
   Der Kern (upstream/) bleibt unverändert; die Nummer kommt aus <meta name="wfp-version">, das native-bootstrap.js füllt. */
(() => {
  'use strict';
  if (window.WPPKopf) return;
  const marke = () => document.querySelector('header.kopf .marke');
  function schrift() {
    const einst = document.getElementById('btnEinst');
    if (!einst || !window.ProBedienung?.schriftKnopf || document.querySelector('header.kopf .pro-schrift')) return;
    einst.before(window.ProBedienung.schriftKnopf());
  }
  function version() {
    const m = marke(), meta = document.querySelector('meta[name="wfp-version"]');
    const v = (String(meta?.content || '').match(/^\d+\.\d+\.\d+/) || [''])[0];
    if (!m || !v) return;
    let b = document.getElementById('wppKopfVersion');
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.id = 'wppKopfVersion'; b.className = 'wpp-kopf-version'; b.dataset.keinUe = '';
      b.addEventListener('click', () => {
        if (window.WFPNativeUpdates?.direkt) { void window.WFPNativeUpdates.direkt(); return; }
        document.getElementById('btnEinst')?.click();   // ohne Updateprüfung (ältere Hülle): wie bisher
      });
      const name = m.querySelector('.marke-name'); (name || m).after(b);
    }
    b.textContent = 'v' + v;
    b.title = window.ProBedienung ? window.ProBedienung.wort('version', { v }) : 'Version ' + v;
    b.setAttribute('aria-label', b.title);
  }
  function los() { schrift(); version(); }
  document.addEventListener('wfp-version', version);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los, { once: true }); else los();
  window.WPPKopf = Object.freeze({ version, schrift });
})();
