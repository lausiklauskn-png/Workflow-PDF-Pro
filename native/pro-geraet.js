/* Gerätecheck vor dem Laden eines Modells (Klaus 2026-10-28: „es wird gecheckt, … der Computer, wie stark er ist, was er
   leisten kann, und danach wird das Modell ausgesucht“; Plan 2026-10-27 „Erst messen, dann vorschlagen“).
   Gemeinsamer Baustein aller Pro-Apps (Quelle Private Brain Pro, byte-gleich kopiert, Pin pro-bedienung-herkunft.json).

   Misst auf genau diesem Gerät: Arbeitsspeicher, Prozessor und Kerne, Grafik (Name und Speicher, wo lesbar), freien Platz und eine
   kurze Rechenprobe. Daraus folgt eine Stufe „Klein / Mittel / Groß“ und je Modell „passt / knapp / nicht empfohlen“.
   Die Werte bleiben auf dem Gerät (nur hier gemerkt, ohne Namen der Person, nichts geht ins Netz).
   Native Werte kommen aus ProDevice.measure (Windows-Engine: CIM über PowerShell; Android: ActivityManager/StatFs);
   ohne Brücke (PWA) misst die Seite, was der Browser verrät, und sagt ehrlich, was fehlt. */
(() => {
  'use strict';
  if (window.ProGeraet) return;
  const FASSUNG = 1, MERK = 'pro_geraet_v1', GB = 1073741824, MB = 1048576;
  const SPRACHEN = ['de', 'en', 'ru', 'pl', 'ar'];
  const W = {
    stufe:     ['Stufe {s}', 'Level {s}', 'Уровень {s}', 'Poziom {s}', 'المستوى {s}'],
    klein:     ['Klein', 'Small', 'Малый', 'Mały', 'صغير'],
    mittel:    ['Mittel', 'Medium', 'Средний', 'Średni', 'متوسط'],
    gross:     ['Groß', 'Large', 'Большой', 'Duży', 'كبير'],
    ram:       ['{n} GB Arbeitsspeicher', '{n} GB memory', '{n} ГБ ОЗУ', '{n} GB pamięci', '{n} غيغابايت ذاكرة'],
    ramMind:   ['mindestens {n} GB Arbeitsspeicher', 'at least {n} GB memory', 'не менее {n} ГБ ОЗУ', 'co najmniej {n} GB pamięci', '{n} غيغابايت ذاكرة على الأقل'],
    kerne:     ['{n} Kerne', '{n} cores', 'ядер: {n}', '{n} rdzeni', '{n} أنوية'],
    grafik:    ['Grafik {name}', 'Graphics {name}', 'Графика {name}', 'Grafika {name}', 'الرسوميات {name}'],
    vram:      [' ({n} GB)', ' ({n} GB)', ' ({n} ГБ)', ' ({n} GB)', ' ({n} غيغابايت)'],
    frei:      ['{n} GB frei', '{n} GB free', 'свободно {n} ГБ', '{n} GB wolne', '{n} غيغابايت متاحة'],
    unbekannt: ['Arbeitsspeicher nicht lesbar', 'Memory not readable', 'ОЗУ не определяется', 'Pamięć nieczytelna', 'الذاكرة غير مقروءة'],
    passt:     ['passt', 'fits', 'подходит', 'pasuje', 'مناسب'],
    knapp:     ['knapp', 'tight', 'на пределе', 'na granicy', 'محدود'],
    nein:      ['nicht empfohlen', 'not recommended', 'не рекомендуется', 'niezalecane', 'غير موصى به'],
    geplant:   ['noch nicht eingebaut', 'not built yet', 'ещё не встроено', 'jeszcze nie wbudowane', 'غير مدمج بعد'],
    satz:      ['Dieser Rechner: {werte} – {stufe}. {modell} ({mb} MB, Spitze ≈ {spitze}): {urteil}.', 'This computer: {werte} – {stufe}. {modell} ({mb} MB, peak ≈ {spitze}): {urteil}.', 'Этот компьютер: {werte} – {stufe}. {modell} ({mb} МБ, пик ≈ {spitze}): {urteil}.', 'Ten komputer: {werte} – {stufe}. {modell} ({mb} MB, szczyt ≈ {spitze}): {urteil}.', 'هذا الجهاز: {werte} – {stufe}. {modell} ({mb} ميغابايت، الذروة ≈ {spitze}): {urteil}.'],
    trotzdem:  ['Trotzdem laden?', 'Load anyway?', 'Всё равно загрузить?', 'Mimo to pobrać?', 'التحميل رغم ذلك؟']
  };
  const sprache = () => Math.max(0, SPRACHEN.indexOf(String(document.documentElement.lang || 'de').slice(0, 2).toLowerCase()));
  const t = (k, v = {}) => String((W[k] || [k])[sprache()] || W[k][0]).replace(/\{(\w+)\}/g, (_, x) => (x in v ? String(v[x]) : ''));
  const zahl = (n, st = 0) => (Math.round(n * 10 ** st) / 10 ** st).toLocaleString(document.documentElement.lang || 'de');

  // Modelle, für die gemessen wird. „ab“ = kleinste Stufe, auf der es empfohlen ist; Spitze = gemessener Arbeitsspeicher beim Laden.
  // Größen gemessen bzw. aus den festen Fingerabdruck-Listen (semantic-model.json, caption-model.json); Diktat/KI sind Plan (2026-10-27).
  const MODELLE = {
    bedeutung: { name: 'Bedeutungssuche (multilingual-e5-small)', mb: 118, spitzeMB: 600, ab: 0 },
    bild:      { name: 'Bildbeschreibung (vit-gpt2)', mb: 256, spitzeMB: 1217, ab: 1 },
    // Zweites Bedeutungs-Modell nur für die Suche in der App (gemessen 2026-10-28, Lauf 40758382311, Renderer-Spitze).
    bedeutungMittel: { name: 'Bedeutungssuche größer (multilingual-e5-base)', mb: 282, spitzeMB: 1332, ab: 1 },
    bedeutungGross:  { name: 'Bedeutungssuche groß (multilingual-e5-large)', mb: 552, spitzeMB: 2252, ab: 2 },
    diktatKlein: { name: 'Diktat Whisper base', mb: 150, spitzeMB: 500, ab: 0, geplant: true },
    diktatMittel: { name: 'Diktat Whisper small', mb: 470, spitzeMB: 1200, ab: 1, geplant: true },
    diktatGross: { name: 'Diktat Whisper large-v3-turbo', mb: 1600, spitzeMB: 3500, ab: 2, geplant: true },
    kiKlein:   { name: 'Lokale KI 1,5B (Q4)', mb: 1100, spitzeMB: 2500, ab: 0, geplant: true },
    kiMittel:  { name: 'Lokale KI 3B (Q4)', mb: 2000, spitzeMB: 4000, ab: 1, geplant: true },
    kiGross:   { name: 'Lokale KI 7B (Q4)', mb: 4700, spitzeMB: 8000, ab: 2, geplant: true }
  };
  const STUFEN = ['klein', 'mittel', 'gross'];

  // Kurze Rechenprobe (≈ 50–300 ms): feste Rechnung, gemessen wird nur die Zeit.
  function rechenprobe() {
    const t0 = performance.now(); let x = 0;
    for (let i = 1; i < 4e6; i++) x += Math.sqrt(i) * 1.0001 / (i % 7 + 1);
    return { ms: Math.round(performance.now() - t0), x: x > 0 };
  }

  function stufeAus(m) {
    const ram = m.ramGB ?? m.ramMindGB ?? 0, kerne = m.kerne || 0;
    let s = ram && ram < 6 || kerne && kerne < 4 ? 0 : ram >= 16 && kerne >= 8 ? 2 : 1;
    if (!m.ramGB && !m.ramMindGB) s = Math.min(s, 1);              // ohne Speicherwert nie „Groß“
    if (m.probeMs > 600 && s > 0) s--;                             // sehr langsame Rechenprobe: eine Stufe tiefer
    return s;
  }

  async function messen({ neu = false } = {}) {
    if (!neu) { try { const alt = JSON.parse(localStorage.getItem(MERK) || 'null'); if (alt && Date.now() - alt.zeit < 30 * 864e5 && alt.fassung === FASSUNG) return alt; } catch { /* ohne Merken */ } }
    const m = { fassung: FASSUNG, zeit: Date.now(), quelle: 'browser', kerne: navigator.hardwareConcurrency || 0, gpu: [] };
    if (navigator.deviceMemory) m.ramMindGB = navigator.deviceMemory;           // Chrome deckelt bei 8 → „mindestens“
    const dev = window.Capacitor?.isNativePlatform?.() ? window.Capacitor?.Plugins?.ProDevice : null;
    if (typeof dev?.measure === 'function') {
      try {
        const n = await dev.measure();
        m.quelle = n.platform || 'nativ';
        if (n.ramBytes > 0) { m.ramGB = n.ramBytes / GB; delete m.ramMindGB; }
        if (n.cores > 0) m.kerne = n.cores;
        if (n.cpu) m.cpu = String(n.cpu).trim().slice(0, 80);
        if (Array.isArray(n.gpu)) m.gpu = n.gpu.map(g => ({ name: String(g.name || '').slice(0, 80), vramGB: g.vramBytes > 0 ? g.vramBytes / GB : null })).filter(g => g.name);
        if (n.freeBytes >= 0) m.freiGB = n.freeBytes / GB;
      } catch { /* Brücke ohne measure (ältere Hülle): Browserwerte */ }
    }
    if (m.freiGB == null && navigator.storage?.estimate) { try { const e = await navigator.storage.estimate(); if (e.quota) m.freiGB = Math.max(0, (e.quota - (e.usage || 0)) / GB); } catch { /* unbekannt */ } }
    if (navigator.gpu?.requestAdapter) { try { const a = await navigator.gpu.requestAdapter(); m.webgpu = !!a; } catch { m.webgpu = false; } }
    m.probeMs = rechenprobe().ms;
    m.stufe = STUFEN[stufeAus(m)];
    try { localStorage.setItem(MERK, JSON.stringify(m)); } catch { /* nur Komfort */ }
    return m;
  }

  function werteText(m) {
    const teile = [];
    if (m.ramGB) teile.push(t('ram', { n: zahl(m.ramGB) })); else if (m.ramMindGB) teile.push(t('ramMind', { n: zahl(m.ramMindGB) })); else teile.push(t('unbekannt'));
    if (m.kerne) teile.push(t('kerne', { n: m.kerne }));
    const g = (m.gpu || [])[0]; if (g) teile.push(t('grafik', { name: g.name }) + (g.vramGB ? t('vram', { n: zahl(g.vramGB, 1) }) : ''));
    if (m.freiGB != null) teile.push(t('frei', { n: zahl(m.freiGB) }));
    return teile.join(', ');
  }

  // Urteil für ein Modell: passt / knapp / nicht empfohlen (Stufe, Platz, Arbeitsspeicher in der Spitze).
  function urteil(m, art) {
    const mo = MODELLE[art]; if (!mo) return { stand: 'unbekannt' };
    if (mo.geplant) return { stand: 'geplant' };
    const s = STUFEN.indexOf(m.stufe), ram = m.ramGB ?? m.ramMindGB;
    if (m.freiGB != null && m.freiGB * 1024 < mo.mb * 1.5) return { stand: 'nein', grund: 'platz' };
    if (s < mo.ab) return { stand: ram && ram * 1024 >= mo.spitzeMB * 2 ? 'knapp' : 'nein', grund: 'stufe' };
    if (ram && ram * 1024 < mo.spitzeMB * 2.5) return { stand: 'knapp', grund: 'speicher' };
    return { stand: 'passt' };
  }

  function satz(m, art) {
    const mo = MODELLE[art], u = urteil(m, art);
    const spitze = mo.spitzeMB >= 1024 ? zahl(mo.spitzeMB / 1024, 1) + ' GB' : mo.spitzeMB + ' MB';
    return t('satz', { werte: werteText(m), stufe: t('stufe', { s: t(m.stufe) }), modell: mo.name, mb: mo.mb, spitze, urteil: t(u.stand === 'geplant' ? 'geplant' : u.stand) });
  }

  // Vor dem Laden: messen (gemerkt bis 30 Tage), Satz zeigen; bei „nicht empfohlen“ ausdrücklich nachfragen.
  async function vorDemLaden(art, { fragen = window.confirm.bind(window) } = {}) {
    const m = await messen(), u = urteil(m, art), s = satz(m, art);
    if (u.stand === 'nein' && !fragen(s + '\n\n' + t('trotzdem'))) return { weiter: false, satz: s, messung: m, urteil: u };
    return { weiter: true, satz: s, messung: m, urteil: u };
  }

  // Übersicht für ⓘ / Einstellungen: alle Modelle mit Urteil.
  function uebersicht(m) {
    return Object.keys(MODELLE).map(art => ({ art, name: MODELLE[art].name, mb: MODELLE[art].mb, ...urteil(m, art), text: t(urteil(m, art).stand) }));
  }

  window.ProGeraet = Object.freeze({ FASSUNG, MODELLE, messen, werteText, urteil, satz, vorDemLaden, uebersicht, stufeAus, wort: t });
})();
