/* Prüfen und Einordnen nur auf Knopfdruck (Leitfaden § 3, Klaus 2026-10-28, Befunde 7 und 9 aus Schritt E).
   1 · Einordnen (Bedeutung) startete bei jedem Öffnen und kostete Minuten. Der Kern lädt das Modell beim Start, wenn die
       Bedeutungssuche an ist, und ordnet danach alle Dokumente ein. In der Pro-App wartet das Einordnen jetzt, bis der
       Knopf „Einordnen“ getippt ist (je Sitzung einmal; danach kommen neue Dokumente wie bisher von selbst dazu).
       Suchen geht schon vorher: was eingeordnet ist, wird gefunden. Der Kern bleibt unverändert — angehalten wird an der
       einen Stelle, an der er rechnet (SbkimEmbedding.embedPassageBatch); die Frage selbst (embedQuery) läuft frei.
   2 · „Alle prüfen“ fragt vorher „Alle N prüfen?“ — ohne Auswahl gilt es für alle. Mit Auswahl (langer Druck) steht in
       der Auswahl-Leiste „Prüfen“ für genau die gewählten Dokumente.
   3 · Durchgereichter Tipp: ein Start-Knopf reagiert nur auf einen Tipp, der AUF IHM begonnen hat. Auf Android landet der
       Klick nach dem Loslassen dort, wo der Finger jetzt ist — schließt sich beim Antippen ein Fenster oder rutscht die
       Liste (Auswahl-Leiste erscheint), träfe er den Knopf darunter. Tastatur (Enter, ohne Zeiger) bleibt erlaubt. */
(() => {
  'use strict';
  if (!window.Capacitor?.isNativePlatform?.()) return;
  const W = {
    einordnen: ['Einordnen', 'Index', 'Индексировать', 'فهرسة'],
    wartet: ['Bedeutung: {n} Dokument(e) noch nicht eingeordnet. Suchen geht schon.', 'Meaning: {n} document(s) not indexed yet. Search already works.', 'Смысл: {n} док. ещё не проиндексировано. Поиск уже работает.', 'المعنى: {n} مستند لم يُفهرس بعد. البحث يعمل.'],
    frageEin: ['{n} Dokument(e) einordnen?', 'Index {n} document(s)?', 'Проиндексировать {n} док.?', 'فهرسة {n} مستند؟'],
    frageEinText: ['Läuft im Hintergrund, Dokument für Dokument. Du kannst weiterarbeiten; nach einer Unterbrechung geht es an derselben Stelle weiter.', 'Runs in the background, document by document. You can keep working; after an interruption it continues where it stopped.', 'Идёт в фоне, документ за документом. Можно продолжать работу.', 'يعمل في الخلفية مستنداً تلو الآخر. يمكنك متابعة العمل.'],
    dauer: [' Gemessen: ≈ {s} s je Seite, zusammen ≈ {m} min.', ' Measured: ≈ {s} s per page, about {m} min in total.', ' Измерено: ≈ {s} с на страницу, всего ≈ {m} мин.', ' المقاس: ≈ {s} ث للصفحة، المجموع ≈ {m} د.'],
    fragePruef: ['Alle {n} noch nicht geprüften Dokumente prüfen?', 'Check all {n} unchecked documents?', 'Проверить все {n} непроверенных документов?', 'فحص كل المستندات غير المفحوصة ({n})؟'],
    fragePruefText: ['Läuft Dokument für Dokument; „Abbrechen“ hält nach dem laufenden an.', 'Runs document by document; “Cancel” stops after the current one.', 'Документ за документом; «Отмена» остановит после текущего.', 'مستنداً تلو الآخر؛ «إلغاء» يتوقف بعد الحالي.'],
    alle: ['Alle prüfen', 'Check all', 'Проверить все', 'فحص الكل'],
    pruefen: ['Prüfen', 'Check', 'Проверить', 'فحص'],
    pruefenWahl: ['{n} gewählte prüfen', 'Check {n} selected', 'Проверить выбранные ({n})', 'فحص المحدد ({n})'],
    nichts: ['Unter den gewählten ist nichts mehr zu prüfen.', 'Nothing left to check among the selected.', 'Среди выбранных проверять нечего.', 'لا شيء للفحص بين المحدد.'],
    abbrechen: ['Abbrechen', 'Cancel', 'Отмена', 'إلغاء'],
    beschreiben: ['Beschreiben', 'Describe', 'Описать', 'وصف'],
    bildWartet: ['Bildbeschreibung: {n} Foto(s) noch nicht beschrieben.', 'Image description: {n} photo(s) not described yet.', 'Описание фото: {n} ещё не описано.', 'وصف الصور: {n} صورة لم تُوصف بعد.'],
    bildBereit: ['Bildbeschreibung an. Das Bildmodell lädt erst nach „Beschreiben“.', 'Image description on. The image model loads only after “Describe”.', 'Описание фото включено. Модель загрузится после «Описать».', 'وصف الصور مفعّل. يُحمَّل النموذج بعد «وصف».'],
    frageBild: ['{n} Foto(s) beschreiben?', 'Describe {n} photo(s)?', 'Описать {n} фото?', 'وصف {n} صورة؟'],
    frageBildText: ['Lädt das Bildmodell (einmalig rund 256 MB, danach aus dem Vorrat) und beschreibt Foto für Foto auf dem Gerät. Du kannst weiterarbeiten; die Fotos verlassen das Gerät nicht.', 'Loads the image model (about 256 MB once, then from storage) and describes photo by photo on the device. You can keep working; photos never leave the device.', 'Загружает модель (≈ 256 МБ один раз) и описывает фото на устройстве.', 'يحمّل النموذج (≈ 256 ميغابايت مرة واحدة) ويصف الصور على الجهاز.'],
    hgPruefen: ['Prüfen läuft', 'Checking', 'Идёт проверка', 'الفحص قيد التشغيل'],
    hgEinordnen: ['Einordnen läuft', 'Indexing', 'Идёт индексирование', 'الفهرسة قيد التشغيل'],
    hgBeschreiben: ['Bildbeschreibung läuft', 'Describing photos', 'Идёт описание фото', 'وصف الصور قيد التشغيل'],
    hgPruefStand: ['Dokument {i} von {n}', 'Document {i} of {n}', 'Документ {i} из {n}', 'المستند {i} من {n}'],
    hgEinStand: ['Dokument {i} von {n} · {name}', 'Document {i} of {n} · {name}', 'Документ {i} из {n} · {name}', 'المستند {i} من {n} · {name}'],
    hgBildStand: ['Foto {i} von {n}', 'Photo {i} of {n}', 'Фото {i} из {n}', 'الصورة {i} من {n}'],
    hgLaedt: ['Modell wird geladen', 'Loading model', 'Загрузка модели', 'تحميل النموذج']
  };
  const t = (k, v = {}) => String(W[k][Math.max(0, ['de', 'en', 'ru', 'ar'].indexOf(document.documentElement.lang))] || W[k][0]).replace(/\{(\w+)\}/g, (_, x) => String(v[x] ?? ''));
  const P = () => window.ProBedienung;
  // wie pruefbar() im Kern: noch ohne Befund, keine eigene Ausgabe (Übersetzung, Teil)
  const pruefbar = d => d && !d.pruefung && !['uebersetzung', 'teil'].includes(d.quelle);
  const gewaehlt = () => [...document.querySelectorAll('#dokGitter .dok.gewaehlt[data-id]')].map(e => e.dataset.id);

  // ---------- 3 · Tipp-Schutz für Start-Knöpfe ----------
  const START = '[data-pruef-alle-los],[data-wpp-einordnen],[data-wpp-pruefen-wahl],[data-wpp-beschreiben],[data-bed-an],#siErstellen';
  let unten = null;
  document.addEventListener('pointerdown', e => { unten = { ziel: e.target, zeit: e.timeStamp }; }, true);
  document.addEventListener('click', e => {
    const k = e.target.closest?.(START); if (!k) return;
    if (e.detail === 0) return;                          // Tastatur oder programmatisch (unser eigener Weg): kein Zeiger
    if (unten && k.contains(unten.ziel)) return;         // der Tipp begann auf diesem Knopf
    e.preventDefault(); e.stopImmediatePropagation();
    k.dataset.wppTippVerworfen = String(Number(k.dataset.wppTippVerworfen || 0) + 1);
  }, true);

  // ---------- kleine Frage als natives Fenster mit einem farbigen Knopf ----------
  function frage(titel, text, ja) {
    return new Promise(res => {
      const d = document.createElement('dialog'); d.className = 'native-vault-dialog'; d.dataset.keinUe = ''; d.dataset.wppFrage = '';
      const h = document.createElement('h2'), p = document.createElement('p'), z = document.createElement('div'); z.className = 'pro-knoepfe';
      h.textContent = titel; p.textContent = text; d.append(h, p, z);
      const fertig = wert => { d.close(); d.remove(); res(wert); };
      const mk = (txt, haupt, wert) => { const b = P() ? P().knopf(txt, { haupt, beiTipp: () => fertig(wert) }) : Object.assign(document.createElement('button'), { className: 'knopf', textContent: txt, onclick: () => fertig(wert) }); b.dataset.wppAntwort = wert ? 'ja' : 'nein'; z.append(b); };
      mk(t('abbrechen'), false, false); mk(ja, true, true);
      d.oncancel = ev => { ev.preventDefault(); fertig(false); };
      document.body.append(d); d.showModal();
    });
  }

  // ---------- 1 · Einordnen erst auf Knopfdruck ----------
  let frei = false, warten = [], rechnet = 0, zuletzt = 0;   // rechnet/zuletzt: läuft gerade ein Einordnen (auch das Nachholen im Zustand „bereit“)?
  const freigeben = () => { frei = true; const w = warten; warten = []; for (const r of w) r(); zeichnen(); };
  function binden(emb) {
    if (!emb || emb.__wppGebunden || typeof emb.embedPassageBatch !== 'function') return emb;
    const echt = emb.embedPassageBatch.bind(emb);
    emb.embedPassageBatch = async (...a) => {
      if (!frei) { await new Promise(r => { warten.push(r); zeichnen(); }); }
      rechnet++; try { return await echt(...a); } finally { rechnet--; zuletzt = Date.now(); }
    };
    Object.defineProperty(emb, '__wppGebunden', { value: true });
    return emb;
  }
  let emb = window.SbkimEmbedding;
  Object.defineProperty(window, 'SbkimEmbedding', { configurable: true, get: () => emb, set: v => { emb = binden(v); } });
  binden(emb);
  const offenZahl = () => {
    const w = window.__wfpdf; if (!w) return 0;
    return w.S.docs.filter(d => { const e = w.bedeutung.BED.vek.get(d.id); return !e || e.st.length < e.n; }).length;
  };
  function zeichnen() {
    const l = document.getElementById('bedeutungLeiste'); if (!l) return;
    if (frei || !warten.length) { if (l.dataset.wppWartet) { delete l.dataset.wppWartet; window.__wfpdf?.bedeutung?.bedeutungZeichnen?.(); } return; }
    const n = offenZahl(), sig = 'w' + n + document.documentElement.lang;
    if (l.dataset.wppWartet === sig && l.querySelector('[data-wpp-einordnen]')) return;
    l.dataset.wppWartet = sig; l.dataset.keinUe = '';
    const s = document.createElement('span'); s.className = 'bed-t'; s.dataset.bedText = ''; s.textContent = t('wartet', { n });
    const b = P() ? P().knopf(t('einordnen'), { haupt: true }) : Object.assign(document.createElement('button'), { className: 'knopf klein', textContent: t('einordnen') });
    b.type = 'button'; b.dataset.wppEinordnen = '';
    b.addEventListener('click', async () => {
      const w = window.__wfpdf, n = offenZahl(), ms = Number(w?.EINST?.bedMsStueck) || 0;
      const seiten = w ? w.S.docs.reduce((a, d) => a + (d.pages?.length || 1), 0) : 0;
      // Zeit nur, wenn schon gemessen (Kern: bedMsStueck je Abschnitt; grob ≈ 4 Abschnitte je Seite) — sonst kein Raten.
      const dauer = ms ? t('dauer', { s: (ms * 4 / 1000).toFixed(1).replace('.', ','), m: Math.max(1, Math.round(ms * 4 * seiten / 60000)) }) : '';
      if (await frage(t('frageEin', { n }), t('frageEinText') + dauer, t('einordnen'))) freigeben();
    });
    l.replaceChildren(s, b);
  }
  new MutationObserver(() => { if (!frei && warten.length) zeichnen(); }).observe(document.documentElement, { childList: true, subtree: true });

  // ---------- 2 · „Alle prüfen“ fragt vorher; „Prüfen“ für die Auswahl ----------
  let durch = false;
  document.addEventListener('click', e => {
    const k = e.target.closest?.('[data-pruef-alle-los]'); if (!k || durch) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const w = window.__wfpdf, n = w ? w.S.docs.filter(pruefbar).length : 0;
    void frage(t('fragePruef', { n: n || '' }).replace('  ', ' '), t('fragePruefText'), t('alle')).then(ja => {
      if (!ja || !k.isConnected) return; durch = true; try { k.click(); } finally { durch = false; }
    });
  }, true);
  function wahlKnopf() {
    const leiste = document.getElementById('wahlLeiste'); if (!leiste) return;
    let b = leiste.querySelector('[data-wpp-pruefen-wahl]');
    const ids = gewaehlt();
    if (!b) {
      b = P() ? P().knopf(t('pruefen')) : Object.assign(document.createElement('button'), { className: 'knopf', textContent: t('pruefen') });
      b.type = 'button'; b.dataset.wppPruefenWahl = ''; b.dataset.keinUe = '';
      b.addEventListener('click', async () => {
        const ww = window.__wfpdf; if (!ww) return;
        const offen = gewaehlt().filter(id => pruefbar(ww.S.docs.find(x => x.id === id)));
        if (!offen.length) { b.title = t('nichts'); return; }
        wahl = { i: 0, n: offen.length, stopp: false };
        try { for (const id of offen) { if (wahl.stopp) break; wahl.i++; await ww.eingang.pruefungNachholen([id]); await new Promise(r => setTimeout(r, 30)); } }
        finally { wahl = null; }
      });
      const vor = leiste.querySelector('button'); if (vor) vor.before(b); else leiste.append(b);
    }
    const text = ids.length ? t('pruefenWahl', { n: ids.length }) : t('pruefen');
    if (b.textContent !== text) b.textContent = text;
  }
  new MutationObserver(wahlKnopf).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  let wahl = null;   // Prüfen der Auswahl: { i, n, stopp }

  // ---------- 4 · Bildbeschreibung erst auf Knopfdruck (Pro-Umbau 4) ----------
  // Der Kern startet sie nach dem Laden von selbst (WFP.Bild.start(), wenn die Wahl gemerkt ist): Modell laden (256 MB,
  // 1,2 GB Speicher in der Spitze) und alle Fotos beschreiben. In der App wartet das wie das Einordnen auf einen Tipp;
  // danach (je Sitzung) kommen neue Fotos wie bisher von selbst dazu. Der Kern bleibt unverändert.
  let bildFrei = false, bildWartet = false;
  const BILD = () => window.WFP?.Bild;
  if (BILD() && typeof BILD().start === 'function' && !BILD().__wppGebunden) {
    const echt = BILD().start;
    BILD().start = () => { if (bildFrei) return echt(); bildWartet = true; bildZeichnen(); };
    Object.defineProperty(BILD(), '__wppGebunden', { value: true });
  }
  const bildOffen = () => { const w = window.__wfpdf, B = BILD(); return w && B ? w.S.docs.filter(d => B.istBild(d) && !(d.bild && d.bild.modell)).length : 0; };
  function bildZeichnen() {
    const l = document.getElementById('bildLeiste'); if (!l) return;
    if (bildFrei || !bildWartet) return;
    const n = bildOffen(), sig = 'w' + n + document.documentElement.lang;
    if (l.dataset.wppWartet === sig && l.querySelector('[data-wpp-beschreiben]')) return;
    l.dataset.wppWartet = sig; l.dataset.keinUe = '';
    const sp = document.createElement('span'); sp.className = 'bild-t'; sp.dataset.bildText = ''; sp.textContent = n ? t('bildWartet', { n }) : t('bildBereit');
    const b = P() ? P().knopf(t('beschreiben'), { haupt: !!n }) : Object.assign(document.createElement('button'), { className: 'bild-knopf', textContent: t('beschreiben') });
    b.type = 'button'; b.dataset.wppBeschreiben = '';
    b.addEventListener('click', async () => {
      const n2 = bildOffen();
      if (!(await frage(t('frageBild', { n: n2 }), t('frageBildText'), t('beschreiben')))) return;
      bildFrei = true; bildWartet = false; delete l.dataset.wppWartet; delete l.dataset.keinUe;
      BILD().starten();
    });
    l.replaceChildren(sp, b);
  }
  new MutationObserver(() => { if (!bildFrei && bildWartet) bildZeichnen(); }).observe(document.documentElement, { childList: true, subtree: true });

  // ---------- 5 · Hintergrundaufgabe (Pro-Umbau 4, gemeinsamer Baustein pro-hintergrund.js) ----------
  // Prüfen, Einordnen und Beschreiben laufen im Kern; hier wird nur gemeldet, DASS sie laufen. Solange einer läuft, hält
  // Android die App am Leben (Mitteilung mit Stand und „Abbrechen“). Ein Blick je Sekunde genügt (Stand und Ende).
  const H = () => window.ProHintergrund;
  const aufgaben = {};
  function laufendNach(art) {
    const w = window.__wfpdf; if (!w) return null;
    if (art === 'pruefen') {
      const A = w.eingang?.ALLE;
      if (A?.an) return { text: t('hgPruefStand', { i: Math.min(A.fertig + 1, A.gesamt), n: A.gesamt }), i: A.fertig, n: A.gesamt, stopp: () => { A.stopp = true; } };
      if (wahl) return { text: t('hgPruefStand', { i: wahl.i, n: wahl.n }), i: Math.max(0, wahl.i - 1), n: wahl.n, stopp: () => { if (wahl) wahl.stopp = true; } };
      return null;
    }
    if (art === 'einordnen') {
      const B = w.bedeutung?.BED;
      if (!frei || !(B?.zustand === 'ordnet' || rechnet > 0 || Date.now() - zuletzt < 2500)) return null;
      const o = (B?.zustand === 'ordnet' && B.ordnet) || {};
      return { text: o.doks ? t('hgEinStand', { i: o.dok, n: o.doks, name: o.name || '' }) : t('hgEinordnen'), i: Math.max(0, (o.dok || 1) - 1), n: o.doks || 0, stopp: () => { frei = false; zeichnen(); } };
    }
    if (art === 'beschreiben') {
      const Z = BILD()?.zustand?.(); if (!Z || !['laedt', 'beschreibt'].includes(Z.zustand)) return null;
      const o = Z.beschreibt || {};
      if (Z.zustand === 'laedt') { const st = Z.stand || {}; return { text: t('hgLaedt'), i: st.geladen || 0, n: st.gesamt || 0, stopp: () => BILD().aus() }; }
      return { text: t('hgBildStand', { i: o.i || 0, n: o.n || 0 }), i: Math.max(0, (o.i || 1) - 1), n: o.n || 0, stopp: () => BILD().aus() };
    }
    return null;
  }
  const TITEL = { pruefen: 'hgPruefen', einordnen: 'hgEinordnen', beschreiben: 'hgBeschreiben' };
  function blick() {
    if (!H()) return;
    for (const art of Object.keys(TITEL)) {
      const jetzt = laufendNach(art), a = aufgaben[art];
      if (jetzt && !a) {
        aufgaben[art] = { warte: true };
        H().beginnen({ art, titel: t(TITEL[art]), text: jetzt.text }).then(h => {
          if (!aufgaben[art] || !laufendNach(art)) { h.ende(); delete aufgaben[art]; return; }
          aufgaben[art] = h;
          h.signal.addEventListener('abort', () => { laufendNach(art)?.stopp(); }, { once: true });
        }).catch(() => { delete aufgaben[art]; });
      } else if (jetzt && a && !a.warte) a.stand(jetzt.text, jetzt.i, jetzt.n);
      else if (!jetzt && a) { if (!a.warte) a.ende(); delete aufgaben[art]; }
    }
  }
  setInterval(blick, 1000);
  document.addEventListener('click', () => setTimeout(blick, 50), true);   // Start sofort melden, nicht erst nach einer Sekunde

  window.WFPNativeHintergrund = Object.freeze({ freigegeben: () => frei, wartend: () => warten.length, freigeben, bildFreigegeben: () => bildFrei, bildWartet: () => bildWartet, aufgaben: () => Object.keys(aufgaben) });
})();
