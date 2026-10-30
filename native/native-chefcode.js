/* „Chefcode“ in Workflow PDF Pro (Pro-Umbau 13, Klaus 2026-10-30: „Ja, Schritt 1+2“, „Chef legt fest, alle 3“). Der Kasten ist der
   gemeinsame Baustein native/pro-chefcode.js (Quelle Private Brain Pro, byte-gleich); diese Datei setzt ihn nur in die Einstellungen
   des Kerns, unter die Knöpfe „Sicherung“ und „Tresor & Ablage“. Der Kern baut die Einstellungen bei jedem Öffnen neu — deshalb ein
   Beobachter, der den Kasten einsetzt, sobald der Dialog da ist. Das Netz selbst ist Modul 23 des Kerns (window.SbkimRendezvous). */
(() => {
  'use strict';
  if (window.WPPChefcode) return;
  function einsetzen() {
    if (!window.ProChefcode || !window.ProBedienung) return;
    const backup = document.getElementById('stSicherung');
    if (!backup || document.getElementById('wppChefcode')) return;
    const k = window.ProChefcode.kasten({ rdv: () => window.SbkimRendezvous || null });
    k.element.id = 'wppChefcode'; k.element.dataset.keinUe = '';
    backup.parentElement.after(k.element);
  }
  new MutationObserver(einsetzen).observe(document.documentElement, { childList: true, subtree: true });
  window.WPPChefcode = Object.freeze({ einsetzen });
})();
