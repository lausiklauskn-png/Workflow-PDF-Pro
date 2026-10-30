/* „Überall suchen“ — gemeinsamer Baustein aller Pro-Apps (Pro-Umbau 12, Klaus m7 2026-10-30: „dieselbe Bedienung in allen drei
   Pro-Apps, gemeinsamer Baustein“). Quelle: Private Brain Pro (native/pro-ueberall.js/.css), byte-gleich kopiert nach Workflow PDF Pro
   (und jede künftige Pro-App) über deren tools/native/bedienung-nachziehen.mjs — nur hier ändern, dann Pin erneuern und nachziehen.
   Vorbild ist BookLedgerPro 0.1.6 (src/domain/ueberall.js + src/ui/views/sbkimsuche.js): eine Suche, eine Liste, jede Zeile sagt,
   woher sie kommt — diese App, der Tresorordner (die Fächer aller Pro-Apps auf diesem Gerät, ohne Internet; Klaus m5) und auf
   Wunsch das Netz (andere Arbeitsplätze im Mycel, Modul 23; ab Werk aus, jeder schaltet selbst; Klaus m6).
   Hier steht nur Logik und Form. Was „diese App“ durchsucht, wie die Brücke zum Tresorordner heißt und was ein Tipp auf eine Zeile
   öffnet, gibt jede App beim Aufruf mit. Kein Netz von selbst: das Mycel wird nur gefragt, wenn der Haken „Netz“ an ist und jemand
   auf „Suchen“ tippt. Kein Speicher außer dem Merken der Haken (localStorage, ein Schlüssel). Keine Emojis. Fremder Text bleibt Text
   (textContent). Braucht native/pro-bedienung.js (Kasten, ⓘ, Knopf). */
(() => {
  'use strict';
  if (window.ProUeberall) return;
  const FASSUNG = 1;
  const root = document.documentElement;

  // ---------- Wortsuche (wie BookLedgerPro belegsuche.js: UND über alle Wörter, Umlaute gefaltet, Daten als JJJJMMTT) ----------
  const UMLAUT = { 'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 'ss', 'é': 'e', 'è': 'e', 'ê': 'e', 'á': 'a', 'à': 'a', 'ó': 'o', 'ú': 'u', 'ç': 'c', 'ñ': 'n' };
  const WORT_MIN = 2;
  function normalisieren(text) {
    let s = String(text == null ? '' : text).toLowerCase();
    s = s.replace(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g, (_, d, m, j) => (j.length === 2 ? '20' + j : j) + m.padStart(2, '0') + d.padStart(2, '0'));
    s = s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$1$2$3');
    s = s.replace(/[äöüßéèêáàóúçñ]/g, c => UMLAUT[c] || c);
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  }
  function suchwoerter(frage) {
    const aus = [];
    for (const w of normalisieren(frage).split(' ')) if (w.length >= WORT_MIN && !aus.includes(w)) aus.push(w);
    return aus;
  }
  function wortTreffer(text, woerter) {
    if (!woerter || !woerter.length) return false;
    const n = normalisieren(text);
    return woerter.every(w => n.includes(w));
  }
  function ausschnitt(text, woerter, n = 120) {
    const roh = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!roh) return '';
    // Umlaute einzeln falten (gleiche Länge, damit die Stelle im Original stimmt); ß bleibt.
    const unten = roh.toLowerCase().replace(/[äöüéèêáàóúçñ]/g, c => UMLAUT[c] || c);
    let pos = -1;
    for (const w of woerter || []) { const i = unten.indexOf(w); if (i >= 0 && (pos < 0 || i < pos)) pos = i; }
    if (pos < 0) return roh.slice(0, n) + (roh.length > n ? '…' : '');
    const start = Math.max(0, pos - Math.floor(n / 3)), ende = Math.min(roh.length, start + n);
    return (start > 0 ? '…' : '') + roh.slice(start, ende) + (ende < roh.length ? '…' : '');
  }

  /**
   * Wortsuche über eine beliebige Liste der App. `art` sagt, wie ein Eintrag gelesen wird.
   * @param {object[]} eintraege
   * @param {string} frage
   * @param {{herkunft?:string, typ?:string|function, text:function, name:function, id:function, stelle?:function}} art
   */
  function listeSuchen(eintraege, frage, art) {
    const woerter = suchwoerter(frage);
    if (!woerter.length || !art || typeof art.text !== 'function') return [];
    const aus = [];
    for (const e of eintraege || []) {
      if (!e) continue;
      const text = String(art.text(e) || '');
      if (!wortTreffer(text, woerter)) continue;
      aus.push({ herkunft: art.herkunft || 'app', typ: typeof art.typ === 'function' ? art.typ(e) : (art.typ || 'eintrag'),
        id: String(art.id(e) == null ? '' : art.id(e)), name: String(art.name(e) || '').slice(0, 200) || String(art.id(e) || ''),
        stelle: art.stelle ? String(art.stelle(e, woerter) || '') : ausschnitt(text, woerter), daten: e });
    }
    return aus;
  }

  // ---------- Tresorordner: die Fächer aller Pro-Apps (Format: Workflow-PDF-Pro/docs/TRESORORDNER.md, Paket de.familyprojekt.tresor) ----------
  const FAECHER = Object.freeze([
    { fach: 'private-brain', ordner: 'Private Brain', app: 'Private Brain Pro' },
    { fach: 'workflow-pdf-pro', ordner: 'Workflow PDF Pro', app: 'Workflow PDF Pro' },
    { fach: 'bookledgerpro', ordner: 'BookLedgerPro', app: 'BookLedgerPro' },
    { fach: 'eingang-bookledgerpro', ordner: 'Eingang-BookLedgerPro', app: 'BookLedgerPro' },
    { fach: 'eingang-workflowpdf', ordner: 'Eingang-WorkflowPDF', app: 'Workflow PDF Pro' }
  ].map(Object.freeze));
  const fachVon = slug => FAECHER.find(f => f.fach === slug) || null;
  const eintragText = e => [e && e.name, e && e.auszug, e && e.art].filter(Boolean).join(' · ');

  /**
   * Wortsuche über die Inhaltsverzeichnisse der Fächer (nur Name, Kurzfassung ≤ 1000 Zeichen, Art — mehr steht dort nie).
   * @param {{fach:string, eintraege:object[]}[]} faecher
   * @param {string} frage
   * @param {{ohne?:string[]}} [opt] Fächer, die die App schon selbst durchsucht (ihr eigenes)
   */
  function tresorSuchen(faecher, frage, { ohne = [] } = {}) {
    const woerter = suchwoerter(frage);
    if (!woerter.length) return [];
    const aus = [];
    for (const f of faecher || []) {
      if (!f || ohne.includes(f.fach) || !fachVon(f.fach)) continue;
      for (const e of f.eintraege || []) {
        if (!e || !e.id) continue;
        const text = eintragText(e);
        if (!wortTreffer(text, woerter)) continue;
        aus.push({ herkunft: 'tresor', typ: f.fach, id: String(e.id), name: String(e.name || e.id).slice(0, 200), stelle: ausschnitt(e.auszug || text, woerter),
          datum: Number(e.datum) || 0, oeffenbar: e.verschluesselung === 'fpt1', daten: e });
      }
    }
    return aus.sort((a, b) => b.datum - a.datum);
  }

  /**
   * Liest die Fächer über die Brücke der App und sucht darin. `bruecke` hat zustand() und fach(slug) → {eintraege}.
   * Gesperrt, nicht eingerichtet oder ohne Brücke: keine Treffer, ein ruhiger Hinweis (nie ein Fehler bis in die Ansicht).
   */
  async function tresorLesen(bruecke, frage, { ohne = [] } = {}) {
    if (!bruecke || typeof bruecke.fach !== 'function') return { treffer: [], hinweis: '' };
    let z = null;
    try { z = typeof bruecke.zustand === 'function' ? await bruecke.zustand() : { offen: true }; } catch { z = null; }
    if (!z || z.gewaehlt === false) return { treffer: [], hinweis: wort('tresorFehlt') };
    if (!z.offen) return { treffer: [], hinweis: wort('tresorZu') };
    const faecher = [];
    for (const f of FAECHER) {
      if (ohne.includes(f.fach)) continue;
      try { const r = await bruecke.fach(f.fach); faecher.push({ fach: f.fach, eintraege: (r && r.eintraege) || [] }); } catch { /* Fach fehlt oder leer */ }
    }
    return { treffer: tresorSuchen(faecher, frage, { ohne }), hinweis: '' };
  }

  // ---------- Netz: andere Arbeitsplätze im Mycel (Modul 23 byte-1:1 aus Sage: discover + askNode) ----------
  /** Fragt die Knoten im Raum (höchstens `max`, parallel). Nur nutzer-ausgelöst. */
  async function netzFragen(rdv, text, { max = 5, listenMs = 2500 } = {}) {
    if (!rdv || typeof rdv.discover !== 'function' || typeof rdv.askNode !== 'function') return { ok: false, reason: 'nicht-geladen', antworten: [], knoten: 0 };
    const d = await Promise.resolve(rdv.discover({ listenMs })).catch(e => ({ ok: false, reason: String((e && e.message) || e), cards: [] }));
    if (!d || !d.ok) return { ok: false, reason: (d && d.reason) || 'nicht-verbunden', antworten: [], knoten: 0 };
    const karten = (d.cards || []).slice(0, max);
    if (!karten.length) return { ok: true, antworten: [], knoten: 0 };
    const antworten = await Promise.all(karten.map(c => Promise.resolve(rdv.askNode(c, text))
      .then(a => ({ ...(a || {}), nodeName: c.nodeName || '' }))
      .catch(e => ({ ok: false, reason: String((e && e.message) || e), nodeName: c.nodeName || '' }))));
    return { ok: true, antworten, knoten: karten.length };
  }
  /** Antworten aus dem Netz in Trefferzeilen (je Knoten höchstens 10; fremder Text gekürzt, bleibt Text). */
  function netzZeilen(antworten) {
    const aus = [];
    for (const a of antworten || []) {
      if (!a || !a.ok || !Array.isArray(a.results)) continue;
      const knoten = String(a.nodeName || a.fromName || a.fromNodeId || '').slice(0, 80);
      for (const r of a.results.slice(0, 10)) {
        const label = String((r && r.label) || '').slice(0, 200);
        if (!label) continue;
        aus.push({ herkunft: 'netz', typ: 'knoten', id: String((r && r.anchorId) || label), name: label, stelle: knoten, knoten,
          bestaetigt: !!a.bestaetigt, ausgeschlossen: !!(r && r.ausgeschlossen) });
      }
    }
    return aus;
  }

  // ---------- Liste: nach Herkunft geordnet, je Gruppe gekappt ----------
  const JE_GRUPPE_MAX = 25;
  const gruppenSchluessel = t => (t.herkunft === 'tresor' ? 'tresor:' + t.typ : t.herkunft);
  const REIHENFOLGE = ['app', ...FAECHER.map(f => 'tresor:' + f.fach), 'netz'];
  function gruppieren(treffer, max = JE_GRUPPE_MAX) {
    const g = new Map();
    for (const t of treffer || []) {
      if (!t) continue;
      const k = gruppenSchluessel(t);
      if (!g.has(k)) g.set(k, []);
      const l = g.get(k); if (l.length < max) l.push(t);
    }
    const rang = k => { const i = REIHENFOLGE.indexOf(k); return i < 0 ? REIHENFOLGE.indexOf('netz') - 0.5 : i; };
    return [...g.entries()].sort((a, b) => rang(a[0]) - rang(b[0])).map(([schluessel, liste]) => ({ schluessel, herkunft: liste[0].herkunft, typ: liste[0].typ, liste }));
  }

  // ---------- Wörter (de en ru pl ar; fehlt eine Sprache, gilt Deutsch) ----------
  const WORTE = {
    titel:        ['Überall suchen', 'Search everywhere', 'Искать везде', 'Szukaj wszędzie', 'البحث في كل مكان'],
    kurz:         ['Dokumente finden in allen deinen verbundenen Programmen.', 'Find documents in all your connected programs.', 'Находите документы во всех подключённых программах.', 'Znajdź dokumenty we wszystkich połączonych programach.', 'ابحث عن المستندات في جميع برامجك المتصلة.'],
    mehr1:        ['Gesucht wird in dieser App und im Tresorordner: dort legen alle Pro-Apps auf diesem Gerät ein Inhaltsverzeichnis ab (Name, Datum, Kurzfassung) – verschlüsselt, ohne Internet. Jede Zeile sagt, woher sie kommt.',
                   'The search covers this app and the shared vault folder, where every Pro app on this device keeps a table of contents (name, date, summary) – encrypted, without internet. Each line says where it comes from.',
                   'Поиск идёт в этом приложении и в общей папке: там все Pro-приложения на этом устройстве хранят оглавление (имя, дата, краткое содержание) – зашифровано, без интернета. Каждая строка показывает источник.',
                   'Szukanie obejmuje tę aplikację i wspólny folder: wszystkie aplikacje Pro na tym urządzeniu zapisują tam spis treści (nazwa, data, skrót) – zaszyfrowany, bez internetu. Każdy wiersz mówi, skąd pochodzi.',
                   'يشمل البحث هذا التطبيق ومجلد الخزنة المشترك، حيث تحفظ كل تطبيقات Pro على هذا الجهاز فهرسًا (الاسم، التاريخ، ملخص) – مشفرًا وبدون إنترنت. كل سطر يذكر مصدره.'],
    mehr2:        ['„Netz“ fragt zusätzlich deine anderen Arbeitsplätze im Mycel – nur wenn du den Haken setzt und verbunden bist. Von dort kommen nur Titel zurück, nie der Inhalt.',
                   '“Network” also asks your other workplaces in the mycelium – only if you tick it and are connected. Only titles come back, never the content.',
                   '«Сеть» дополнительно спрашивает другие рабочие места в мицелии – только если вы поставите галочку и подключены. Возвращаются только названия, не содержимое.',
                   '„Sieć” pyta też inne stanowiska w grzybni – tylko gdy zaznaczysz i masz połączenie. Wracają tylko tytuły, nigdy treść.',
                   '«الشبكة» تسأل أيضًا أماكن عملك الأخرى في الميسيليوم – فقط إذا فعّلتها وكنت متصلًا. تعود العناوين فقط، لا المحتوى أبدًا.'],
    suchen:       ['Suchen', 'Search', 'Искать', 'Szukaj', 'بحث'],
    platzhalter:  ['Wonach suchst du?', 'What are you looking for?', 'Что вы ищете?', 'Czego szukasz?', 'عمّ تبحث؟'],
    qTresor:      ['Tresorordner (alle Pro-Apps)', 'Shared vault folder (all Pro apps)', 'Общая папка (все Pro-приложения)', 'Wspólny folder (wszystkie aplikacje Pro)', 'مجلد الخزنة (كل تطبيقات Pro)'],
    qNetz:        ['Netz (andere Arbeitsplätze)', 'Network (other workplaces)', 'Сеть (другие рабочие места)', 'Sieć (inne stanowiska)', 'الشبكة (أماكن عمل أخرى)'],
    gTresor:      ['Tresorordner · {o}', 'Shared vault · {o}', 'Общая папка · {o}', 'Wspólny folder · {o}', 'الخزنة · {o}'],
    gNetz:        ['Netz', 'Network', 'Сеть', 'Sieć', 'الشبكة'],
    sucht:        ['Sucht …', 'Searching …', 'Поиск …', 'Szukam …', 'جارٍ البحث …'],
    fragtNetz:    ['Fragt das Netz …', 'Asking the network …', 'Спрашиваю сеть …', 'Pytam sieć …', 'جارٍ سؤال الشبكة …'],
    ergebnis:     ['{n} Treffer', '{n} results', 'Найдено: {n}', 'Wyniki: {n}', '{n} نتيجة'],
    nichts:       ['Nichts gefunden.', 'Nothing found.', 'Ничего не найдено.', 'Nic nie znaleziono.', 'لم يُعثر على شيء.'],
    leer:         ['Bitte ein Suchwort eingeben (mindestens zwei Zeichen).', 'Please enter a search word (at least two characters).', 'Введите слово (минимум два символа).', 'Wpisz słowo (co najmniej dwa znaki).', 'أدخل كلمة بحث (حرفان على الأقل).'],
    tresorZu:     ['Tresorordner gesperrt – entsperren in den Einstellungen, dann werden die anderen Pro-Apps mitgesucht.', 'Shared vault folder is locked – unlock it in the settings to include the other Pro apps.', 'Общая папка заблокирована – разблокируйте в настройках, чтобы искать и в других Pro-приложениях.', 'Wspólny folder zablokowany – odblokuj w ustawieniach, aby szukać też w innych aplikacjach Pro.', 'مجلد الخزنة مقفل – افتحه من الإعدادات ليشمل البحث تطبيقات Pro الأخرى.'],
    tresorFehlt:  ['Noch kein Tresorordner eingerichtet (Einstellungen → Tresor).', 'No shared vault folder set up yet (Settings → Vault).', 'Общая папка ещё не настроена (Настройки → Сейф).', 'Wspólny folder jeszcze nie ustawiony (Ustawienia → Sejf).', 'لم يُعدّ مجلد الخزنة بعد (الإعدادات ← الخزنة).'],
    netzFehlt:    ['Das Mycel ist in dieser App nicht geladen.', 'The mycelium is not loaded in this app.', 'Мицелий в этом приложении не загружен.', 'Grzybnia nie jest załadowana w tej aplikacji.', 'الميسيليوم غير محمّل في هذا التطبيق.'],
    netzZu:       ['Nicht mit dem Netz verbunden.', 'Not connected to the network.', 'Нет подключения к сети.', 'Brak połączenia z siecią.', 'غير متصل بالشبكة.'],
    netzLeer:     ['Im Netz ist gerade kein anderer Arbeitsplatz.', 'No other workplace is in the network right now.', 'В сети сейчас нет других рабочих мест.', 'W sieci nie ma teraz innego stanowiska.', 'لا يوجد مكان عمل آخر في الشبكة الآن.'],
    netzAntw:     ['{k} Arbeitsplätze gefragt, {z} Zeilen.', '{k} workplaces asked, {z} lines.', 'Опрошено мест: {k}, строк: {z}.', 'Zapytano stanowisk: {k}, wierszy: {z}.', 'سُئل {k} من أماكن العمل، {z} سطر.'],
    mycel:        ['Mycel öffnen', 'Open mycelium', 'Открыть мицелий', 'Otwórz grzybnię', 'فتح الميسيليوم'],
    vonKnoten:    ['von {k}', 'from {k}', 'от {k}', 'od {k}', 'من {k}'],
    unbestaetigt: ['nicht bestätigt', 'not confirmed', 'не подтверждено', 'niepotwierdzone', 'غير مؤكد'],
    nichtKi:      ['nicht an die KI', 'not for the AI', 'не для ИИ', 'nie dla AI', 'ليس للذكاء الاصطناعي'],
    nurZeile:     ['nur im Inhaltsverzeichnis – öffnen in {a}', 'table of contents only – open in {a}', 'только в оглавлении – открыть в {a}', 'tylko w spisie – otwórz w {a}', 'في الفهرس فقط – افتح في {a}'],
    fehler:       ['Das ging nicht: {e}', 'That did not work: {e}', 'Не получилось: {e}', 'Nie udało się: {e}', 'لم ينجح ذلك: {e}']
  };
  const SPRACHEN = ['de', 'en', 'ru', 'pl', 'ar'];
  const sprache = () => Math.max(0, SPRACHEN.indexOf(String(root.lang || 'de').slice(0, 2).toLowerCase()));
  function wort(schluessel, werte = {}) {
    const zeile = WORTE[schluessel]; if (!zeile) return '';
    return String(zeile[sprache()] || zeile[0]).replace(/\{(\w+)\}/g, (_, k) => (k in werte ? String(werte[k]) : ''));
  }
  function gruppenTitel(g, appName) {
    if (g.herkunft === 'app') return appName || '';
    if (g.herkunft === 'tresor') { const f = fachVon(g.typ); return wort('gTresor', { o: f ? f.ordner : g.typ }); }
    if (g.herkunft === 'netz') return wort('gNetz');
    return g.herkunft;
  }

  // ---------- Ablauf einer Suche (ohne DOM, in Node prüfbar) ----------
  /**
   * @param {string} frage
   * @param {{app?:(f:string)=>Promise<object[]>|object[], tresor?:object, tresorOhne?:string[], netz?:object|null, quellen?:{app?:boolean,tresor?:boolean,netz?:boolean}, beiStand?:(s:string)=>void}} p
   * @returns {Promise<{treffer:object[], hinweise:string[], netz:{info:string, zu:boolean}|null}>}
   */
  async function suchen(frage, p = {}) {
    const q = { app: true, tresor: true, netz: false, ...(p.quellen || {}) };
    const hinweise = [];
    if (!suchwoerter(frage).length) return { treffer: [], hinweise: [wort('leer')], netz: null };
    const [app, tresor] = await Promise.all([
      q.app && typeof p.app === 'function' ? Promise.resolve().then(() => p.app(frage)).catch(e => { hinweise.push(wort('fehler', { e: String((e && e.message) || e) })); return []; }) : [],
      q.tresor && p.tresor ? tresorLesen(p.tresor, frage, { ohne: p.tresorOhne || [] }) : { treffer: [], hinweis: '' }
    ]);
    if (tresor.hinweis) hinweise.push(tresor.hinweis);
    const treffer = [...(app || []).map(t => ({ herkunft: 'app', ...t })), ...tresor.treffer];
    let netz = null;
    if (q.netz) {
      if (p.beiStand) p.beiStand(wort('fragtNetz'));
      const n = await netzFragen(p.netz, frage);
      if (!n.ok) netz = { info: n.reason === 'nicht-geladen' ? wort('netzFehlt') : wort('netzZu'), zu: n.reason !== 'nicht-geladen' };
      else if (!n.knoten) netz = { info: wort('netzLeer'), zu: false };
      else { const z = netzZeilen(n.antworten); treffer.push(...z); netz = { info: wort('netzAntw', { k: n.knoten, z: z.length }), zu: false }; }
    }
    return { treffer, hinweise, netz };
  }

  // ---------- Kasten in der App (Form nach Leitfaden: Überschrift + ⓘ, ein farbiger Knopf, Haken, Liste mit Herkunft) ----------
  const MERK = 'pro_ueberall_quellen_v1';
  function quellenLesen() {
    const v = { app: true, tresor: true, netz: false };
    try { const g = JSON.parse(localStorage.getItem(MERK) || 'null'); if (g && typeof g === 'object') for (const k of Object.keys(v)) if (typeof g[k] === 'boolean') v[k] = g[k]; } catch { /* Vorgabe */ }
    return v;
  }
  function quellenMerken(q) { try { localStorage.setItem(MERK, JSON.stringify(q)); } catch { /* nur Komfort */ } }
  function el(tag, klasse, text) { const n = document.createElement(tag); if (klasse) n.className = klasse; if (text != null) n.textContent = text; return n; }

  /**
   * Baut den Kasten „Überall suchen“.
   * @param {{appName:string, appLabel?:string, frage?:()=>string, eigenesFeld?:boolean, app?:function, tresor?:()=>object|null,
   *          tresorOhne?:string[], netz?:()=>object|null, mycelOeffnen?:()=>void, oeffnen?:(zeile:object)=>void, kannOeffnen?:(zeile:object)=>boolean}} o
   */
  function kasten(o = {}) {
    const P = window.ProBedienung;
    if (!P) throw new Error('ProUeberall braucht ProBedienung (native/pro-bedienung.js).');
    const info = el('div'); info.append(el('p', null, wort('mehr1')), el('p', null, wort('mehr2')));
    const k = P.kasten('ueberall', wort('titel'), { erklaerung: info });
    k.element.classList.add('pro-ue'); k.element.dataset.proUe = '';
    const kurz = el('p', 'pro-ue-kurz', wort('kurz'));
    const feldReihe = el('div', 'pro-ue-feld');
    let eingabe = null;
    if (o.eigenesFeld !== false || typeof o.frage !== 'function') {
      eingabe = el('input', 'pro-ue-eingabe'); eingabe.type = 'search'; eingabe.placeholder = wort('platzhalter'); eingabe.setAttribute('aria-label', wort('titel'));
      eingabe.dataset.proUeFrage = '';
      eingabe.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); los(); } });
      feldReihe.append(eingabe);
    }
    const knopf = P.knopf(wort('suchen'), { haupt: true, name: 'ueberall-suchen', beiTipp: () => los() });
    feldReihe.append(knopf);
    const haken = el('div', 'pro-ue-quellen'); haken.dataset.proUeQuellen = '';
    const q0 = quellenLesen();
    const hakenSetzen = (schluessel, label) => {
      const l = el('label', 'pro-ue-quelle'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!q0[schluessel]; cb.dataset.proUeQuelle = schluessel;
      cb.addEventListener('change', () => { const n = quellenLesen(); n[schluessel] = cb.checked; quellenMerken(n); });
      l.append(cb, el('span', null, label)); haken.append(l);
    };
    hakenSetzen('app', o.appLabel || o.appName || '');
    const hatTresor = () => Boolean(typeof o.tresor === 'function' && o.tresor());
    if (hatTresor()) hakenSetzen('tresor', wort('qTresor'));
    hakenSetzen('netz', wort('qNetz'));
    const status = el('p', 'pro-ue-status'); status.setAttribute('role', 'status'); status.dataset.proUeStatus = '';
    const liste = el('div', 'pro-ue-liste'); liste.dataset.proUeListe = '';
    k.rumpf.append(kurz, feldReihe, haken, status, liste);

    let laeuft = false;
    function zeile(t) {
      const li = el('li', 'pro-ue-zeile'); li.dataset.proUeHerkunft = t.herkunft; li.dataset.proUeTyp = t.typ || '';
      const kannOeffnen = t.herkunft !== 'netz' && typeof o.oeffnen === 'function' && (typeof o.kannOeffnen !== 'function' || o.kannOeffnen(t));
      const name = kannOeffnen ? el('button', 'pro-ue-name', t.name || '–') : el('span', 'pro-ue-name', t.name || '–');
      if (kannOeffnen) { name.type = 'button'; name.addEventListener('click', () => o.oeffnen(t)); }
      li.append(name);
      let stelle = t.stelle || '';
      if (t.herkunft === 'netz') stelle = wort('vonKnoten', { k: t.knoten || '?' }) + (t.bestaetigt ? '' : ' · ' + wort('unbestaetigt')) + (t.ausgeschlossen ? ' · ' + wort('nichtKi') : '');
      else if (t.herkunft === 'tresor' && !t.oeffenbar) { const f = fachVon(t.typ); const fremd = f && f.app !== o.appName; if (fremd) stelle = (stelle ? stelle + ' · ' : '') + wort('nurZeile', { a: f.app }); }
      if (stelle) li.append(el('span', 'pro-ue-stelle', stelle));
      return li;
    }
    function zeigen(erg) {
      liste.replaceChildren();
      if (!erg) return;
      const gruppen = gruppieren(erg.treffer);
      for (const g of gruppen) {
        const s = el('section', 'pro-ue-gruppe'); s.dataset.proUeGruppe = g.schluessel;
        s.append(el('h4', 'pro-ue-gruppe-titel', gruppenTitel(g, o.appName) + ' · ' + g.liste.length));
        const ul = el('ul', 'pro-ue-ul'); for (const t of g.liste) ul.append(zeile(t)); s.append(ul); liste.append(s);
      }
    }
    async function los() {
      if (laeuft) return;
      const frage = String(eingabe ? eingabe.value : o.frage()).trim();
      laeuft = true; knopf.disabled = true; status.replaceChildren(document.createTextNode(wort('sucht'))); liste.replaceChildren();
      let erg = null;
      try {
        erg = await suchen(frage, { app: o.app, tresor: hatTresor() ? o.tresor() : null, tresorOhne: o.tresorOhne || [], netz: typeof o.netz === 'function' ? o.netz() : null,
          quellen: { ...quellenLesen(), tresor: quellenLesen().tresor && hatTresor() }, beiStand: s => { status.textContent = s; } });
      } catch (e) { erg = { treffer: [], hinweise: [wort('fehler', { e: String((e && e.message) || e) })], netz: null }; }
      finally { laeuft = false; knopf.disabled = false; }
      const saetze = [...erg.hinweise];
      if (erg.treffer.length) saetze.unshift(wort('ergebnis', { n: erg.treffer.length }));
      else if (suchwoerter(frage).length) saetze.unshift(wort('nichts'));
      status.replaceChildren(document.createTextNode(saetze.join(' ')));
      if (erg.netz) {
        const n = el('span', 'pro-ue-netzinfo', ' ' + erg.netz.info); n.dataset.proUeNetzinfo = ''; status.append(n);
        if (erg.netz.zu && typeof o.mycelOeffnen === 'function') status.append(' ', P.knopf(wort('mycel'), { name: 'mycel-oeffnen', beiTipp: () => o.mycelOeffnen() }));
      }
      zeigen(erg);
      return erg;
    }
    return { element: k.element, eingabe, suchen: los, zeigen };
  }

  window.ProUeberall = Object.freeze({ FASSUNG, FAECHER, normalisieren, suchwoerter, wortTreffer, ausschnitt, listeSuchen, tresorSuchen, tresorLesen,
    netzFragen, netzZeilen, gruppieren, suchen, wort, kasten });
})();
