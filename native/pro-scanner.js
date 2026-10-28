/* Scanner und Kamera für die Pro-Apps unter Windows (Pro-Umbau 5, Klaus 2026-10-28: „Es sind aber Scanner angeschlossen …
   diese Scanner können ausgewählt werden … es kann auch sein, dass welche mit Kamera scannen“).
   Quelle: Workflow PDF Pro (native/pro-scanner.js/.css), byte-gleich nach BookLedgerPro (und später Private Brain Pro),
   gepinnt in native/pro-scanner-herkunft.json. Nie in den Kopien ändern.

   - Scanner: alles, was Windows über WIA kennt (USB, WLAN/Netz, treiberlos). Die Hülle stellt das Plugin ProScanner
     (geraete, scannen) bereit — Rust-Baustein windows/scanner/scanner.rs, gleich in jeder Hülle.
   - Kamera: Webcam oder angeschlossene Kamera als Livebild (getUserMedia), Aufnahme je Seite.
   - Die Bilder gehen in den unveränderten Scanner-Kern von Workflow PDF (WFP.Scanner.hinzu): Blatt finden, entzerren, PDF.
   Ohne Plugin ProScanner (Android, PWA) tut die Datei nichts.

   ProScanner.waehlen() → Promise<File[]>   ProScanner.einhaengen()  hängt „Scanner oder Kamera …“ ins Scan-Fenster. */
(() => {
  'use strict';
  if (window.ProScanner) return;
  const FASSUNG = 1, MERK = 'pro-scanner-wahl-v1';
  const plugin = () => window.Capacitor?.Plugins?.ProScanner || null;
  const verfuegbar = () => !!plugin();
  const T = {
    de: { titel: 'Scanner oder Kamera', suche: 'Geräte werden gesucht …', keine: 'Kein Scanner gefunden. Ist er eingeschaltet und in Windows eingerichtet (Einstellungen → Bluetooth und Geräte → Drucker und Scanner)?',
      scanner: 'Scanner', kamera: 'Kamera', vorlage: 'Vorlage', glas: 'Glas', einzug: 'Einzug', aufloesung: 'Auflösung', farbe: 'Farbe', farbig: 'Farbe', grau: 'Grau', sw: 'Schwarzweiß',
      scannen: 'Scannen', laeuft: 'Scanner läuft – bitte warten …', abbrechen: 'Abbrechen', fertig: 'Fertig', aufnehmen: 'Seite aufnehmen', seiten: 'Seiten', neu: 'Neu suchen',
      fehler: 'Scannen ging nicht', keinPapier: 'Im Einzug liegt kein Papier.', besetzt: 'Der Scanner ist gerade beschäftigt.', weg: 'Der Scanner antwortet nicht. Ist er eingeschaltet?',
      kameraNein: 'Die Kamera ließ sich nicht öffnen (keine Kamera oder keine Erlaubnis).', knopfScanner: 'Scanner oder Kamera …', wlan: 'Netz', usb: 'USB', fotos: 'Fotos holen' },
    en: { titel: 'Scanner or camera', suche: 'Looking for devices …', keine: 'No scanner found. Is it switched on and set up in Windows (Settings → Bluetooth & devices → Printers & scanners)?',
      scanner: 'Scanner', kamera: 'Camera', vorlage: 'Source', glas: 'Flatbed', einzug: 'Feeder', aufloesung: 'Resolution', farbe: 'Colour', farbig: 'Colour', grau: 'Grey', sw: 'Black and white',
      scannen: 'Scan', laeuft: 'Scanning – please wait …', abbrechen: 'Cancel', fertig: 'Done', aufnehmen: 'Capture page', seiten: 'pages', neu: 'Search again',
      fehler: 'Scanning failed', keinPapier: 'The feeder is empty.', besetzt: 'The scanner is busy.', weg: 'The scanner does not respond. Is it switched on?',
      kameraNein: 'The camera could not be opened (no camera or no permission).', knopfScanner: 'Scanner or camera …', wlan: 'network', usb: 'USB', fotos: 'Get photos' },
  };
  const w = () => T[(document.documentElement.lang || 'de').slice(0, 2)] || T.de;
  const merkLesen = () => { try { return JSON.parse(localStorage.getItem(MERK) || '{}') || {}; } catch { return {}; } };
  const merkSchreiben = (v) => { try { localStorage.setItem(MERK, JSON.stringify(v)); } catch { /* nur Bequemlichkeit */ } };
  const el = (tag, attrs = {}, kinder = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
    for (const k of [].concat(kinder)) if (k) e.append(k);
    return e;
  };
  const fehlerText = (code) => ({ SCANNER_KEIN_PAPIER: w().keinPapier, SCANNER_BESCHAEFTIGT: w().besetzt, SCANNER_WEG: w().weg, SCANNER_FEHLT: w().weg }[code] || w().fehler + ' (' + code + ')');
  function bytes(b64) { const s = atob(b64 || ''), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

  /** Alle Geräte: Scanner aus WIA (Hülle) und Kameras des Browsers. */
  async function geraete() {
    const liste = [];
    const p = plugin();
    if (p) {
      try { for (const g of (await p.geraete()).geraete || []) liste.push({ id: 'wia:' + g.id, wia: g.id, name: g.name || 'Scanner', art: g.art === 'kamera' ? 'wiakamera' : 'scanner', einzug: !!g.einzug, glas: g.glas !== false, verbindung: g.verbindung || '' }); }
      catch { /* keine WIA-Geräte: dann nur Kameras */ }
    }
    if (navigator.mediaDevices?.enumerateDevices) {
      try {
        let n = 0;
        for (const d of await navigator.mediaDevices.enumerateDevices()) if (d.kind === 'videoinput') liste.push({ id: 'cam:' + (d.deviceId || n), cam: d.deviceId, name: d.label || (w().kamera + ' ' + (++n)), art: 'kamera' });
      } catch { /* ohne Kameraliste */ }
    }
    return liste;
  }

  /** WIA-Scan: liefert die Seiten als Dateien (Einzug: alle Blätter, Glas: eine Seite). */
  async function wiaScan(g, o) {
    const r = await plugin().scannen({ geraet: g.wia, quelle: o.quelle, dpi: o.dpi, farbe: o.farbe });
    const zeit = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    return (r.seiten || []).map((s, i) => new File([bytes(s.data)], 'Scan-' + zeit + '-' + String(i + 1).padStart(2, '0') + (s.mime === 'image/png' ? '.png' : '.jpg'), { type: s.mime || 'image/jpeg' }));
  }

  let offen = null;
  /** Auswahlfenster. Promise<File[]> (leer bei Abbrechen). */
  function waehlen() {
    if (offen) return offen;
    offen = new Promise((fertig) => {
      const merk = merkLesen();
      const zu = (dateien) => { stoppeKamera(); box.remove(); offen = null; fertig(dateien || []); };
      const liste = el('div', { class: 'pros-liste', role: 'radiogroup', 'aria-label': w().titel });
      const optionen = el('div', { class: 'pros-optionen' });
      const status = el('p', { class: 'pros-status', role: 'status', text: w().suche });
      const vorschau = el('div', { class: 'pros-vorschau', hidden: true });
      const aktion = el('div', { class: 'pros-aktion' });
      const box = el('div', { class: 'pros', role: 'dialog', 'aria-modal': 'true', 'aria-label': w().titel, 'data-pro-scanner': '' }, [
        el('div', { class: 'pros-kopf' }, [el('b', { text: w().titel }), el('button', { class: 'pros-knopf', type: 'button', 'data-pros-neu': '', text: w().neu, onclick: () => laden() })]),
        liste, optionen, vorschau, status, aktion]);
      box.addEventListener('keydown', (e) => { if (e.key === 'Escape') zu([]); });
      document.body.append(box);
      let alle = [], wahl = null, strom = null, aufnahmen = [];
      function stoppeKamera() { if (strom) { for (const t of strom.getTracks()) t.stop(); strom = null; } }
      function knopf(text, attrs, klick, haupt) { return el('button', { class: 'pros-knopf' + (haupt ? ' pros-haupt' : ''), type: 'button', ...attrs, text, onclick: klick }); }
      function auswahl(name, werte, jetzt, aendern) {
        return el('label', { class: 'pros-feld' }, [el('span', { text: name }), el('select', { 'data-pros-feld': name, onchange: (e) => aendern(e.target.value) },
          werte.map(([v, t]) => { const o = el('option', { value: v, text: t }); if (String(v) === String(jetzt)) o.selected = true; return o; }))]);
      }
      function zeigen() {
        liste.replaceChildren(...alle.map((g) => {
          const r = el('button', { type: 'button', role: 'radio', class: 'pros-geraet', 'aria-checked': String(wahl && wahl.id === g.id), 'data-pros-geraet': g.id, onclick: () => { wahl = g; merkSchreiben({ ...merkLesen(), geraet: g.id }); stoppeKamera(); zeigen(); } },
            [el('span', { class: 'pros-art', text: g.art === 'kamera' || g.art === 'wiakamera' ? w().kamera : w().scanner }), el('span', { class: 'pros-name', text: g.name }),
              g.verbindung ? el('span', { class: 'pros-verbindung', text: g.verbindung === 'netz' ? w().wlan : w().usb }) : null]);
          return r;
        }));
        optionen.replaceChildren(); vorschau.hidden = true; vorschau.replaceChildren(); aktion.replaceChildren();
        if (!wahl) { aktion.append(knopf(w().abbrechen, { 'data-pros-abbrechen': '' }, () => zu([]))); return; }
        status.textContent = '';
        if (wahl.art === 'scanner' || wahl.art === 'wiakamera') {
          const o = { quelle: merk.quelle === 'einzug' && wahl.einzug ? 'einzug' : 'glas', dpi: merk.dpi || 300, farbe: merk.farbe || 'farbe' };
          const setze = (k) => (v) => { o[k] = k === 'dpi' ? Number(v) : v; merkSchreiben({ ...merkLesen(), [k]: o[k] }); };
          if (wahl.art === 'scanner') {
            if (wahl.einzug && wahl.glas) optionen.append(auswahl(w().vorlage, [['glas', w().glas], ['einzug', w().einzug]], o.quelle, setze('quelle')));
            else o.quelle = wahl.einzug ? 'einzug' : 'glas';
            optionen.append(auswahl(w().aufloesung, [[150, '150 dpi'], [200, '200 dpi'], [300, '300 dpi'], [600, '600 dpi']], o.dpi, setze('dpi')));
            optionen.append(auswahl(w().farbe, [['farbe', w().farbig], ['grau', w().grau], ['sw', w().sw]], o.farbe, setze('farbe')));
          }
          const los = knopf(wahl.art === 'scanner' ? w().scannen : w().fotos, { 'data-pros-scannen': '' }, async () => {
            los.disabled = true; status.textContent = w().laeuft; box.setAttribute('aria-busy', 'true');
            try { const dateien = await wiaScan(wahl, o); zu(dateien); }
            catch (e) { status.textContent = fehlerText(e && (e.code || e.message)); los.disabled = false; }
            finally { box.removeAttribute('aria-busy'); }
          }, true);
          aktion.append(knopf(w().abbrechen, { 'data-pros-abbrechen': '' }, () => zu([])), los);
          return;
        }
        // Kamera: Livebild, je Tipp eine Seite.
        const video = el('video', { autoplay: true, playsinline: true, muted: true, 'data-pros-video': '' });
        const zahl = el('span', { class: 'pros-zahl', 'data-pros-zahl': '' });
        vorschau.hidden = false; vorschau.append(video, zahl);
        const auf = knopf(w().aufnehmen, { 'data-pros-aufnehmen': '', disabled: true }, async () => {
          if (!video.videoWidth) return;
          const c = el('canvas'); c.width = video.videoWidth; c.height = video.videoHeight; c.getContext('2d').drawImage(video, 0, 0);
          const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
          aufnahmen.push(new File([blob], 'Kamera-' + Date.now() + '.jpg', { type: 'image/jpeg' }));
          zahl.textContent = aufnahmen.length + ' ' + w().seiten; fertigK.disabled = false;
        }, true);
        const fertigK = knopf(w().fertig, { 'data-pros-fertig': '', disabled: !aufnahmen.length }, () => zu(aufnahmen));
        aktion.append(knopf(w().abbrechen, { 'data-pros-abbrechen': '' }, () => zu([])), fertigK, auf);
        navigator.mediaDevices.getUserMedia({ video: wahl.cam ? { deviceId: { exact: wahl.cam }, width: { ideal: 3840 }, height: { ideal: 2160 } } : { width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false })
          .then((s) => { strom = s; video.srcObject = s; auf.disabled = false; })
          .catch(() => { status.textContent = w().kameraNein; });
      }
      async function laden() {
        status.textContent = w().suche; liste.replaceChildren();
        alle = await geraete();
        wahl = alle.find((g) => g.id === merk.geraet) || alle.find((g) => g.art === 'scanner') || alle[0] || null;
        status.textContent = alle.some((g) => g.art === 'scanner') ? '' : w().keine;
        zeigen();
      }
      laden();
    });
    return offen;
  }

  /** Hängt „Scanner oder Kamera …“ ins Scan-Fenster des Kerns (leere Bühne und Leiste), solange es offen ist. */
  function einhaengen() {
    if (!verfuegbar() || einhaengen.aktiv) return;
    einhaengen.aktiv = true;
    const holen = async () => { const f = await waehlen(); if (f.length && window.WFP?.Scanner?.hinzu) await window.WFP.Scanner.hinzu(f); };
    const setzen = () => {
      for (const zeile of document.querySelectorAll('.scan .scan-leer .zeile, .scan .scan-leiste')) {
        if (zeile.querySelector('[data-pro-scanner-knopf]')) continue;
        zeile.prepend(el('button', { class: zeile.classList.contains('zeile') ? 'knopf' : 'knopf klein', type: 'button', 'data-pro-scanner-knopf': '', text: w().knopfScanner, onclick: holen }));
      }
    };
    new MutationObserver(setzen).observe(document.body, { childList: true, subtree: true });
    setzen();
  }

  window.ProScanner = Object.freeze({ FASSUNG, verfuegbar, geraete, waehlen, einhaengen });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', einhaengen, { once: true }); else einhaengen();
})();
