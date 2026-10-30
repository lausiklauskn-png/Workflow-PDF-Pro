/* Gemeinsame Bedien-Bausteine aller Pro-Apps (Leitfaden „Bedienung und Einstellungen der Pro-Apps“, Klaus 2026-10-28).
   Quelle: Private Brain Pro (native/pro-bedienung.js). Byte-gleich kopiert nach Workflow PDF Pro und BookLedgerPro
   (und jede künftige Pro-App) — nur hier ändern, dann dort nachziehen und den Pin erneuern.
   Keine Abhängigkeiten, kein Netz, kein Speicher außer dem Merken der ⓘ-Klapper (localStorage, nur Schlüssel → offen/zu) und der Schriftgröße.
   Inhalte (Texte der Fenster) bleiben app-eigen; hier stehen nur Form und die wenigen gemeinsamen Wörter. */
(() => {
  'use strict';
  if (window.ProBedienung) return;
  const FASSUNG = 5;
  const root = document.documentElement;
  // de en ru pl ar — jede App nutzt die Sprachen, die sie kennt; fehlt eine, gilt Deutsch.
  const WORTE = {
    zeigen:     ['Erklärung zeigen', 'Show explanation', 'Показать пояснение', 'Pokaż wyjaśnienie', 'إظهار الشرح'],
    verbergen:  ['Erklärung verbergen', 'Hide explanation', 'Скрыть пояснение', 'Ukryj wyjaśnienie', 'إخفاء الشرح'],
    laeuft:     ['läuft – du kannst weiterarbeiten', 'running – you can keep working', 'выполняется – можно продолжать работу', 'trwa – możesz dalej pracować', 'قيد التشغيل – يمكنك متابعة العمل'],
    nichtZu:    ['läuft – bitte nicht schließen', 'running – please do not close', 'выполняется – не закрывайте', 'trwa – proszę nie zamykać', 'قيد التشغيل – لا تغلق التطبيق'],
    fertig:     ['Fertig', 'Done', 'Готово', 'Gotowe', 'تم'],
    abgebrochen:['Abgebrochen', 'Cancelled', 'Отменено', 'Przerwano', 'أُلغي'],
    fehler:     ['Fehler', 'Error', 'Ошибка', 'Błąd', 'خطأ'],
    schritt:    ['Schritt {i} von {n}', 'Step {i} of {n}', 'Шаг {i} из {n}', 'Krok {i} z {n}', 'الخطوة {i} من {n}'],
    entsperrt:  ['Entsperrt', 'Unlocked', 'Разблокировано', 'Odblokowany', 'غير مقفل'],
    gesperrt:   ['Gesperrt', 'Locked', 'Заблокировано', 'Zablokowany', 'مقفل'],
    oeffnen:    ['In Dateien öffnen', 'Open in Files', 'Открыть в «Файлах»', 'Otwórz w Plikach', 'فتح في الملفات'],
    aktuell:    ['Du verwendest die aktuelle Version {v}.', 'You are using the current version {v}.', 'Используется актуальная версия {v}.', 'Używasz aktualnej wersji {v}.', 'أنت تستخدم الإصدار الحالي {v}.'],
    neu:        ['Neu: {n} (du hast {v})', 'New: {n} (you have {v})', 'Новая: {n} (у вас {v})', 'Nowa: {n} (masz {v})', 'جديد: {n} (لديك {v})'],
    version:    ['Version {v}', 'Version {v}', 'Версия {v}', 'Wersja {v}', 'الإصدار {v}'],
    schrift:    ['Schriftgröße', 'Text size', 'Размер шрифта', 'Rozmiar tekstu', 'حجم الخط'],
    schrift100: ['Zurück auf 100 %', 'Back to 100 %', 'Вернуть 100 %', 'Wróć do 100 %', 'العودة إلى 100 %']
  };
  const SPRACHEN = ['de', 'en', 'ru', 'pl', 'ar'];
  const sprache = () => Math.max(0, SPRACHEN.indexOf(String(root.lang || 'de').slice(0, 2).toLowerCase()));
  function wort(schluessel, werte = {}) {
    const zeile = WORTE[schluessel]; if (!zeile) return '';
    return String(zeile[sprache()] || zeile[0]).replace(/\{(\w+)\}/g, (_, k) => (k in werte ? String(werte[k]) : ''));
  }
  function el(tag, klasse, text) { const n = document.createElement(tag); if (klasse) n.className = klasse; if (text != null) n.textContent = text; return n; }
  const SVG = 'http://www.w3.org/2000/svg';
  function strich(pfade) {
    const s = document.createElementNS(SVG, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    for (const d of pfade) { const p = document.createElementNS(SVG, d.startsWith('c:') ? 'circle' : 'path');
      if (d.startsWith('c:')) { const [cx, cy, r] = d.slice(2).split(','); p.setAttribute('cx', cx); p.setAttribute('cy', cy); p.setAttribute('r', r); } else p.setAttribute('d', d); s.append(p); }
    return s;
  }

  // ---------- Knopf: flach, 28–32 px; „haupt“ = der eine farbige nächste Schritt eines Fensters ----------
  function knopf(text, { haupt = false, beiTipp = null, titel = '', name = '' } = {}) {
    const b = el('button', 'pro-knopf', text); b.type = 'button';
    if (haupt) b.dataset.proHaupt = '';
    if (name) b.dataset.proKnopf = name;
    if (titel) b.title = titel;
    if (beiTipp) b.addEventListener('click', beiTipp);
    return b;
  }
  // Höchstens ein farbiger Knopf je Fenster: der zuletzt gesetzte gewinnt, die anderen werden ruhig.
  function hauptSetzen(fenster, k) {
    for (const b of fenster.querySelectorAll('.pro-knopf[data-pro-haupt]')) if (b !== k) delete b.dataset.proHaupt;
    if (k) k.dataset.proHaupt = '';
  }

  // ---------- ⓘ-Klapper: zugeklappt, Zustand gemerkt ----------
  const MERK = 'pro_bedienung_info_v1';
  let gemerkt = {};
  try { const v = JSON.parse(localStorage.getItem(MERK) || 'null'); if (v && typeof v === 'object') gemerkt = v; } catch { /* privat/gesperrt: dann eben ohne Merken */ }
  const merken = (k, offen) => { gemerkt[k] = !!offen; try { localStorage.setItem(MERK, JSON.stringify(gemerkt)); } catch { /* nur Komfort */ } };
  let zaehler = 0;
  function info(schluessel, inhalt) {
    const k = String(schluessel);
    const b = el('button', 'pro-info'); b.type = 'button'; b.dataset.proInfo = k;
    b.append(strich(['c:12,12,9', 'M12 10v7', 'M12 7v.01']));
    const box = el('div', 'pro-info-inhalt'); box.id = 'pro-info-' + k.replace(/[^\w-]/g, '_') + '-' + (++zaehler);
    box.dataset.proInfoInhalt = k;
    if (typeof inhalt === 'string') box.append(el('p', null, inhalt)); else if (inhalt) box.append(inhalt);
    b.setAttribute('aria-controls', box.id);
    const setzen = offen => { box.hidden = !offen; b.setAttribute('aria-expanded', String(offen)); b.title = wort(offen ? 'verbergen' : 'zeigen'); b.setAttribute('aria-label', b.title); };
    setzen(gemerkt[k] === true); // Vorgabe zu (Leitfaden § 1.2)
    b.addEventListener('click', () => { const offen = box.hidden; setzen(offen); merken(k, offen); });
    return { knopf: b, inhalt: box, setzen };
  }

  // ---------- Kasten: Überschrift + ⓘ + Inhalt (ein Fenster/Abschnitt der Einstellungen) ----------
  function kasten(schluessel, titel, { erklaerung = null } = {}) {
    const s = el('section', 'pro-kasten'); s.dataset.proKasten = schluessel;
    const kopf = el('div', 'pro-kasten-kopf'), h = el('h3', null, titel); kopf.append(h);
    s.append(kopf);
    let i = null;
    if (erklaerung) { i = info(schluessel, erklaerung); kopf.append(i.knopf); s.append(i.inhalt); }
    const rumpf = el('div', 'pro-kasten-rumpf'); s.append(rumpf);
    return { element: s, titel: h, rumpf, info: i };
  }

  // ---------- Zustand ● ----------
  function zustand(offen) {
    const z = el('span', 'pro-zustand'); z.dataset.proZustand = offen ? 'offen' : 'zu';
    z.append(el('span', 'pro-punkt'), document.createTextNode(wort(offen ? 'entsperrt' : 'gesperrt')));
    return z;
  }

  // ---------- Ordner: ganzer Pfad + „In Dateien öffnen“ (Leitfaden § 5) ----------
  function ordnerZeile(pfad, oeffnen) {
    const z = el('div', 'pro-ordner'); const p = el('span', 'pro-pfad', pfad || ''); p.title = pfad || ''; z.append(p);
    if (typeof oeffnen === 'function') z.append(knopf(wort('oeffnen'), { beiTipp: oeffnen, name: 'in-dateien' }));
    return z;
  }

  // ---------- Fortschritt: Drehkreis (ohne Zahl) oder Balken (mit Zahl), Ende Fertig/Abgebrochen ----------
  function fortschritt(host, { schliessbar = true, text = '' } = {}) {
    const f = el('div', 'pro-fortschritt'); f.setAttribute('role', 'status'); f.dataset.proFortschritt = 'laeuft';
    const kreis = el('span', 'pro-drehkreis'), balken = el('span', 'pro-balken'), fuell = el('span', 'pro-balken-fuell');
    balken.append(fuell); balken.hidden = true;
    const zeile = el('span', 'pro-fortschritt-text'), hinweis = el('span', 'pro-fortschritt-hinweis', wort(schliessbar ? 'laeuft' : 'nichtZu'));
    f.append(kreis, balken, zeile, hinweis); if (host) host.append(f);
    const textSetzen = t => { zeile.textContent = t || ''; };
    textSetzen(text);
    const ende = (stand, t) => { f.dataset.proFortschritt = stand; kreis.hidden = true; balken.hidden = stand !== 'fertig' || balken.hidden; hinweis.textContent = ''; textSetzen(t || wort(stand)); };
    return {
      element: f,
      schritt(i, n, t) {
        if (Number.isFinite(n) && n > 0) { balken.hidden = false; kreis.hidden = true; const q = Math.max(0, Math.min(1, i / n)); fuell.style.width = (q * 100).toFixed(1) + '%'; balken.setAttribute('aria-valuenow', String(Math.round(q * 100))); }
        textSetzen(t != null ? t : (Number.isFinite(n) ? wort('schritt', { i, n }) : ''));
      },
      fertig: t => ende('fertig', t), abgebrochen: t => ende('abgebrochen', t), fehler: t => ende('fehler', t)
    };
  }

  // ---------- Schriftgröße „A··A“ (Leitfaden § 1.8, Klaus 2026-10-29): 85–150 %, gemerkt, nur die Schrift wächst ----------
  // Die Apps setzen ihre Schriften in rem; Knöpfe haben feste Höhen in px und bleiben. Wirkt sofort beim Laden dieser Datei.
  const SCHRIFT = 'pro_schrift_v1', SCHRIFT_MIN = 85, SCHRIFT_MAX = 150;
  const schriftNormal = v => { const n = Math.round(Number(v) / 5) * 5; return Number.isFinite(n) && n ? Math.max(SCHRIFT_MIN, Math.min(SCHRIFT_MAX, n)) : 100; };
  function schriftSetzen(v, { merken: m = true } = {}) {
    const p = schriftNormal(v);
    root.style.fontSize = p === 100 ? '' : p + '%'; root.dataset.proSchrift = String(p);
    if (m) try { localStorage.setItem(SCHRIFT, String(p)); } catch { /* nur für diese Sitzung */ }
    return p;
  }
  let schriftJetzt = 100;
  try { schriftJetzt = schriftNormal(localStorage.getItem(SCHRIFT) || 100); } catch { /* Vorgabe */ }
  if (schriftJetzt !== 100) schriftSetzen(schriftJetzt, { merken: false });
  function schriftKnopf() {
    const huelle = el('span', 'pro-schrift'); huelle.dataset.proSchriftHuelle = '';
    const b = el('button', 'pro-schrift-knopf', 'A··A'); b.type = 'button'; b.dataset.proSchriftKnopf = '';
    b.title = wort('schrift'); b.setAttribute('aria-label', wort('schrift')); b.setAttribute('aria-expanded', 'false');
    const feld = el('div', 'pro-schrift-feld'); feld.hidden = true; feld.setAttribute('role', 'group'); feld.setAttribute('aria-label', wort('schrift'));
    const regler = el('input'); regler.type = 'range'; regler.min = String(SCHRIFT_MIN); regler.max = String(SCHRIFT_MAX); regler.step = '5';
    regler.setAttribute('aria-label', wort('schrift'));
    const zahl = el('span', 'pro-schrift-zahl');
    const zurueck = knopf(wort('schrift100'), { name: 'schrift-100' });
    const zeigen = () => { const p = schriftNormal(root.dataset.proSchrift || 100); regler.value = String(p); zahl.textContent = p + ' %'; zurueck.disabled = p === 100; };
    regler.addEventListener('input', () => { schriftSetzen(regler.value); zeigen(); });
    zurueck.addEventListener('click', () => { schriftSetzen(100); zeigen(); });
    const auf = offen => { feld.hidden = !offen; b.setAttribute('aria-expanded', String(offen)); if (offen) zeigen(); };
    b.addEventListener('click', ev => { ev.stopPropagation(); auf(feld.hidden); });
    document.addEventListener('click', ev => { if (!feld.hidden && !huelle.contains(ev.target)) auf(false); });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !feld.hidden) { auf(false); b.focus(); } });
    feld.append(regler, zahl, zurueck); huelle.append(b, feld);
    return huelle;
  }

  // ---------- Kleinigkeiten ----------
  const schritt = (i, n) => wort('schritt', { i, n });
  // Version bei „Über“ und „Auf Updates prüfen“ (Leitfaden § 6): ohne neue Version der Satz „aktuell“, sonst „Neu: …“.
  function versionSatz(aktuell, neu) { return neu && neu !== aktuell ? wort('neu', { n: neu, v: aktuell }) : wort('aktuell', { v: aktuell }); }
  // Öffentlicher Herausgeber-Schlüssel im Freischalt-Feld (Leitfaden § 6): 64 Hex-Zeichen ohne Code-Kopf.
  const istOeffentlicherSchluessel = (text, schluessel = []) => {
    const t = String(text || '').trim().toLowerCase();
    return /^[0-9a-f]{64}$/.test(t) && (!schluessel.length || schluessel.map(s => String(s).toLowerCase()).includes(t));
  };

  window.ProBedienung = Object.freeze({ FASSUNG, wort, knopf, hauptSetzen, info, kasten, zustand, ordnerZeile, fortschritt, schritt, versionSatz, istOeffentlicherSchluessel,
    schriftKnopf, schriftSetzen });
})();
