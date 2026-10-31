/* „Chefcode“ — gemeinsamer Baustein aller Pro-Apps. Quelle: Private Brain Pro (native/pro-chefcode.js), byte-gleich kopiert nach
   Workflow PDF Pro, BookLedgerPro und Private Brain V3 über deren Nachzieh-Werkzeug — nur hier ändern, dann Pin erneuern und nachziehen.
   Fassung 1 (Pro-Umbau 13, Klaus 2026-10-30: „Chef legt fest, alle 3“): ein Feld, gleicher Code = eigenes Netz.
   Fassung 2 (Pro-Umbau 14, Klaus 2026-10-31: „Der Chef muss selber den Code eingeben können und das getrennt von den anderen.“
   Antwort auf Frage 1: Beitritts-Zettel):
   - Der Chef legt beim ersten Mal eine Chef-PIN fest (6–12 Ziffern) und dazu den Code. Gespeichert wird von der PIN nur ein
     Prüfwert (PBKDF2-SHA-256, 600 000 Runden, eigenes Salz) im Speicher DIESER App („pro_chef_v1_<Schublade>“), nie die PIN selbst.
   - Ohne Entsperren zeigt der Kasten nur den Zustand: kein Code-Feld, kein Entfernen. Entsperrt (5 Minuten oder bis „Sperren“):
     Code ändern, Beitritts-Zettel erzeugen, Chef-PIN ändern, Entfernen.
   - Mitarbeiter treten mit dem Beitritts-Zettel bei („CHEF1-…“, Code + Prüfwert der Chef-PIN + Prüfsumme). Sie sehen den Code nie;
     ändern oder entfernen geht an ihrem Gerät nur mit der Chef-PIN. Einen NEUEN Zettel des Chefs nehmen sie ohne PIN an (sonst
     müsste der Chef nach jedem Codewechsel an jedes Gerät).
   - Falsche PIN: nach 5 Fehlversuchen Wartezeit (30 s, dann doppelt, höchstens 1 Stunde).
   Grenzen (benannt): wer die App bedient, kann sie deinstallieren oder ihre Daten löschen — die PIN schützt die Einstellung, nicht
   das Gerät. Der Zettel ist der Code in gepackter Form: wer ihn hat, ist im Netz; er gehört nur in vertraute Hände. Der Prüfwert im
   Zettel erlaubt mit viel Rechenzeit das Erraten einer kurzen PIN — eine längere PIN hilft.
   Das Netz selbst ist Modul 23 (Sage, byte-1:1): setNetwork/saveNetwork/applyNetwork, ein ungültiger Code fällt nie still ins
   öffentliche Netz zurück. Keine Emojis, fremder Text bleibt Text. Braucht native/pro-bedienung.js (Kasten, ⓘ, Knopf, Zustand). */
(() => {
  'use strict';
  if (window.ProChefcode) return;
  const FASSUNG = 2;
  const MIN = 12;                                   // wie NETZ_CODE_MIN in Modul 23
  const NAME = 'Chefcode';                          // Name des Netzes in der Einstellung von Modul 23
  const RELAIS_VORGABE = 'wss://relay.family-projekt.de';
  const PIN_MIN = 6, PIN_MAX = 12, PIN_RUNDEN = 600000;
  const OFFEN_MS = 5 * 60 * 1000;                   // so lange bleibt der Chef entsperrt
  const SPERRE_AB = 5, SPERRE_MS = 30000, SPERRE_MAX = 3600000;
  const ZETTEL_KOPF = 'CHEF1-';
  const SPEICHER_PRAEFIX = 'pro_chef_v1_';
  const root = document.documentElement;

  /** Wie Modul 23 (netCodeNorm): Leerzeichen und Bindestriche weg, Großbuchstaben. */
  function normalisieren(code) { return String(code == null ? '' : code).replace(/[\s-]+/g, '').toUpperCase(); }
  /** @returns {{ok:boolean, grund?:string}} */
  function pruefen(code) {
    const n = normalisieren(code);
    if (!n) return { ok: false, grund: 'leer' };
    if (!/^[A-Z0-9]+$/.test(n)) return { ok: false, grund: 'zeichen' };
    if (n.length < MIN) return { ok: false, grund: 'kurz' };
    if (n.length > 120) return { ok: false, grund: 'zeichen' };
    return { ok: true };
  }
  /** Chef-PIN: nur Ziffern, 6–12. */
  function pinPruefen(pin) {
    const p = String(pin == null ? '' : pin).trim();
    if (!p) return { ok: false, grund: 'pinLeer' };
    if (!/^[0-9]+$/.test(p)) return { ok: false, grund: 'pinZiffern' };
    if (p.length < PIN_MIN || p.length > PIN_MAX) return { ok: false, grund: 'pinLaenge' };
    return { ok: true };
  }
  function relais(rdv) {
    try { const st = rdv && typeof rdv.readNetwork === 'function' ? rdv.readNetwork() : null; if (st && st.ok && st.setting && st.setting.relay) return st.setting.relay; } catch { /* Vorgabe */ }
    try { const d = window.SbkimNostrRelay && window.SbkimNostrRelay._meta && window.SbkimNostrRelay._meta.defaultRelays; if (d && d[0]) return d[0]; } catch { /* Vorgabe */ }
    return RELAIS_VORGABE;
  }

  // ---------- Speicher des Prüfwerts (nur Prüfwert, Rolle, Fehlversuche — nie PIN, nie Code) ----------
  function schluessel(rdv) {
    let s = '';
    try { s = String((rdv && rdv._meta && rdv._meta.dbSuffix) || ''); } catch { /* ohne */ }
    return s ? SPEICHER_PRAEFIX + s : SPEICHER_PRAEFIX + 'app';
  }
  function speicher() { try { return window.localStorage || null; } catch { return null; } }
  function chefLesen(rdv) {
    const st = speicher(); if (!st) return null;
    let v; try { v = JSON.parse(st.getItem(schluessel(rdv)) || 'null'); } catch { return null; }
    if (!v || v.v !== 1 || typeof v.s !== 'string' || typeof v.h !== 'string') return null;
    return { v: 1, rolle: v.rolle === 'mitarbeiter' ? 'mitarbeiter' : 'chef', s: v.s, h: v.h, f: Number(v.f) || 0, bis: Number(v.bis) || 0 };
  }
  function chefSchreiben(rdv, rec) {
    const st = speicher(); if (!st) return false;
    try { st.setItem(schluessel(rdv), JSON.stringify({ v: 1, rolle: rec.rolle, s: rec.s, h: rec.h, f: rec.f || 0, bis: rec.bis || 0 })); return true; } catch { return false; }
  }
  function chefLoeschen(rdv) { const st = speicher(); if (st) { try { st.removeItem(schluessel(rdv)); } catch { /* egal */ } } }

  // ---------- Krypto (WebCrypto) ----------
  const b64 = u => { let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
  const ausB64 = t => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const b64u = u => b64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const ausB64u = t => { let s = String(t).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return ausB64(s); };
  async function pinWert(pin, salz) {
    const c = window.crypto && window.crypto.subtle; if (!c) throw new Error('WebCrypto fehlt');
    const roh = await c.importKey('raw', new TextEncoder().encode(String(pin).trim()), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await c.deriveBits({ name: 'PBKDF2', salt: salz, iterations: PIN_RUNDEN, hash: 'SHA-256' }, roh, 256));
  }
  async function pinNeu(pin) {
    const salz = window.crypto.getRandomValues(new Uint8Array(16));
    return { s: b64(salz), h: b64(await pinWert(pin, salz)) };
  }
  async function pinStimmt(pin, rec) {
    const soll = ausB64(rec.h), ist = await pinWert(pin, ausB64(rec.s));
    if (soll.length !== ist.length) return false;
    let d = 0; for (let i = 0; i < soll.length; i++) d |= soll[i] ^ ist[i];
    return d === 0;
  }
  async function pruefsumme(bytes) { return new Uint8Array(await window.crypto.subtle.digest('SHA-256', bytes)).slice(0, 3); }

  // ---------- Entsperrt-Zustand (je Schublade, nur im Arbeitsspeicher) ----------
  const offenBis = new Map();
  const entsperrt = (rdv) => (offenBis.get(schluessel(rdv)) || 0) > Date.now();
  function sperren(rdv) { offenBis.delete(schluessel(rdv)); }
  function wartezeit(rdv) { const rec = chefLesen(rdv); return rec && rec.bis > Date.now() ? rec.bis - Date.now() : 0; }

  /** Entsperrt mit der Chef-PIN. Zählt Fehlversuche, sperrt nach 5 für eine wachsende Zeit. */
  async function entsperren(rdv, pin) {
    const rec = chefLesen(rdv);
    if (!rec) return { ok: false, grund: 'keinePin' };
    if (rec.bis > Date.now()) return { ok: false, grund: 'warten', ms: rec.bis - Date.now() };
    const p = pinPruefen(pin); if (!p.ok) return { ok: false, grund: p.grund };
    let gut = false; try { gut = await pinStimmt(pin, rec); } catch { return { ok: false, grund: 'krypto' }; }
    if (!gut) {
      rec.f += 1;
      if (rec.f >= SPERRE_AB) rec.bis = Date.now() + Math.min(SPERRE_MAX, SPERRE_MS * 2 ** (rec.f - SPERRE_AB));
      chefSchreiben(rdv, rec);
      return { ok: false, grund: 'pinFalsch', ms: rec.bis > Date.now() ? rec.bis - Date.now() : 0 };
    }
    rec.f = 0; rec.bis = 0; chefSchreiben(rdv, rec);
    offenBis.set(schluessel(rdv), Date.now() + OFFEN_MS);
    return { ok: true };
  }

  /** Zustand für die Anzeige: eigen · oeffentlich · ungueltig · fehlt (Modul 23 nicht geladen); dazu pin, rolle, offen. */
  function zustand(rdv) {
    if (!rdv || typeof rdv.saveNetwork !== 'function' || typeof rdv.applyNetwork !== 'function') return { lage: 'fehlt', pin: false, offen: false };
    let gespeichert = null;
    try { const st = typeof rdv.readNetwork === 'function' ? rdv.readNetwork() : null; if (st && st.present) gespeichert = st.ok ? st.setting : { kaputt: true }; } catch { /* egal */ }
    const rec = chefLesen(rdv);
    const extra = { pin: !!rec, rolle: rec ? rec.rolle : '', offen: !!rec && entsperrt(rdv) };
    const lage = String((rdv._meta && rdv._meta.network) || (gespeichert ? 'eigen' : 'oeffentlich'));
    if (lage === 'eigen' || lage === 'wird-abgeleitet') return { lage: 'eigen', chef: !!(gespeichert && gespeichert.name === NAME), name: gespeichert && gespeichert.name || '', ...extra };
    if (lage === 'ungueltig' || (gespeichert && gespeichert.kaputt)) return { lage: 'ungueltig', ...extra };
    return { lage: 'oeffentlich', ...extra };
  }
  // Hat die App vor dem Wechsel geantwortet, antwortet sie im neuen Netz wieder (Modul 23: „die App schaltet das Antwortrecht im
  // neuen Netz wieder ein“). Hat sie nicht, bleibt es aus.
  async function wiederAntworten(rdv, antwortete) {
    if (!antwortete || typeof rdv.enableAnswering !== 'function') return;
    try { await rdv.enableAnswering({}); } catch { /* fail-soft: der Schalter in der App zeigt den Stand */ }
  }
  const hatNetz = rdv => !!(rdv && typeof rdv.saveNetwork === 'function' && typeof rdv.applyNetwork === 'function');
  async function netzSetzen(rdv, code, relay) {
    const antwortete = !!(rdv._meta && rdv._meta.answering);   // Modul 23 beendet beim Netzwechsel den Antwort-Lauscher
    const sv = rdv.saveNetwork({ name: NAME, relay: relay || relais(rdv), code: normalisieren(code), auto: true });
    if (!sv || !sv.ok) return { ok: false, grund: 'speichern', text: sv && sv.reason || '' };
    const r = await Promise.resolve(rdv.applyNetwork(sv.setting)).catch(e => ({ ok: false, reason: String((e && e.message) || e) }));
    if (!r || !r.ok) return { ok: false, grund: 'anwenden', text: r && r.reason || '' };
    await wiederAntworten(rdv, antwortete);
    return { ok: true, lage: 'eigen' };
  }

  /** Chef richtet ein: Chef-PIN (zweimal gleich) und Code. Nur, wenn an diesem Gerät noch keine Chef-PIN steht. */
  async function chefEinrichten(rdv, { pin, pin2, code } = {}) {
    if (!hatNetz(rdv)) return { ok: false, grund: 'fehlt' };
    if (chefLesen(rdv)) return { ok: false, grund: 'pinDa' };
    const pp = pinPruefen(pin); if (!pp.ok) return { ok: false, grund: pp.grund };
    if (String(pin).trim() !== String(pin2 == null ? '' : pin2).trim()) return { ok: false, grund: 'pinUngleich' };
    const z = zustand(rdv);
    const mitCode = !(z.lage === 'eigen' && z.chef && (code == null || code === ''));   // Fassung-1-Netz: nur die PIN dazu
    if (mitCode) { const p = pruefen(code); if (!p.ok) return { ok: false, grund: p.grund }; }
    let wert; try { wert = await pinNeu(pin); } catch { return { ok: false, grund: 'krypto' }; }
    if (!chefSchreiben(rdv, { rolle: 'chef', ...wert })) return { ok: false, grund: 'speichern' };
    if (mitCode) {
      const r = await netzSetzen(rdv, code);
      if (!r.ok) { chefLoeschen(rdv); return r; }
    }
    offenBis.set(schluessel(rdv), Date.now() + OFFEN_MS);
    return { ok: true, lage: 'eigen' };
  }
  /** Setzt oder ändert den Code. Nur entsperrt. Der Code kommt in keiner Rückgabe vor. */
  async function setzen(rdv, code) {
    const p = pruefen(code);
    if (!p.ok) return { ok: false, grund: p.grund };
    if (!hatNetz(rdv)) return { ok: false, grund: 'fehlt' };
    if (!chefLesen(rdv)) return { ok: false, grund: 'keinePin' };
    if (!entsperrt(rdv)) return { ok: false, grund: 'gesperrt' };
    return netzSetzen(rdv, code);
  }
  /** Entfernt Code und Chef-PIN an diesem Gerät: zurück ins öffentliche Netz. Nur entsperrt. */
  async function entfernen(rdv) {
    if (!rdv || typeof rdv.applyNetwork !== 'function') return { ok: false, grund: 'fehlt' };
    if (!chefLesen(rdv)) return { ok: false, grund: 'keinePin' };
    if (!entsperrt(rdv)) return { ok: false, grund: 'gesperrt' };
    const antwortete = !!(rdv._meta && rdv._meta.answering);
    try { if (typeof rdv.clearNetwork === 'function') rdv.clearNetwork(); } catch { /* weiter */ }
    const r = await Promise.resolve(rdv.applyNetwork(null)).catch(e => ({ ok: false, reason: String((e && e.message) || e) }));
    if (!r || !r.ok) return { ok: false, grund: 'anwenden', text: r && r.reason || '' };
    chefLoeschen(rdv); sperren(rdv);
    await wiederAntworten(rdv, antwortete);
    return { ok: true, lage: 'oeffentlich' };
  }
  /** Neue Chef-PIN. Nur entsperrt. Alte Zettel tragen den alten Prüfwert — an Mitarbeiter-Geräten gilt die alte PIN bis zum neuen Zettel. */
  async function pinAendern(rdv, pin, pin2) {
    const rec = chefLesen(rdv);
    if (!rec) return { ok: false, grund: 'keinePin' };
    if (!entsperrt(rdv)) return { ok: false, grund: 'gesperrt' };
    const pp = pinPruefen(pin); if (!pp.ok) return { ok: false, grund: pp.grund };
    if (String(pin).trim() !== String(pin2 == null ? '' : pin2).trim()) return { ok: false, grund: 'pinUngleich' };
    let wert; try { wert = await pinNeu(pin); } catch { return { ok: false, grund: 'krypto' }; }
    if (!chefSchreiben(rdv, { rolle: rec.rolle, ...wert })) return { ok: false, grund: 'speichern' };
    return { ok: true };
  }

  // ---------- Beitritts-Zettel ----------
  /** Baut den Zettel aus dem gespeicherten Code und dem Prüfwert der Chef-PIN. Nur entsperrt und nur im eigenen Netz „Chefcode“. */
  async function zettelBauen(rdv) {
    const rec = chefLesen(rdv);
    if (!rec) return { ok: false, grund: 'keinePin' };
    if (!entsperrt(rdv)) return { ok: false, grund: 'gesperrt' };
    let st = null; try { st = rdv.readNetwork(); } catch { /* unten */ }
    if (!st || !st.ok || !st.setting || st.setting.name !== NAME) return { ok: false, grund: 'keinNetz' };
    const code = normalisieren(st.setting.code), relay = st.setting.relay === RELAIS_VORGABE ? '' : String(st.setting.relay || '');
    const enc = new TextEncoder(), c = enc.encode(code), r = enc.encode(relay), s = ausB64(rec.s), h = ausB64(rec.h);
    if (c.length > 255 || r.length > 255 || s.length !== 16 || h.length !== 32) return { ok: false, grund: 'zettel' };
    const roh = new Uint8Array(1 + 1 + c.length + 16 + 32 + 1 + r.length);
    let i = 0; roh[i++] = 1; roh[i++] = c.length; roh.set(c, i); i += c.length; roh.set(s, i); i += 16; roh.set(h, i); i += 32; roh[i++] = r.length; roh.set(r, i);
    const ps = await pruefsumme(roh), alles = new Uint8Array(roh.length + 3); alles.set(roh); alles.set(ps, roh.length);
    return { ok: true, zettel: ZETTEL_KOPF + b64u(alles) };
  }
  /** Liest einen Zettel (ohne etwas zu ändern). */
  async function zettelLesen(text) {
    const t = String(text == null ? '' : text).replace(/\s+/g, '');
    if (!t) return { ok: false, grund: 'zettelLeer' };
    if (t.slice(0, ZETTEL_KOPF.length).toUpperCase() !== ZETTEL_KOPF) return { ok: false, grund: 'zettelFalsch' };
    let u; try { u = ausB64u(t.slice(ZETTEL_KOPF.length)); } catch { return { ok: false, grund: 'zettelFalsch' }; }
    if (u.length < 1 + 1 + MIN + 48 + 1 + 3 || u[0] !== 1) return { ok: false, grund: 'zettelFalsch' };
    const roh = u.slice(0, u.length - 3), ps = await pruefsumme(roh);
    if (ps[0] !== u[u.length - 3] || ps[1] !== u[u.length - 2] || ps[2] !== u[u.length - 1]) return { ok: false, grund: 'zettelFalsch' };
    const dec = new TextDecoder();
    let i = 1; const cl = roh[i++]; if (i + cl + 48 + 1 > roh.length) return { ok: false, grund: 'zettelFalsch' };
    const code = dec.decode(roh.slice(i, i + cl)); i += cl;
    const s = roh.slice(i, i + 16); i += 16; const h = roh.slice(i, i + 32); i += 32;
    const rl = roh[i++]; if (i + rl !== roh.length) return { ok: false, grund: 'zettelFalsch' };
    const relay = rl ? dec.decode(roh.slice(i, i + rl)) : RELAIS_VORGABE;
    if (!pruefen(code).ok) return { ok: false, grund: 'zettelFalsch' };
    return { ok: true, code, relay, pin: { s: b64(s), h: b64(h) } };
  }
  /** Mitarbeiter tritt bei: Zettel prüfen, Prüfwert der Chef-PIN merken, Netz setzen. Am Chef-Gerät nur entsperrt. */
  async function beitreten(rdv, text) {
    if (!hatNetz(rdv)) return { ok: false, grund: 'fehlt' };
    const alt = chefLesen(rdv);
    if (alt && alt.rolle === 'chef' && !entsperrt(rdv)) return { ok: false, grund: 'gesperrt' };
    const z = await zettelLesen(text);
    if (!z.ok) return z;
    if (!chefSchreiben(rdv, { rolle: alt && alt.rolle === 'chef' ? 'chef' : 'mitarbeiter', ...z.pin })) return { ok: false, grund: 'speichern' };
    const r = await netzSetzen(rdv, z.code, z.relay);
    if (!r.ok) { if (alt) chefSchreiben(rdv, alt); else chefLoeschen(rdv); return r; }
    if (!alt || alt.rolle !== 'chef') sperren(rdv);
    return { ok: true, lage: 'eigen' };
  }

  // ---------- Wörter (de en ru pl ar; fehlt eine Sprache, gilt Deutsch) ----------
  const WORTE = {
    titel:      ['Chefcode', 'Boss code', 'Код руководителя', 'Kod szefa', 'رمز المدير'],
    kurz:       ['Gleicher Code = eigenes Netz deiner Arbeitsplätze. Nur der Chef legt ihn fest.', 'Same code = your own network of workplaces. Only the boss sets it.', 'Один код = своя сеть рабочих мест. Задаёт его только руководитель.', 'Ten sam kod = własna sieć stanowisk. Ustala go tylko szef.', 'نفس الرمز = شبكة خاصة لأماكن عملك. المدير وحده يحدده.'],
    mehr1:      ['Wer in einer Pro-App im selben Chefcode-Netz ist, findet die Dokumente der anderen. Fremde ohne Code sehen es nicht, alles darin ist verschlüsselt. Ohne Code bleibt das öffentliche Netz, dort gehen nur Titel, Datum und Betrag hinaus.',
                 'Pro apps in the same boss-code network find each other\'s documents. Strangers without the code cannot see it; everything in it is encrypted. Without a code the public network stays, where only title, date and amount go out.',
                 'Pro-приложения в одной сети с кодом находят документы друг друга. Чужие без кода её не видят, всё внутри зашифровано. Без кода остаётся общая сеть: туда уходят только название, дата и сумма.',
                 'Aplikacje Pro w tej samej sieci z kodem znajdują nawzajem swoje dokumenty. Obcy bez kodu jej nie widzą, wszystko jest szyfrowane. Bez kodu zostaje sieć publiczna: wychodzą tylko tytuł, data i kwota.',
                 'تطبيقات Pro في نفس شبكة الرمز تجد مستندات بعضها. لا يراها الغرباء دون الرمز، وكل ما فيها مشفّر. دون رمز تبقى الشبكة العامة، ويخرج إليها العنوان والتاريخ والمبلغ فقط.'],
    mehr2:      ['Der Chef legt eine Chef-PIN (6–12 Ziffern) und den Code fest (mindestens 12 Buchstaben oder Ziffern). Mitarbeiter treten mit dem Beitritts-Zettel bei, den der Chef erzeugt: sie sehen den Code nie und können ihn ohne Chef-PIN nicht ändern. Ein neuer Code gilt sofort; die anderen brauchen dann einen neuen Zettel. Die PIN schützt die Einstellung, nicht das Gerät: wer die App bedient, kann sie trotzdem löschen.',
                 'The boss sets a boss PIN (6–12 digits) and the code (at least 12 letters or digits). Staff join with the joining slip the boss creates: they never see the code and cannot change it without the boss PIN. A new code applies at once; the others then need a new slip. The PIN protects the setting, not the device: whoever uses the app can still delete it.',
                 'Руководитель задаёт PIN (6–12 цифр) и код (не менее 12 букв или цифр). Сотрудники присоединяются по листку, который создаёт руководитель: код они не видят и без PIN изменить не могут. Новый код действует сразу; остальным нужен новый листок. PIN защищает настройку, а не устройство.',
                 'Szef ustala PIN szefa (6–12 cyfr) i kod (co najmniej 12 liter lub cyfr). Pracownicy dołączają kartką, którą tworzy szef: kodu nie widzą i bez PIN-u nie mogą go zmienić. Nowy kod działa od razu; pozostali potrzebują nowej kartki. PIN chroni ustawienie, nie urządzenie.',
                 'يحدد المدير رمز PIN (6–12 رقمًا) والرمز (12 حرفًا أو رقمًا على الأقل). ينضم الموظفون بورقة الانضمام التي ينشئها المدير: لا يرون الرمز ولا يستطيعون تغييره دون PIN. الرمز الجديد يسري فورًا؛ ويحتاج الآخرون ورقة جديدة. يحمي PIN الإعداد لا الجهاز.'],
    feld:       ['Chefcode eingeben', 'Enter boss code', 'Введите код', 'Wpisz kod szefa', 'أدخل رمز المدير'],
    feldNeu:    ['Neuer Chefcode', 'New boss code', 'Новый код', 'Nowy kod szefa', 'رمز مدير جديد'],
    pin:        ['Chef-PIN (6–12 Ziffern)', 'Boss PIN (6–12 digits)', 'PIN руководителя (6–12 цифр)', 'PIN szefa (6–12 cyfr)', 'PIN المدير (6–12 رقمًا)'],
    pin2:       ['Chef-PIN wiederholen', 'Repeat boss PIN', 'Повторите PIN', 'Powtórz PIN szefa', 'أعد إدخال PIN'],
    zettelFeld: ['Beitritts-Zettel einfügen (CHEF1-…)', 'Paste joining slip (CHEF1-…)', 'Вставьте листок (CHEF1-…)', 'Wklej kartkę (CHEF1-…)', 'الصق ورقة الانضمام (CHEF1-…)'],
    ichChef:    ['Ich bin der Chef', 'I am the boss', 'Я руководитель', 'Jestem szefem', 'أنا المدير'],
    mitZettel:  ['Mit Zettel beitreten', 'Join with slip', 'Присоединиться по листку', 'Dołącz kartką', 'انضم بالورقة'],
    neuerZettel:['Neuen Zettel übernehmen', 'Use new slip', 'Принять новый листок', 'Użyj nowej kartki', 'استخدم ورقة جديدة'],
    festlegen:  ['Festlegen', 'Set', 'Задать', 'Ustal', 'تحديد'],
    pinFestlegen:['Chef-PIN festlegen', 'Set boss PIN', 'Задать PIN', 'Ustal PIN szefa', 'حدد PIN المدير'],
    beitreten:  ['Beitreten', 'Join', 'Присоединиться', 'Dołącz', 'انضمام'],
    entsperren: ['Entsperren', 'Unlock', 'Разблокировать', 'Odblokuj', 'فتح'],
    sperren:    ['Sperren', 'Lock', 'Заблокировать', 'Zablokuj', 'قفل'],
    uebernehmen:['Übernehmen', 'Apply', 'Применить', 'Zastosuj', 'تطبيق'],
    entfernen:  ['Entfernen', 'Remove', 'Удалить', 'Usuń', 'إزالة'],
    zettel:     ['Beitritts-Zettel', 'Joining slip', 'Листок для входа', 'Kartka dołączenia', 'ورقة الانضمام'],
    kopieren:   ['Kopieren', 'Copy', 'Копировать', 'Kopiuj', 'نسخ'],
    teilen:     ['Teilen', 'Share', 'Поделиться', 'Udostępnij', 'مشاركة'],
    pinAendern: ['Chef-PIN ändern', 'Change boss PIN', 'Сменить PIN', 'Zmień PIN szefa', 'تغيير PIN'],
    zettelSatz: ['Diesen Zettel nur Vertrauten geben (Nachricht, Ausdruck). Wer ihn hat, ist im Netz. Er wird nicht gespeichert.', 'Give this slip only to trusted people (message, printout). Whoever has it is in the network. It is not stored.', 'Давайте листок только доверенным. У кого он есть, тот в сети. Он не сохраняется.', 'Dawaj kartkę tylko zaufanym. Kto ją ma, jest w sieci. Nie jest zapisywana.', 'أعطِ الورقة للموثوقين فقط. من يملكها يكون في الشبكة. لا تُحفظ.'],
    eigen:      ['Eigenes Netz mit Chefcode', 'Own network with boss code', 'Своя сеть с кодом', 'Własna sieć z kodem', 'شبكة خاصة برمز المدير'],
    eigenChef:  ['Eigenes Netz mit Chefcode – dieses Gerät gehört dem Chef', 'Own network with boss code – this is the boss device', 'Своя сеть с кодом – устройство руководителя', 'Własna sieć z kodem – urządzenie szefa', 'شبكة خاصة برمز المدير – جهاز المدير'],
    eigenMit:   ['Eigenes Netz mit Chefcode – beigetreten mit Zettel', 'Own network with boss code – joined with slip', 'Своя сеть с кодом – вход по листку', 'Własna sieć z kodem – dołączono kartką', 'شبكة خاصة برمز المدير – انضمام بالورقة'],
    eigenOhnePin:['Eigenes Netz mit Chefcode – noch ohne Chef-PIN. Der Chef legt sie hier einmal fest.', 'Own network with boss code – no boss PIN yet. The boss sets it here once.', 'Своя сеть с кодом – PIN ещё не задан. Руководитель задаёт его здесь один раз.', 'Własna sieć z kodem – bez PIN-u szefa. Szef ustala go tu raz.', 'شبكة خاصة برمز المدير – دون PIN بعد. يحدده المدير هنا مرة واحدة.'],
    eigenAnders:['Eigenes Netz „{n}“ (aus dem Mycel-Fenster)', 'Own network “{n}” (from the mycelium window)', 'Своя сеть «{n}» (из окна мицелия)', 'Własna sieć „{n}” (z okna grzybni)', 'شبكة خاصة «{n}» (من نافذة الميسيليوم)'],
    oeffentlich:['Öffentliches Netz (kein Chefcode)', 'Public network (no boss code)', 'Общая сеть (без кода)', 'Sieć publiczna (bez kodu)', 'شبكة عامة (دون رمز)'],
    offen:      ['Entsperrt für 5 Minuten.', 'Unlocked for 5 minutes.', 'Разблокировано на 5 минут.', 'Odblokowane na 5 minut.', 'مفتوح لمدة 5 دقائق.'],
    ungueltig:  ['Netz-Einstellung ungültig – es wird nichts gesendet. Chefcode neu festlegen oder entfernen.', 'Network setting invalid – nothing is sent. Set the boss code again or remove it.', 'Настройка сети неверна – ничего не отправляется. Задайте код заново или удалите.', 'Ustawienie sieci nieprawidłowe – nic nie jest wysyłane. Ustal kod ponownie lub usuń.', 'إعداد الشبكة غير صالح – لا يُرسل شيء. حدد الرمز من جديد أو أزله.'],
    fehlt:      ['Das Mycel ist in dieser App nicht geladen.', 'The mycelium is not loaded in this app.', 'Мицелий в этом приложении не загружен.', 'Grzybnia nie jest załadowana w tej aplikacji.', 'الميسيليوم غير محمّل في هذا التطبيق.'],
    leer:       ['Bitte einen Code eingeben.', 'Please enter a code.', 'Введите код.', 'Wpisz kod.', 'أدخل رمزًا.'],
    kurzFehler: ['Zu kurz: mindestens 12 Buchstaben oder Ziffern.', 'Too short: at least 12 letters or digits.', 'Слишком коротко: не менее 12 букв или цифр.', 'Za krótki: co najmniej 12 liter lub cyfr.', 'قصير جدًا: 12 حرفًا أو رقمًا على الأقل.'],
    zeichen:    ['Nur Buchstaben A–Z und Ziffern (Leerzeichen und Bindestriche zählen nicht).', 'Only letters A–Z and digits (spaces and dashes do not count).', 'Только буквы A–Z и цифры (пробелы и дефисы не считаются).', 'Tylko litery A–Z i cyfry (spacje i myślniki się nie liczą).', 'أحرف A–Z وأرقام فقط (المسافات والشرطات لا تُحتسب).'],
    pinLeer:    ['Bitte die Chef-PIN eingeben.', 'Please enter the boss PIN.', 'Введите PIN.', 'Wpisz PIN szefa.', 'أدخل PIN المدير.'],
    pinZiffern: ['Die Chef-PIN besteht nur aus Ziffern.', 'The boss PIN has digits only.', 'PIN состоит только из цифр.', 'PIN składa się tylko z cyfr.', 'يتكوّن PIN من أرقام فقط.'],
    pinLaenge:  ['Die Chef-PIN hat 6 bis 12 Ziffern.', 'The boss PIN has 6 to 12 digits.', 'PIN содержит от 6 до 12 цифр.', 'PIN ma od 6 do 12 cyfr.', 'يتكوّن PIN من 6 إلى 12 رقمًا.'],
    pinUngleich:['Die beiden PINs sind nicht gleich.', 'The two PINs differ.', 'PIN не совпадают.', 'PIN-y się różnią.', 'الرمزان غير متطابقين.'],
    pinFalsch:  ['Chef-PIN falsch.', 'Wrong boss PIN.', 'Неверный PIN.', 'Błędny PIN szefa.', 'PIN خاطئ.'],
    pinDa:      ['An diesem Gerät gibt es schon eine Chef-PIN. Erst entsperren.', 'This device already has a boss PIN. Unlock first.', 'На устройстве уже есть PIN. Сначала разблокируйте.', 'To urządzenie ma już PIN. Najpierw odblokuj.', 'لهذا الجهاز PIN بالفعل. افتحه أولًا.'],
    warten:     ['Zu viele Fehlversuche. Bitte {s} Sekunden warten.', 'Too many wrong tries. Please wait {s} seconds.', 'Слишком много ошибок. Подождите {s} с.', 'Za dużo błędów. Odczekaj {s} s.', 'محاولات خاطئة كثيرة. انتظر {s} ثانية.'],
    gesperrt:   ['Erst mit der Chef-PIN entsperren.', 'Unlock with the boss PIN first.', 'Сначала разблокируйте PIN.', 'Najpierw odblokuj PIN-em szefa.', 'افتح بـ PIN المدير أولًا.'],
    keinePin:   ['Noch keine Chef-PIN an diesem Gerät.', 'No boss PIN on this device yet.', 'На устройстве ещё нет PIN.', 'Brak PIN-u szefa na tym urządzeniu.', 'لا يوجد PIN على هذا الجهاز بعد.'],
    keinNetz:   ['Kein Chefcode-Netz gesetzt.', 'No boss-code network set.', 'Сеть с кодом не задана.', 'Brak sieci z kodem.', 'لم تُحدَّد شبكة الرمز.'],
    zettelLeer: ['Bitte den Zettel einfügen.', 'Please paste the slip.', 'Вставьте листок.', 'Wklej kartkę.', 'الصق الورقة.'],
    zettelFalsch:['Das ist kein gültiger Beitritts-Zettel (vielleicht unvollständig kopiert).', 'This is not a valid joining slip (maybe copied incompletely).', 'Это не действительный листок (возможно, скопирован не полностью).', 'To nie jest ważna kartka (może skopiowana niecała).', 'هذه ليست ورقة انضمام صالحة (ربما نُسخت ناقصة).'],
    gesetzt:    ['Chefcode übernommen. Bitte „Verbinden“ im Mycel, falls noch nicht verbunden.', 'Boss code applied. Please “Connect” in the mycelium if not connected yet.', 'Код применён. Нажмите «Подключиться» в мицелии, если ещё не подключены.', 'Kod zastosowany. Kliknij „Połącz” w grzybni, jeśli jeszcze nie ma połączenia.', 'تم تطبيق الرمز. اضغط «اتصال» في الميسيليوم إن لم تكن متصلًا بعد.'],
    beigetreten:['Beigetreten. Bitte „Verbinden“ im Mycel, falls noch nicht verbunden.', 'Joined. Please “Connect” in the mycelium if not connected yet.', 'Вы присоединились. Нажмите «Подключиться» в мицелии.', 'Dołączono. Kliknij „Połącz” w grzybni.', 'تم الانضمام. اضغط «اتصال» في الميسيليوم.'],
    pinGesetzt: ['Chef-PIN festgelegt.', 'Boss PIN set.', 'PIN задан.', 'PIN szefa ustalony.', 'تم تحديد PIN.'],
    pinGeaendert:['Chef-PIN geändert. An den anderen Geräten gilt sie erst mit einem neuen Zettel.', 'Boss PIN changed. Other devices get it only with a new slip.', 'PIN изменён. На других устройствах он действует только с новым листком.', 'PIN zmieniony. Inne urządzenia dostaną go dopiero z nową kartką.', 'تغيّر PIN. تحصل عليه الأجهزة الأخرى بورقة جديدة فقط.'],
    kopiert:    ['Zettel kopiert.', 'Slip copied.', 'Листок скопирован.', 'Kartka skopiowana.', 'نُسخت الورقة.'],
    weg:        ['Chefcode und Chef-PIN an diesem Gerät entfernt. Wieder im öffentlichen Netz.', 'Boss code and PIN removed from this device. Back in the public network.', 'Код и PIN удалены с устройства. Снова в общей сети.', 'Kod i PIN usunięte z urządzenia. Znów w sieci publicznej.', 'أُزيل الرمز وPIN من هذا الجهاز. عدت إلى الشبكة العامة.'],
    fehler:     ['Das ging nicht: {e}', 'That did not work: {e}', 'Не получилось: {e}', 'Nie udało się: {e}', 'لم ينجح ذلك: {e}']
  };
  const SPRACHEN = ['de', 'en', 'ru', 'pl', 'ar'];
  const sprache = () => Math.max(0, SPRACHEN.indexOf(String(root.lang || 'de').slice(0, 2).toLowerCase()));
  function wort(s, werte = {}) {
    const zeile = WORTE[s]; if (!zeile) return '';
    return String(zeile[sprache()] || zeile[0]).replace(/\{(\w+)\}/g, (_, k) => (k in werte ? String(werte[k]) : ''));
  }
  const GRUND = { leer: 'leer', kurz: 'kurzFehler', zeichen: 'zeichen', fehlt: 'fehlt', pinLeer: 'pinLeer', pinZiffern: 'pinZiffern',
    pinLaenge: 'pinLaenge', pinUngleich: 'pinUngleich', pinFalsch: 'pinFalsch', pinDa: 'pinDa', gesperrt: 'gesperrt', keinePin: 'keinePin',
    keinNetz: 'keinNetz', zettelLeer: 'zettelLeer', zettelFalsch: 'zettelFalsch' };
  function satz(r) {
    if (r.grund === 'warten' || (r.grund === 'pinFalsch' && r.ms)) return (r.grund === 'pinFalsch' ? wort('pinFalsch') + ' ' : '') + wort('warten', { s: Math.ceil((r.ms || 0) / 1000) });
    return GRUND[r.grund] ? wort(GRUND[r.grund]) : wort('fehler', { e: r.text || r.grund });
  }
  function el(tag, klasse, text) { const n = document.createElement(tag); if (klasse) n.className = klasse; if (text != null) n.textContent = text; return n; }
  function geheimFeld(platz, daten, ziffern) {
    const f = el('input', 'pro-ue-eingabe');
    f.type = 'password'; f.autocomplete = 'off'; f.spellcheck = false; f.placeholder = platz; f.setAttribute('aria-label', platz);
    if (ziffern) { f.inputMode = 'numeric'; f.maxLength = PIN_MAX; } else f.setAttribute('autocapitalize', 'characters');
    f.dataset[daten] = ''; f.dataset.keinMikro = ''; f.dataset.keinStrich = '';
    return f;
  }

  /**
   * Baut den Kasten „Chefcode“. Der Entsperrt-Zustand lebt außerhalb des Kastens (eine App darf den Kasten neu bauen).
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
    const bereich = el('div', 'pro-cc-bereich');
    const meldung = el('p', 'pro-ue-status'); meldung.setAttribute('role', 'status'); meldung.dataset.proCcMeldung = '';
    k.rumpf.append(kurz, lage, bereich, meldung);
    let laeuft = false, form = '', zettelText = '', uhr = 0;

    const reihe = (...kinder) => { const r = el('div', 'pro-ue-feld'); r.append(...kinder); return r; };
    const knopf = (w, name, f, haupt) => P.knopf(wort(w), { haupt: !!haupt, name, beiTipp: () => los(f) });
    async function los(f) {
      if (laeuft) return;
      laeuft = true; for (const b of bereich.querySelectorAll('button,input,textarea')) b.disabled = true;
      let r;
      try { r = await f(); } catch (e) { r = { ok: false, grund: 'x', text: String((e && e.message) || e) }; } finally { laeuft = false; }
      for (const i of bereich.querySelectorAll('input[type=password]')) i.value = '';   // weder Code noch PIN bleiben im Bild
      if (r && r.satz !== undefined) meldung.textContent = r.satz; else if (r && !r.ok) meldung.textContent = satz(r);
      zeichnen();
      if (r && r.wechsel) {
        if (typeof o.beiWechsel === 'function') { try { await o.beiWechsel(r.wechsel); } catch { /* fail-soft */ } }
        document.dispatchEvent(new CustomEvent('pro-chefcode', { detail: { lage: zustand(rdv()).lage } }));
      }
    }
    const wert = (sel) => { const n = bereich.querySelector(sel); return n ? n.value : ''; };

    function zeichnen() {
      clearTimeout(uhr);
      const z = zustand(rdv());
      if (zettelText && !z.offen) zettelText = '';
      lage.dataset.proCcLage = z.lage;
      k.element.dataset.proCcRolle = z.pin ? (z.rolle || 'chef') : '';
      k.element.dataset.proCcOffen = z.offen ? 'ja' : 'nein';
      let s;
      if (z.lage === 'eigen') s = !z.chef && z.name ? wort('eigenAnders', { n: z.name }) : !z.pin ? wort('eigenOhnePin') : wort(z.rolle === 'mitarbeiter' ? 'eigenMit' : 'eigenChef');
      else s = wort(z.lage === 'oeffentlich' ? 'oeffentlich' : z.lage);
      const punkt = el('span', 'pro-zustand'); punkt.dataset.proZustand = z.lage === 'eigen' ? 'offen' : 'zu';
      punkt.append(el('span', 'pro-punkt'), document.createTextNode(s));
      lage.replaceChildren(punkt);
      bereich.replaceChildren();
      if (z.lage === 'fehlt') return z;

      if (!z.pin) {
        // Noch keine Chef-PIN an diesem Gerät: Chef richtet ein (oder legt zu einem Fassung-1-Netz nur die PIN fest), Mitarbeiter tritt bei.
        const nurPin = z.lage === 'eigen' && z.chef;
        const wahl = reihe(knopf(nurPin ? 'pinFestlegen' : 'ichChef', 'chefcode-chef', async () => { form = 'chef'; meldung.textContent = ''; return null; }, form !== 'chef'),
          knopf('mitZettel', 'chefcode-zettel', async () => { form = 'zettel'; meldung.textContent = ''; return null; }));
        bereich.append(wahl);
        if (form === 'chef') {
          const p1 = geheimFeld(wort('pin'), 'proCcPin', true), p2 = geheimFeld(wort('pin2'), 'proCcPin2', true);
          const teile = [p1, p2];
          if (!nurPin) teile.push(geheimFeld(wort('feld'), 'proCcFeld', false));
          const ok = knopf('festlegen', 'chefcode-uebernehmen', async () => {
            const r = await chefEinrichten(rdv(), { pin: wert('[data-pro-cc-pin]'), pin2: wert('[data-pro-cc-pin2]'), code: nurPin ? '' : wert('[data-pro-cc-feld]') });
            if (!r.ok) return r;
            form = ''; return { ok: true, satz: wort(nurPin ? 'pinGesetzt' : 'gesetzt'), wechsel: nurPin ? null : 'eigen' };
          }, true);
          teile.push(ok); bereich.append(reihe(...teile));
        } else if (form === 'zettel') {
          const f = geheimFeld(wort('zettelFeld'), 'proCcZettel', false); f.type = 'text'; f.removeAttribute('autocapitalize');
          bereich.append(reihe(f, knopf('beitreten', 'chefcode-beitreten', async () => {
            const r = await beitreten(rdv(), wert('[data-pro-cc-zettel]')); if (!r.ok) return r;
            form = ''; return { ok: true, satz: wort('beigetreten'), wechsel: 'eigen' };
          }, true)));
        }
        return z;
      }

      if (!z.offen) {
        // Gesperrt: nur Zustand, Entsperren mit der Chef-PIN; Mitarbeiter dürfen einen neuen Zettel des Chefs übernehmen.
        const p = geheimFeld(wort('pin'), 'proCcPin', true);
        p.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); bereich.querySelector('[data-pro-knopf="chefcode-entsperren"]').click(); } });
        bereich.append(reihe(p, knopf('entsperren', 'chefcode-entsperren', async () => {
          const r = await entsperren(rdv(), wert('[data-pro-cc-pin]')); return r.ok ? { ok: true, satz: wort('offen') } : r;
        })));
        if (z.rolle === 'mitarbeiter') {
          if (form === 'zettel') {
            const f = geheimFeld(wort('zettelFeld'), 'proCcZettel', false); f.type = 'text'; f.removeAttribute('autocapitalize');
            bereich.append(reihe(f, knopf('beitreten', 'chefcode-beitreten', async () => {
              const r = await beitreten(rdv(), wert('[data-pro-cc-zettel]')); if (!r.ok) return r;
              form = ''; return { ok: true, satz: wort('beigetreten'), wechsel: 'eigen' };
            }, true)));
          } else bereich.append(reihe(knopf('neuerZettel', 'chefcode-zettel', async () => { form = 'zettel'; meldung.textContent = ''; return null; })));
        }
        return z;
      }

      // Entsperrt: Code ändern, Zettel erzeugen, PIN ändern, Entfernen, Sperren.
      const code = geheimFeld(wort('feldNeu'), 'proCcFeld', false);
      code.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); bereich.querySelector('[data-pro-knopf="chefcode-uebernehmen"]').click(); } });
      bereich.append(reihe(code, knopf('uebernehmen', 'chefcode-uebernehmen', async () => {
        const r = await setzen(rdv(), wert('[data-pro-cc-feld]')); if (!r.ok) return r;
        zettelText = ''; return { ok: true, satz: wort('gesetzt'), wechsel: 'eigen' };
      })));
      const aktionen = reihe();
      if (z.lage === 'eigen' && z.chef) aktionen.append(knopf('zettel', 'chefcode-zettel-bauen', async () => {
        const r = await zettelBauen(rdv()); if (!r.ok) return r; zettelText = r.zettel; return { ok: true, satz: '' };
      }, true));
      aktionen.append(knopf('pinAendern', 'chefcode-pin-aendern', async () => { form = form === 'pin' ? '' : 'pin'; return null; }),
        knopf('entfernen', 'chefcode-entfernen', async () => { const r = await entfernen(rdv()); if (!r.ok) return r; form = ''; zettelText = ''; return { ok: true, satz: wort('weg'), wechsel: 'oeffentlich' }; }),
        knopf('sperren', 'chefcode-sperren', async () => { sperren(rdv()); form = ''; zettelText = ''; return { ok: true, satz: '' }; }));
      bereich.append(aktionen);
      if (form === 'pin') {
        bereich.append(reihe(geheimFeld(wort('pin'), 'proCcPin', true), geheimFeld(wort('pin2'), 'proCcPin2', true),
          knopf('festlegen', 'chefcode-pin-neu', async () => {
            const r = await pinAendern(rdv(), wert('[data-pro-cc-pin]'), wert('[data-pro-cc-pin2]')); if (!r.ok) return r;
            form = ''; return { ok: true, satz: wort('pinGeaendert') };
          })));
      }
      if (zettelText) {
        const box = el('div', 'pro-cc-zettel'); box.dataset.proCcZettelAusgabe = '';
        const t = el('textarea', 'pro-ue-eingabe'); t.readOnly = true; t.rows = 3; t.value = zettelText; t.dataset.keinMikro = ''; t.dataset.keinStrich = '';
        t.setAttribute('aria-label', wort('zettel')); t.addEventListener('focus', () => t.select());
        const kop = P.knopf(wort('kopieren'), { name: 'chefcode-kopieren', beiTipp: async () => {
          try { await navigator.clipboard.writeText(zettelText); meldung.textContent = wort('kopiert'); } catch { t.focus(); t.select(); }
        } });
        const reiheZ = reihe(kop);
        if (navigator.share) reiheZ.append(P.knopf(wort('teilen'), { name: 'chefcode-teilen', beiTipp: () => { navigator.share({ title: wort('zettel'), text: zettelText }).catch(() => {}); } }));
        box.append(el('p', 'pro-ue-kurz', wort('zettelSatz')), t, reiheZ);
        bereich.append(box);
      }
      // Nach Ablauf der 5 Minuten sperrt der Kasten sich selbst neu.
      const rest = (offenBis.get(schluessel(rdv())) || 0) - Date.now();
      if (rest > 0) uhr = setTimeout(() => { if (k.element.isConnected) zeichnen(); }, rest + 50);
      return z;
    }
    zeichnen();
    return { element: k.element, zeichnen };
  }

  /** Steht ein eigenes Netz (Chefcode oder eigenes Netz aus dem Mycel-Fenster)? Für Schalter, die nur dort gelten dürfen. */
  const imEigenenNetz = (rdv = window.SbkimRendezvous) => zustand(rdv).lage === 'eigen';

  window.ProChefcode = Object.freeze({ FASSUNG, MIN, PIN_MIN, PIN_MAX, NAME, normalisieren, pruefen, pinPruefen, zustand, chefEinrichten,
    entsperren, sperren, setzen, entfernen, pinAendern, zettelBauen, zettelLesen, beitreten, imEigenenNetz, wort, kasten });
})();
