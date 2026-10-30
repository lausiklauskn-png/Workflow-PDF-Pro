/* „Chefcode“ — gemeinsamer Baustein aller Pro-Apps (Pro-Umbau 13, Klaus 2026-10-30: „Ja, Schritt 1+2“, „Chef legt fest, alle 3“).
   Quelle: Private Brain Pro (native/pro-chefcode.js), byte-gleich kopiert nach Workflow PDF Pro und BookLedgerPro über deren
   tools/native/bedienung-nachziehen.mjs — nur hier ändern, dann Pin erneuern und nachziehen.
   Was es ist: ein Feld „Chefcode“. Wer in einer Pro-App denselben Code eingibt, ist im selben eigenen Netz. Gebaut wird nichts
   Neues am Netz: Modul 23 (Sage, byte-1:1) kann ein eigenes Netz schon (setNetwork/saveNetwork/applyNetwork: Raum-Marke per
   SHA-256, Schlüssel per PBKDF2, Zettel AES-GCM; ein ungültiger Code fällt nie still ins öffentliche Netz zurück). Dieser Baustein
   ist nur die einfache Bedienung davor: ein Feld, „Übernehmen“, „Entfernen“, ein Zustand.
   Der Chef denkt sich den Code aus (mindestens 12 Buchstaben oder Ziffern) und gibt ihn nur Vertrauten. Ein neuer Code ersetzt den
   alten sofort; wer den alten hat, ist danach draußen. Gespeichert wird er von Modul 23 im Speicher DIESER App (localStorage
   „sbkim_netz_<Schublade>“), nie in Dateien, nie im Tresorordner, nie in einer Meldung. Nach dem Übernehmen steht er nirgends mehr
   im Bild. Keine Emojis, fremder Text bleibt Text. Braucht native/pro-bedienung.js (Kasten, ⓘ, Knopf, Zustand). */
(() => {
  'use strict';
  if (window.ProChefcode) return;
  const FASSUNG = 1;
  const MIN = 12;                                   // wie NETZ_CODE_MIN in Modul 23
  const NAME = 'Chefcode';                          // Name des Netzes in der Einstellung von Modul 23
  const RELAIS_VORGABE = 'wss://relay.family-projekt.de';
  const root = document.documentElement;

  /** Wie Modul 23 (netCodeNorm): Leerzeichen und Bindestriche weg, Großbuchstaben. */
  function normalisieren(code) { return String(code == null ? '' : code).replace(/[\s-]+/g, '').toUpperCase(); }
  /** @returns {{ok:boolean, grund?:string}} */
  function pruefen(code) {
    const n = normalisieren(code);
    if (!n) return { ok: false, grund: 'leer' };
    if (!/^[A-Z0-9]+$/.test(n)) return { ok: false, grund: 'zeichen' };
    if (n.length < MIN) return { ok: false, grund: 'kurz' };
    return { ok: true };
  }
  function relais(rdv) {
    try { const st = rdv && typeof rdv.readNetwork === 'function' ? rdv.readNetwork() : null; if (st && st.ok && st.setting && st.setting.relay) return st.setting.relay; } catch { /* Vorgabe */ }
    try { const d = window.SbkimNostrRelay && window.SbkimNostrRelay._meta && window.SbkimNostrRelay._meta.defaultRelays; if (d && d[0]) return d[0]; } catch { /* Vorgabe */ }
    return RELAIS_VORGABE;
  }
  /** Zustand für die Anzeige: eigen · oeffentlich · ungueltig · fehlt (Modul 23 nicht geladen). */
  function zustand(rdv) {
    if (!rdv || typeof rdv.saveNetwork !== 'function' || typeof rdv.applyNetwork !== 'function') return { lage: 'fehlt' };
    let gespeichert = null;
    try { const st = typeof rdv.readNetwork === 'function' ? rdv.readNetwork() : null; if (st && st.present) gespeichert = st.ok ? st.setting : { kaputt: true }; } catch { /* egal */ }
    const lage = String((rdv._meta && rdv._meta.network) || (gespeichert ? 'eigen' : 'oeffentlich'));
    if (lage === 'eigen' || lage === 'wird-abgeleitet') return { lage: 'eigen', chef: !!(gespeichert && gespeichert.name === NAME), name: gespeichert && gespeichert.name || '' };
    if (lage === 'ungueltig' || (gespeichert && gespeichert.kaputt)) return { lage: 'ungueltig' };
    return { lage: 'oeffentlich' };
  }
  // Hat die App vor dem Wechsel geantwortet, antwortet sie im neuen Netz wieder (Modul 23: „die App schaltet das Antwortrecht im
  // neuen Netz wieder ein“). Hat sie nicht, bleibt es aus.
  async function wiederAntworten(rdv, antwortete) {
    if (!antwortete || typeof rdv.enableAnswering !== 'function') return;
    try { await rdv.enableAnswering({}); } catch { /* fail-soft: der Schalter in der App zeigt den Stand */ }
  }
  /** Setzt den Chefcode: speichern (Modul 23) und sofort anwenden. Der Code kommt in keiner Rückgabe vor. */
  async function setzen(rdv, code) {
    const p = pruefen(code);
    if (!p.ok) return { ok: false, grund: p.grund };
    if (!rdv || typeof rdv.saveNetwork !== 'function' || typeof rdv.applyNetwork !== 'function') return { ok: false, grund: 'fehlt' };
    const antwortete = !!(rdv._meta && rdv._meta.answering);   // Modul 23 beendet beim Netzwechsel den Antwort-Lauscher
    const sv = rdv.saveNetwork({ name: NAME, relay: relais(rdv), code: normalisieren(code), auto: true });
    if (!sv || !sv.ok) return { ok: false, grund: 'speichern', text: sv && sv.reason || '' };
    const r = await Promise.resolve(rdv.applyNetwork(sv.setting)).catch(e => ({ ok: false, reason: String((e && e.message) || e) }));
    if (!r || !r.ok) return { ok: false, grund: 'anwenden', text: r && r.reason || '' };
    await wiederAntworten(rdv, antwortete);
    return { ok: true, lage: 'eigen' };
  }
  /** Entfernt den Chefcode: zurück ins öffentliche Netz (dort gehen nur Titel, Datum, Betrag hinaus). */
  async function entfernen(rdv) {
    if (!rdv || typeof rdv.applyNetwork !== 'function') return { ok: false, grund: 'fehlt' };
    const antwortete = !!(rdv._meta && rdv._meta.answering);
    try { if (typeof rdv.clearNetwork === 'function') rdv.clearNetwork(); } catch { /* weiter */ }
    const r = await Promise.resolve(rdv.applyNetwork(null)).catch(e => ({ ok: false, reason: String((e && e.message) || e) }));
    if (!r || !r.ok) return { ok: false, grund: 'anwenden', text: r && r.reason || '' };
    await wiederAntworten(rdv, antwortete);
    return { ok: true, lage: 'oeffentlich' };
  }

  // ---------- Wörter (de en ru pl ar; fehlt eine Sprache, gilt Deutsch) ----------
  const WORTE = {
    titel:      ['Chefcode', 'Boss code', 'Код руководителя', 'Kod szefa', 'رمز المدير'],
    kurz:       ['Gleicher Code = eigenes Netz deiner Arbeitsplätze.', 'Same code = your own network of workplaces.', 'Один код = своя сеть рабочих мест.', 'Ten sam kod = własna sieć stanowisk.', 'نفس الرمز = شبكة خاصة لأماكن عملك.'],
    mehr1:      ['Wer in einer Pro-App denselben Chefcode eingibt, ist im selben eigenen Netz. Fremde ohne Code sehen es nicht, alles darin ist verschlüsselt. Ohne Code bleibt das öffentliche Netz, dort gehen nur Titel, Datum und Betrag hinaus.',
                 'Whoever enters the same boss code in a Pro app is in the same private network. Strangers without the code cannot see it; everything in it is encrypted. Without a code the public network stays, where only title, date and amount go out.',
                 'Кто вводит тот же код в Pro-приложении, попадает в ту же собственную сеть. Чужие без кода её не видят, всё внутри зашифровано. Без кода остаётся общая сеть: туда уходят только название, дата и сумма.',
                 'Kto wpisze ten sam kod w aplikacji Pro, jest w tej samej własnej sieci. Obcy bez kodu jej nie widzą, wszystko jest szyfrowane. Bez kodu zostaje sieć publiczna: wychodzą tylko tytuł, data i kwota.',
                 'من يُدخل نفس الرمز في تطبيق Pro يكون في نفس الشبكة الخاصة. لا يراها الغرباء دون الرمز، وكل ما فيها مشفّر. دون رمز تبقى الشبكة العامة، ويخرج إليها العنوان والتاريخ والمبلغ فقط.'],
    mehr2:      ['Der Chef legt den Code fest (mindestens 12 Buchstaben oder Ziffern) und gibt ihn nur Vertrauten. Ein neuer Code gilt sofort, der alte nicht mehr: alle Arbeitsplätze brauchen dann den neuen. Der Code bleibt nur in dieser App gespeichert, nie in Dateien.',
                 'The boss sets the code (at least 12 letters or digits) and gives it only to trusted people. A new code applies at once and the old one stops working: every workplace then needs the new one. The code is stored only in this app, never in files.',
                 'Руководитель задаёт код (не менее 12 букв или цифр) и даёт его только доверенным. Новый код действует сразу, старый — нет: всем рабочим местам нужен новый. Код хранится только в этом приложении, не в файлах.',
                 'Szef ustala kod (co najmniej 12 liter lub cyfr) i daje go tylko zaufanym. Nowy kod działa od razu, stary już nie: wszystkie stanowiska potrzebują nowego. Kod jest zapisany tylko w tej aplikacji, nigdy w plikach.',
                 'يحدد المدير الرمز (12 حرفًا أو رقمًا على الأقل) ويعطيه للموثوقين فقط. الرمز الجديد يسري فورًا ولا يعود القديم صالحًا: تحتاج كل أماكن العمل إلى الجديد. يُحفظ الرمز في هذا التطبيق فقط، لا في ملفات.'],
    feld:       ['Chefcode eingeben', 'Enter boss code', 'Введите код', 'Wpisz kod szefa', 'أدخل رمز المدير'],
    uebernehmen:['Übernehmen', 'Apply', 'Применить', 'Zastosuj', 'تطبيق'],
    entfernen:  ['Entfernen', 'Remove', 'Удалить', 'Usuń', 'إزالة'],
    eigen:      ['Eigenes Netz mit Chefcode', 'Own network with boss code', 'Своя сеть с кодом', 'Własna sieć z kodem', 'شبكة خاصة برمز المدير'],
    eigenAnders:['Eigenes Netz „{n}“ (aus dem Mycel-Fenster)', 'Own network “{n}” (from the mycelium window)', 'Своя сеть «{n}» (из окна мицелия)', 'Własna sieć „{n}” (z okna grzybni)', 'شبكة خاصة «{n}» (من نافذة الميسيليوم)'],
    oeffentlich:['Öffentliches Netz (kein Chefcode)', 'Public network (no boss code)', 'Общая сеть (без кода)', 'Sieć publiczna (bez kodu)', 'شبكة عامة (دون رمز)'],
    ungueltig:  ['Netz-Einstellung ungültig – es wird nichts gesendet. Chefcode neu eingeben oder entfernen.', 'Network setting invalid – nothing is sent. Enter the boss code again or remove it.', 'Настройка сети неверна – ничего не отправляется. Введите код заново или удалите.', 'Ustawienie sieci nieprawidłowe – nic nie jest wysyłane. Wpisz kod ponownie lub usuń.', 'إعداد الشبكة غير صالح – لا يُرسل شيء. أدخل الرمز من جديد أو أزله.'],
    fehlt:      ['Das Mycel ist in dieser App nicht geladen.', 'The mycelium is not loaded in this app.', 'Мицелий в этом приложении не загружен.', 'Grzybnia nie jest załadowana w tej aplikacji.', 'الميسيليوم غير محمّل في هذا التطبيق.'],
    leer:       ['Bitte einen Code eingeben.', 'Please enter a code.', 'Введите код.', 'Wpisz kod.', 'أدخل رمزًا.'],
    kurzFehler: ['Zu kurz: mindestens 12 Buchstaben oder Ziffern.', 'Too short: at least 12 letters or digits.', 'Слишком коротко: не менее 12 букв или цифр.', 'Za krótki: co najmniej 12 liter lub cyfr.', 'قصير جدًا: 12 حرفًا أو رقمًا على الأقل.'],
    zeichen:    ['Nur Buchstaben A–Z und Ziffern (Leerzeichen und Bindestriche zählen nicht).', 'Only letters A–Z and digits (spaces and dashes do not count).', 'Только буквы A–Z и цифры (пробелы и дефисы не считаются).', 'Tylko litery A–Z i cyfry (spacje i myślniki się nie liczą).', 'أحرف A–Z وأرقام فقط (المسافات والشرطات لا تُحتسب).'],
    gesetzt:    ['Chefcode übernommen. Bitte „Verbinden“ im Mycel, falls noch nicht verbunden.', 'Boss code applied. Please “Connect” in the mycelium if not connected yet.', 'Код применён. Нажмите «Подключиться» в мицелии, если ещё не подключены.', 'Kod zastosowany. Kliknij „Połącz” w grzybni, jeśli jeszcze nie ma połączenia.', 'تم تطبيق الرمز. اضغط «اتصال» في الميسيليوم إن لم تكن متصلًا بعد.'],
    weg:        ['Chefcode entfernt. Wieder im öffentlichen Netz.', 'Boss code removed. Back in the public network.', 'Код удалён. Снова в общей сети.', 'Kod usunięty. Znów w sieci publicznej.', 'أُزيل الرمز. عدت إلى الشبكة العامة.'],
    fehler:     ['Das ging nicht: {e}', 'That did not work: {e}', 'Не получилось: {e}', 'Nie udało się: {e}', 'لم ينجح ذلك: {e}']
  };
  const SPRACHEN = ['de', 'en', 'ru', 'pl', 'ar'];
  const sprache = () => Math.max(0, SPRACHEN.indexOf(String(root.lang || 'de').slice(0, 2).toLowerCase()));
  function wort(schluessel, werte = {}) {
    const zeile = WORTE[schluessel]; if (!zeile) return '';
    return String(zeile[sprache()] || zeile[0]).replace(/\{(\w+)\}/g, (_, k) => (k in werte ? String(werte[k]) : ''));
  }
  const GRUND = { leer: 'leer', kurz: 'kurzFehler', zeichen: 'zeichen', fehlt: 'fehlt' };
  function el(tag, klasse, text) { const n = document.createElement(tag); if (klasse) n.className = klasse; if (text != null) n.textContent = text; return n; }

  /**
   * Baut den Kasten „Chefcode“.
   * @param {{rdv?:()=>object|null, beiWechsel?:(lage:string)=>void}} o  beiWechsel: z. B. das Antwortrecht im neuen Netz wieder einschalten
   */
  function kasten(o = {}) {
    const P = window.ProBedienung;
    if (!P) throw new Error('ProChefcode braucht ProBedienung (native/pro-bedienung.js).');
    const rdv = () => (typeof o.rdv === 'function' ? o.rdv() : window.SbkimRendezvous) || null;
    const info = el('div'); info.append(el('p', null, wort('mehr1')), el('p', null, wort('mehr2')));
    const k = P.kasten('chefcode', wort('titel'), { erklaerung: info });
    k.element.classList.add('pro-cc'); k.element.dataset.proChefcode = '';
    const kurz = el('p', 'pro-ue-kurz', wort('kurz'));
    const lage = el('p', 'pro-cc-lage'); lage.dataset.proCcLage = '';
    const reihe = el('div', 'pro-ue-feld');
    const feld = el('input', 'pro-ue-eingabe');
    feld.type = 'password'; feld.autocomplete = 'off'; feld.spellcheck = false; feld.placeholder = wort('feld');
    feld.setAttribute('aria-label', wort('feld')); feld.setAttribute('autocapitalize', 'characters');
    feld.dataset.proCcFeld = ''; feld.dataset.keinMikro = ''; feld.dataset.keinStrich = '';
    const meldung = el('p', 'pro-ue-status'); meldung.setAttribute('role', 'status'); meldung.dataset.proCcMeldung = '';
    let laeuft = false;
    const uebernehmen = P.knopf(wort('uebernehmen'), { haupt: true, name: 'chefcode-uebernehmen', beiTipp: () => los() });
    const weg = P.knopf(wort('entfernen'), { name: 'chefcode-entfernen', beiTipp: () => raus() });
    feld.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); los(); } });
    reihe.append(feld, uebernehmen, weg);
    k.rumpf.append(kurz, lage, reihe, meldung);

    function zeichnen() {
      const z = zustand(rdv());
      lage.dataset.proCcLage = z.lage;
      const satz = z.lage === 'eigen' ? (z.chef || !z.name ? wort('eigen') : wort('eigenAnders', { n: z.name })) : wort(z.lage === 'oeffentlich' ? 'oeffentlich' : z.lage);
      const punkt = el('span', 'pro-zustand'); punkt.dataset.proZustand = z.lage === 'eigen' ? 'offen' : 'zu';
      punkt.append(el('span', 'pro-punkt'), document.createTextNode(satz));
      lage.replaceChildren(punkt);
      weg.hidden = z.lage !== 'eigen' && z.lage !== 'ungueltig';
      uebernehmen.disabled = laeuft || z.lage === 'fehlt'; weg.disabled = laeuft; feld.disabled = z.lage === 'fehlt';
      return z;
    }
    async function los() {
      if (laeuft) return;
      const code = feld.value;
      const p = pruefen(code);
      if (!p.ok) { meldung.textContent = wort(GRUND[p.grund] || 'leer'); return; }
      laeuft = true; zeichnen();
      let r;
      try { r = await setzen(rdv(), code); } finally { laeuft = false; }
      feld.value = '';                                    // der Code steht danach nirgends mehr im Bild
      meldung.textContent = r.ok ? wort('gesetzt') : (GRUND[r.grund] ? wort(GRUND[r.grund]) : wort('fehler', { e: r.text || r.grund }));
      zeichnen();
      if (r.ok && typeof o.beiWechsel === 'function') { try { await o.beiWechsel('eigen'); } catch { /* fail-soft */ } }
      document.dispatchEvent(new CustomEvent('pro-chefcode', { detail: { lage: zustand(rdv()).lage } }));
    }
    async function raus() {
      if (laeuft) return;
      laeuft = true; zeichnen();
      let r;
      try { r = await entfernen(rdv()); } finally { laeuft = false; }
      meldung.textContent = r.ok ? wort('weg') : wort('fehler', { e: r.text || r.grund });
      zeichnen();
      if (r.ok && typeof o.beiWechsel === 'function') { try { await o.beiWechsel('oeffentlich'); } catch { /* fail-soft */ } }
      document.dispatchEvent(new CustomEvent('pro-chefcode', { detail: { lage: zustand(rdv()).lage } }));
    }
    zeichnen();
    return { element: k.element, zeichnen, feld };
  }

  /** Steht ein eigenes Netz (Chefcode oder eigenes Netz aus dem Mycel-Fenster)? Für Schalter, die nur dort gelten dürfen. */
  const imEigenenNetz = (rdv = window.SbkimRendezvous) => zustand(rdv).lage === 'eigen';

  window.ProChefcode = Object.freeze({ FASSUNG, MIN, NAME, normalisieren, pruefen, zustand, setzen, entfernen, imEigenenNetz, wort, kasten });
})();
