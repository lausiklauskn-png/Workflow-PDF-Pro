/* Tipp-Schutz für Start-Knöpfe (Leitfaden § 3, Klaus 2026-10-28, Befund 9 aus Schritt E).
   Ein Start-Knopf reagiert nur auf einen Tipp, der AUF IHM begonnen hat. Auf Android landet der Klick nach dem Loslassen
   dort, wo der Finger jetzt ist — schließt sich beim Antippen ein Fenster oder rutscht die Liste (Auswahl-Leiste erscheint),
   träfe er den Knopf darunter. Tastatur (Enter, ohne Zeiger) bleibt erlaubt.

   Pro-Umbau 5 (2026-10-28): was diese Datei bis Umbau 4 sonst noch tat, kann der Kern (Workflow-PDF 1.1.4) selbst und ist
   hier entfernt — ohne Funktion zu verlieren:
   · Einordnen erst auf Knopfdruck (früher: SbkimEmbedding.embedPassageBatch angehalten) → Kern: bedeutungStarten({einordnen:false}),
     Knopf „Einordnen“ in der Arbeitsleiste, für die Auswahl oder „Alle N?“.
   · „Alle prüfen“ fragt, „Prüfen“ für die Auswahl (früher: Klick abgefangen, eigener Knopf in der Auswahl-Leiste) → Kern: „Prüfen“.
   · Bildbeschreibung erst auf „Beschreiben“ (früher: WFP.Bild.start umhüllt) → Kern: Zustand „wartet“.
   · Hintergrundaufgabe (früher: ein Blick je Sekunde auf den Kern) → Kern meldet sich selbst bei window.ProHintergrund an. */
(() => {
  'use strict';
  if (!window.Capacitor?.isNativePlatform?.()) return;
  const START = '[data-pruef-alle-los],[data-einordnen],[data-bild-beschreiben],[data-bed-an],#siErstellen';
  let unten = null;
  document.addEventListener('pointerdown', e => { unten = { ziel: e.target, zeit: e.timeStamp }; }, true);
  document.addEventListener('click', e => {
    const k = e.target.closest?.(START); if (!k) return;
    if (e.detail === 0) return;                          // Tastatur oder programmatisch: kein Zeiger
    if (unten && k.contains(unten.ziel)) return;         // der Tipp begann auf diesem Knopf
    e.preventDefault(); e.stopImmediatePropagation();
    k.dataset.wppTippVerworfen = String(Number(k.dataset.wppTippVerworfen || 0) + 1);
  }, true);
  window.WFPNativeHintergrund = Object.freeze({ START });
})();
