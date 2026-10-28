/* Hintergrundaufgabe aller Pro-Apps (Leitfaden § 3: „Prüfen, Einordnen, Sichern laufen im Hintergrund … in der
   Android-App als native Hintergrundaufgabe“). Quelle: Private Brain Pro (native/pro-hintergrund.js), byte-gleich
   kopiert nach Workflow PDF Pro und BookLedgerPro, gepinnt mit den Bedien-Bausteinen (pro-bedienung-herkunft.json).

   Gerechnet wird weiter in der Seite. Solange eine Aufgabe läuft, hält der Android-Dienst ProHintergrundDienst die App
   am Leben (Mitteilung „Läuft im Hintergrund“ mit Stand und „Abbrechen“) und die WebView behält ihre Priorität.
   Ohne Android-Brücke (PWA, Windows, Probe) läuft dieselbe Arbeit einfach so — nichts wird vorgetäuscht:
   `aufgabe.geschuetzt` sagt, ob der Dienst wirklich steht.

   const a = await ProHintergrund.beginnen({ art: 'sichern', titel: 'Sicherung läuft' });
   a.stand('Dokument 3 von 40', 3, 40); if (a.signal.aborted) …; a.ende();
   oder: await ProHintergrund.lauf({ art, titel }, async a => { … }); */
(() => {
  'use strict';
  if (window.ProHintergrund) return;
  const FASSUNG = 1;
  const plugin = () => window.Capacitor?.isNativePlatform?.() ? window.Capacitor?.Plugins?.ProHintergrund : null;
  const laufend = new Map();
  let zaehler = 0, gefragt = false, hoerer = null;

  function zuhoeren(p) {
    if (hoerer || typeof p?.addListener !== 'function') return;
    hoerer = p.addListener('abbruch', e => {
      const a = laufend.get(e?.id); if (!a) return;
      a.grund = e?.grund || 'mitteilung'; a._abbruch.abort(a.grund);
    });
  }

  // Beim Laden der Seite: eine frühere Seite (neu geladen) kann kein Ende mehr melden.
  try { const p = plugin(); if (p?.aufraeumen) p.aufraeumen().catch(() => {}); zuhoeren(p); } catch { /* ohne Brücke */ }

  async function beginnen({ art = 'arbeit', titel = '', text = '' } = {}) {
    const p = plugin(), id = art + '-' + Date.now().toString(36) + '-' + (++zaehler);
    const abbruch = new AbortController();
    let letzte = 0, offen = null, beendet = false;
    const a = {
      id, art, signal: abbruch.signal, _abbruch: abbruch, geschuetzt: false, grund: '',
      // Stand höchstens einmal je Sekunde an Android (die Mitteilung flackert sonst); der letzte gewinnt.
      stand(t = '', i = 0, n = 0) {
        if (beendet || !p) return;
        const senden = () => { offen = null; letzte = Date.now(); p.stand({ id, text: String(t || ''), i: Math.max(0, i | 0), n: Math.max(0, n | 0) }).catch(() => {}); };
        if (offen) clearTimeout(offen);
        const warte = 1000 - (Date.now() - letzte);
        if (warte <= 0) senden(); else offen = setTimeout(senden, warte);
      },
      abbrechen(grund = 'seite') { a.grund = grund; abbruch.abort(grund); },
      ende() {
        if (beendet) return; beendet = true; laufend.delete(id); if (offen) clearTimeout(offen);
        if (p) p.ende({ id }).catch(() => {});
      }
    };
    laufend.set(id, a);
    if (p) {
      zuhoeren(p);
      // Nach der Mitteilung nur fragen, wenn die Aufgabe direkt aus einem Tipp kommt (nie ungefragt beim Start, nie in
      // Proben ohne Tipp). Ohne Erlaubnis läuft der Dienst trotzdem; Android zeigt ihn dann nur in der Aufgabenliste.
      if (!gefragt && navigator.userActivation?.isActive && typeof p.erlauben === 'function') { gefragt = true; try { await p.erlauben(); } catch { /* nein ist erlaubt */ } }
      try { a.geschuetzt = !!(await p.beginnen({ id, titel: String(titel || ''), text: String(text || '') }))?.geschuetzt; }
      catch { a.geschuetzt = false; }
    }
    return a;
  }

  async function lauf(angaben, arbeit) {
    const a = await beginnen(angaben);
    try { return await arbeit(a); } finally { a.ende(); }
  }

  window.ProHintergrund = Object.freeze({
    FASSUNG, beginnen, lauf,
    verfuegbar: () => !!plugin(),
    aktiv: () => laufend.size
  });
})();
