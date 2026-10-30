/* „Überall suchen“ in Workflow PDF Pro (Pro-Umbau 12, Klaus m7 2026-10-30). Der Kasten ist der gemeinsame Baustein
   native/pro-ueberall.js (gepflegt in Private Brain Pro, hier byte-gleich, Pin native/pro-bedienung-herkunft.json); diese Datei sagt nur,
   was Workflow PDF Pro dazugibt:
   • diese App: Wortsuche über die Bibliothek (Name, Ordner, Seitentext) — dieselbe Frage wie im Suchfeld der Bibliothek
   • Tresorordner: die Fächer der anderen Pro-Apps über WorkflowVault.tresorFach (nur in der Android-App, nur bei offenem Tresorordner);
     das eigene Fach „Workflow PDF Pro“ nicht, das ist ja die Bibliothek
   • Netz: Modul 23 des Kerns (window.SbkimRendezvous, byte-1:1) — nur mit Haken
   Ein Tipp auf eine Zeile der Bibliothek öffnet das Dokument wie seine Karte. Der Kern (upstream/) bleibt unverändert. */
(() => {
  'use strict';
  if (window.WPPUeberall) return;
  const TEXT_MAX = 8000;
  const api = () => window.Capacitor?.Plugins?.WorkflowVault;
  const ort = () => window.WFPNativeVault?.aktiv?.()?.location || null;
  function tresor() {
    const a = api();
    if (!a || typeof a.tresorFach !== 'function' || typeof a.tresorZustand !== 'function') return null;
    return {
      zustand: async () => { const z = await a.tresorZustand({ location: ort() }); return { gewaehlt: !!z.gewaehlt, offen: !!z.offen }; },
      fach: fach => a.tresorFach({ fach })
    };
  }
  /* Seitentext (texte: Seiten → [Wort, x, y, b, h]) zu einem Suchtext, gekappt. */
  function seitenText(seiten) {
    let s = '';
    for (const items of Array.isArray(seiten) ? seiten : []) {
      for (const item of Array.isArray(items) ? items : []) { const w = Array.isArray(item) ? item[0] : item?.str; if (typeof w === 'string') s += w + ' '; }
      if (s.length > TEXT_MAX) break;
    }
    return s.replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX);
  }
  async function appSuchen(frage) {
    const DB = window.WFP?.DB;
    if (!DB || typeof DB.all !== 'function') return [];
    const ordner = new Map(); try { for (const f of await DB.all('folders')) if (f && f.id) ordner.set(f.id, f.name || ''); } catch { /* ohne Ordnernamen */ }
    const docs = [];
    for (const d of await DB.all('docs').catch(() => [])) {
      if (!d || typeof d.id !== 'string') continue;
      let text = ''; try { text = seitenText((await DB.get('texte', d.id))?.seiten); } catch { /* ohne Seitentext */ }
      docs.push({ ...d, _ordner: ordner.get(d.folderId) || '', _text: text });
    }
    return window.ProUeberall.listeSuchen(docs, frage, { herkunft: 'app', typ: 'dokument',
      text: d => [d.name, d._ordner, d._text].filter(Boolean).join(' · '), name: d => d.name || d.id, id: d => d.id });
  }
  function oeffnen(z) {
    const k = document.querySelector('#dokGitter .dok[data-id="' + CSS.escape(String(z.id)) + '"] [data-auf]');
    if (k) { k.click(); return; }
    // Karte gerade nicht im Bild (anderer Ordner, Filter): die Bibliothek nach dem Namen filtern, dann steht sie da.
    const feld = document.getElementById('bibSuche'), form = document.getElementById('bibForm');
    if (feld && form) { feld.value = z.name || ''; form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); }
  }
  function einsetzen() {
    if (!window.ProUeberall || !window.ProBedienung) return false;
    const form = document.getElementById('bibForm');
    if (!form) return false;
    if (document.getElementById('wppUeberall')) return true;
    const k = window.ProUeberall.kasten({
      appName: 'Workflow PDF Pro', eigenesFeld: false, frage: () => document.getElementById('bibSuche')?.value || '',
      app: appSuchen, tresor, tresorOhne: ['workflow-pdf-pro'], netz: () => window.SbkimRendezvous || null,
      mycelOeffnen: () => { try { window.SbkimRendezvousUI?.show?.(); } catch { /* fail-soft */ } },
      kannOeffnen: z => z.herkunft === 'app', oeffnen
    });
    k.element.id = 'wppUeberall'; k.element.dataset.keinUe = '';
    const nach = document.getElementById('bedeutungLeiste') || form;
    nach.after(k.element);
    window.WPPUeberall = { element: k.element, suchen: k.suchen };
    return true;
  }
  if (!einsetzen()) document.addEventListener('DOMContentLoaded', einsetzen, { once: true });
})();
