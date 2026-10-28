/* Sicherung gestreamt (Leitfaden § 3, Klaus 2026-10-28: „Workflow PDF Pro stürzte bei ~50 MB ab“).
   Der Kern (upstream/…/sicherung.js) baut die GANZE Bibliothek als Text (base64 je PDF, JSON, dann ein Paket) — bei großen
   PDFs liegt sie mehrfach im Speicher, und die App stirbt. Hier dieselbe Sicherung Stück für Stück:
   - Dokument für Dokument, jede Datei in Stücken zu 192 KB, jedes Stück einzeln verschlüsselt und sofort in die Datei
     geschrieben (WorkflowFiles begin/append/finish, Android und Windows). Im Speicher liegt höchstens EIN Dokument.
   - Schloss wie im Kern: PBKDF2-SHA256 600 000 Runden → AES-256-GCM, Passwort nur im Arbeitsspeicher.
   - Jedes Stück trägt seine Nummer und den Kopf als Zusatzdaten (AAD): Umstellen, Weglassen oder Anhängen fällt beim
     Öffnen auf; ein Schluss-Stück mit den Zahlen zeigt, dass die Datei vollständig ist.
   - Inhalt wie im Kern: Ordner, Dokumente (Felder, Einträge), PDF-Datei, Originalfoto ungeprüfter Dokumente.
   - Zurückholen fügt hinzu und überschreibt nie — über die Rechnung des Kerns (WFP.Sicherung.zusammenfuehren), je Dokument.
   - Alte Sicherungen (eine JSON-Datei, Fassung 1) holt weiter der Kern zurück.
   Format „Fassung 2“: Zeile `WFPDF-SICHERUNG-2\n`, Kopfzeile (JSON) `\n`, dann Stücke [u32 Länge][12 B IV][Geheimtext].
   Klartext je Stück: 1 Byte Art + Inhalt (1 Kopf · 2 Dokument · 3 Datei-Anfang · 4 Datei-Bytes · 5 Schluss). */
(function (welt) {
  'use strict';
  const MAGIE = 'WFPDF-SICHERUNG-2\n', ART = 'workfloh-pdf-sicherung', FASSUNG = 2, RUNDEN = 600000, STUECK = 196608, ORIGINAL = '~original';
  const A = { KOPF: 1, DOK: 2, DATEI: 3, BYTES: 4, SCHLUSS: 5 };
  const enc = new TextEncoder(), dec = new TextDecoder();
  const subtle = () => welt.crypto.subtle;
  function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  function vonB64(s) { const bin = atob(s), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  async function alsBytes(b) {
    if (b == null) return null;
    if (b instanceof Uint8Array) return b;
    if (b instanceof ArrayBuffer) return new Uint8Array(b);
    if (ArrayBuffer.isView(b)) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    if (typeof Blob !== 'undefined' && b instanceof Blob) return new Uint8Array(await b.arrayBuffer());
    return null;
  }
  async function schluessel(pw, salz) {
    const basis = await subtle().importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salz, iterations: RUNDEN }, basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function zusatz(kopfHash, n) { const a = new Uint8Array(kopfHash.length + 8); a.set(kopfHash); new DataView(a.buffer).setUint32(kopfHash.length + 4, n); return a; }
  const stopp = signal => { if (signal && signal.aborted) throw new Error('abgebrochen'); };

  /* Schreiben: `schreib(bytes)` hängt Bytes an die Datei (await). `fort(fertig, gesamt, name)` meldet den Stand. */
  async function verschliessen(pw, db, schreib, { fort = () => {}, signal = null, jetzt = new Date() } = {}) {
    if (String(pw || '').length < 8) throw new Error('passwort-kurz');
    const salz = welt.crypto.getRandomValues(new Uint8Array(16));
    const kopf = JSON.stringify({ art: ART, fassung: FASSUNG, erstellt: jetzt.toISOString(), kdf: 'PBKDF2-SHA256', runden: RUNDEN, salz: b64(salz) });
    const kopfBytes = enc.encode(MAGIE + kopf + '\n'), kopfHash = new Uint8Array(await subtle().digest('SHA-256', kopfBytes));
    const key = await schluessel(pw, salz);
    let n = 0;
    async function stueck(art, inhalt) {
      stopp(signal);
      const klar = new Uint8Array(1 + inhalt.length); klar[0] = art; klar.set(inhalt, 1);
      const iv = welt.crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: await zusatz(kopfHash, n++) }, key, klar));
      const rahmen = new Uint8Array(4 + 12 + ct.length); new DataView(rahmen.buffer).setUint32(0, 12 + ct.length); rahmen.set(iv, 4); rahmen.set(ct, 16);
      await schreib(rahmen);
    }
    const json = (art, o) => stueck(art, enc.encode(JSON.stringify(o)));
    async function datei(id, art, name, bytes) {
      await json(A.DATEI, { id, art, name: name || '', groesse: bytes.length });
      for (let i = 0; i < bytes.length; i += STUECK) await stueck(A.BYTES, bytes.subarray(i, i + STUECK));
    }
    await schreib(kopfBytes);
    const ordner = await db.all('folders'), docs = await db.all('docs');
    await json(A.KOPF, { ordner, docs: docs.length });
    let mitDatei = 0, ohne = 0, originale = 0;
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i]; fort(i, docs.length, d.name);
      let b = await alsBytes(await db.getFile(d.id));
      if (!b) { ohne++; continue; }
      await json(A.DOK, d); await datei(d.id, 'datei', '', b); b = null; mitDatei++;
      const o = db.get ? await db.get('files', d.id + ORIGINAL) : null, ob = o && await alsBytes(o.bytes);
      if (ob) { await datei(d.id, 'original', welt.WFP?.Sicherung?.originalName ? welt.WFP.Sicherung.originalName(o.name) : o.name, ob); originale++; }
      await new Promise(r => setTimeout(r, 0));   // Atempause: die Oberfläche bleibt bedienbar
    }
    fort(docs.length, docs.length, '');
    await json(A.SCHLUSS, { docs: mitDatei, ordner: ordner.length, ohneDatei: ohne, originale, stuecke: n + 1 });
    return { erstellt: jetzt.toISOString(), docs: mitDatei, ordner: ordner.length, ohneDatei: ohne, originale };
  }

  /* Lesen: `lies(von, bis)` gibt Bytes der Datei (await). Je fertigem Dokument `beiDok({doc, bytes, original})`. */
  async function istFassung2(lies) { const a = await lies(0, MAGIE.length); return dec.decode(a) === MAGIE; }
  async function oeffnen(pw, lies, groesse, beiDok, { beiKopf = () => {}, fort = () => {}, signal = null } = {}) {
    if (!(await istFassung2(lies))) throw new Error('keine-sicherung');
    let pos = MAGIE.length, kopfText = '';
    { // Kopfzeile bis \n (höchstens 4 KB)
      const teil = dec.decode(await lies(pos, Math.min(groesse, pos + 4096)));
      const nl = teil.indexOf('\n'); if (nl < 0) throw new Error('keine-sicherung');
      kopfText = teil.slice(0, nl); pos += enc.encode(kopfText).length + 1;
    }
    let kopf; try { kopf = JSON.parse(kopfText); } catch (_) { throw new Error('keine-sicherung'); }
    if (kopf.art !== ART) throw new Error('keine-sicherung');
    if (kopf.fassung !== FASSUNG || kopf.runden !== RUNDEN) throw new Error('fassung');
    const kopfHash = new Uint8Array(await subtle().digest('SHA-256', enc.encode(MAGIE + kopfText + '\n')));
    const key = await schluessel(pw, vonB64(kopf.salz));
    let n = 0, ordner = null, dok = null, datei = null, offen = null, schluss = null, gesamt = 0, fertig = 0;
    const abschliessen = async () => { if (offen && offen.doc) { await beiDok(offen); fertig++; fort(fertig, gesamt); } offen = null; };
    while (pos < groesse) {
      stopp(signal);
      if (schluss) throw new Error('beschaedigt');
      const len = new DataView((await lies(pos, pos + 4)).buffer.slice(0)).getUint32(0);
      if (len < 29 || pos + 4 + len > groesse) throw new Error('beschaedigt');
      const r = await lies(pos + 4, pos + 4 + len); pos += 4 + len;
      let klar;
      try { klar = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: r.subarray(0, 12), additionalData: await zusatz(kopfHash, n) }, key, r.subarray(12))); }
      catch (_) { throw new Error(n === 0 ? 'passwort' : 'beschaedigt'); }
      n++;
      const art = klar[0], inhalt = klar.subarray(1), j = () => JSON.parse(dec.decode(inhalt));
      if (n === 1) { if (art !== A.KOPF) throw new Error('beschaedigt'); const k = j(); ordner = k.ordner || []; gesamt = k.docs || 0; await beiKopf({ ordner, erstellt: kopf.erstellt }); continue; }
      if (art !== A.BYTES && datei && datei.pos !== datei.bytes.length) throw new Error('beschaedigt');   // Datei unvollständig
      if (art === A.DOK) { await abschliessen(); offen = { doc: j(), bytes: null, original: null }; datei = null; }
      else if (art === A.DATEI) {
        const d = j(); if (!offen || d.id !== offen.doc.id) throw new Error('beschaedigt');
        datei = { art: d.art, name: d.name, bytes: new Uint8Array(d.groesse), pos: 0 };
        if (d.art === 'original') offen.original = { name: welt.WFP?.Sicherung?.originalName ? welt.WFP.Sicherung.originalName(d.name) : d.name, bytes: datei.bytes }; else offen.bytes = datei.bytes;
      } else if (art === A.BYTES) {
        if (!datei || datei.pos + inhalt.length > datei.bytes.length) throw new Error('beschaedigt');
        datei.bytes.set(inhalt, datei.pos); datei.pos += inhalt.length;
      } else if (art === A.SCHLUSS) {
        await abschliessen(); schluss = j();
        if (schluss.stuecke !== n) throw new Error('beschaedigt');
      } else throw new Error('beschaedigt');
    }
    if (!schluss) throw new Error('unvollstaendig');
    return { erstellt: kopf.erstellt, ordner, schluss };
  }

  const API = { MAGIE, ART, FASSUNG, RUNDEN, STUECK, verschliessen, oeffnen, istFassung2 };
  welt.WFPSicherung2 = API;
  if (typeof document === 'undefined' || !welt.Capacitor?.isNativePlatform?.()) return;
  const files = welt.Capacitor.Plugins?.WorkflowFiles; if (typeof files?.begin !== 'function') return;

  // ---------- Oberfläche: der Kern-Dialog bleibt, seine beiden Knöpfe gehen hier durch ----------
  const W = {
    laeuft: ['Sichere Dokument {i} von {n} …', 'Backing up document {i} of {n} …', 'Сохранение документа {i} из {n} …', 'نسخ المستند {i} من {n} …'],
    holt: ['Hole Dokument {i} von {n} zurück …', 'Restoring document {i} of {n} …', 'Восстановление документа {i} из {n} …', 'استعادة المستند {i} من {n} …'],
    schluessel: ['Schlüssel wird berechnet …', 'Deriving key …', 'Вычисление ключа …', 'جارٍ حساب المفتاح …'],
    gesichert: ['Gesichert: {d} Dokument(e) in {o} Ordner(n), Datei „{name}“.', 'Backed up: {d} document(s) in {o} folder(s), file “{name}”.', 'Сохранено: документов {d}, папок {o}, файл «{name}».', 'تم النسخ: {d} مستند في {o} مجلد، الملف «{name}».'],
    ohneDatei: [' {n} Dokument(e) hatten keine Datei und fehlen darin.', ' {n} document(s) had no file and are missing.', ' У {n} документов нет файла, они не включены.', ' {n} مستند بلا ملف ولم يُضمَّن.'],
    nichtGespeichert: ['Die Datei wurde nicht gespeichert (Speichern abgebrochen).', 'The file was not saved (saving cancelled).', 'Файл не сохранён (сохранение отменено).', 'لم يُحفظ الملف (أُلغي الحفظ).'],
    zurueck: ['{d} Dokument(e) dazu, {s} schon da{o}.', '{d} document(s) added, {s} already present{o}.', 'Добавлено документов: {d}, уже было: {s}{o}.', 'أُضيف {d} مستند، موجود مسبقاً {s}{o}.'],
    ordnerDazu: [', {n} Ordner dazu', ', {n} folder(s) added', ', добавлено папок: {n}', '، أُضيف {n} مجلد'],
    neuLaden: [' Die Bibliothek wird neu geladen …', ' Reloading the library …', ' Библиотека перезагружается …', ' جارٍ إعادة تحميل المكتبة …'],
    abbrechen: ['Abbrechen', 'Cancel', 'Отмена', 'إلغاء'],
    abgebrochen: ['Abgebrochen. Es wurde keine Sicherungsdatei gespeichert.', 'Cancelled. No backup file was saved.', 'Отменено. Файл резервной копии не сохранён.', 'أُلغي. لم يُحفظ ملف النسخ.'],
    abgebrochenZ: ['Abgebrochen. Was schon zurückgeholt war, bleibt.', 'Cancelled. What was already restored stays.', 'Отменено. Уже восстановленное остаётся.', 'أُلغي. ما استُعيد يبقى.'],
    passwort: ['Das Passwort passt nicht zu dieser Sicherung.', 'The password does not match this backup.', 'Пароль не подходит к этой копии.', 'كلمة المرور لا تطابق هذه النسخة.'],
    beschaedigt: ['Die Sicherungsdatei ist beschädigt oder verändert. Was davor lag, ist zurückgeholt.', 'The backup file is damaged or altered. Everything before that point was restored.', 'Файл копии повреждён или изменён. Всё до этого места восстановлено.', 'ملف النسخ تالف أو معدَّل. استُعيد ما قبله.'],
    unvollstaendig: ['Die Sicherungsdatei ist unvollständig (abgeschnitten). Was darin war, ist zurückgeholt.', 'The backup file is incomplete (truncated). What it contained was restored.', 'Файл копии неполный (обрезан). Его содержимое восстановлено.', 'ملف النسخ ناقص. استُعيد ما فيه.'],
    fassung: ['Diese Sicherung stammt aus einer anderen Fassung der App und lässt sich hier nicht öffnen.', 'This backup comes from another version of the app and cannot be opened here.', 'Эта копия из другой версии приложения.', 'هذه النسخة من إصدار آخر للتطبيق.'],
    fehler: ['Die Sicherung ließ sich nicht erstellen: ', 'The backup could not be created: ', 'Не удалось создать копию: ', 'تعذّر إنشاء النسخة: '],
    fehlerZ: ['Zurückholen ging nicht: ', 'Restore failed: ', 'Восстановление не удалось: ', 'فشلت الاستعادة: ']
  };
  const t = (k, v = {}) => String(W[k][Math.max(0, ['de', 'en', 'ru', 'ar'].indexOf(document.documentElement.lang))] || W[k][0]).replace(/\{(\w+)\}/g, (_, x) => String(v[x] ?? ''));
  const db = () => welt.WFP.DB;
  let laeuft = false, durchlassen = false;
  const zweistellig = z => String(z).padStart(2, '0');
  const dateiname = d => 'Workflow-PDF-Pro-Sicherung-' + d.getFullYear() + '-' + zweistellig(d.getMonth() + 1) + '-' + zweistellig(d.getDate()) + '-' + zweistellig(d.getHours()) + zweistellig(d.getMinutes()) + '.wfps';

  function lauf(dlg, vor) {
    const P = welt.ProBedienung, ctl = new AbortController();
    const host = document.createElement('div'); host.dataset.wfpSicherungLauf = ''; host.dataset.keinUe = '';
    vor.after(host);
    const f = P ? P.fortschritt(host, { schliessbar: false }) : null;
    const zeile = f ? null : host.appendChild(document.createElement('p'));
    const k = P ? P.knopf(t('abbrechen'), { name: 'sicherung-abbrechen', beiTipp: () => ctl.abort() }) : Object.assign(document.createElement('button'), { className: 'knopf', textContent: t('abbrechen'), onclick: () => ctl.abort() });
    k.dataset.wfpSicherungAbbrechen = ''; host.append(k);
    for (const b of dlg.querySelectorAll('button:not([data-wfp-sicherung-abbrechen])')) { b.dataset.wfpWarAn = b.disabled ? '0' : '1'; b.disabled = true; }
    return {
      signal: ctl.signal,
      text(s, i, n) { if (f) f.schritt(i, n, s); else zeile.textContent = s; },
      ende(stand, s) {
        k.remove(); for (const b of dlg.querySelectorAll('[data-wfp-war-an]')) { b.disabled = b.dataset.wfpWarAn === '0'; delete b.dataset.wfpWarAn; }
        if (f) f[stand](s); else zeile.textContent = s;
      }
    };
  }

  async function erstellen(dlg) {
    const SI = welt.WFP?.Sicherung, e = dlg.querySelector('#siErg'), p1 = dlg.querySelector('#siPw1').value, p2 = dlg.querySelector('#siPw2').value;
    e.dataset.keinUe = '';
    if (p1.length < (SI ? SI.MIN_PW : 8)) { e.textContent = 'Das Passwort braucht mindestens ' + (SI ? SI.MIN_PW : 8) + ' Zeichen.'; delete e.dataset.keinUe; return; }
    if (p1 !== p2) { e.textContent = 'Die beiden Passwörter sind nicht gleich.'; delete e.dataset.keinUe; return; }
    e.textContent = '';
    const jetzt = new Date(), name = dateiname(jetzt), l = lauf(dlg, e);
    l.text(t('schluessel'));
    let id = null, offset = 0, gespeichert = false;
    try {
      ({ id } = await files.begin({ name, mime: 'application/octet-stream' }));
      const r = await verschliessen(p1, db(), async bytes => {
        for (let i = 0; i < bytes.length; i += 196608) { const s = bytes.subarray(i, i + 196608); await files.append({ id, offset, data: b64(s) }); offset += s.length; }
      }, { signal: l.signal, jetzt, fort: (i, n) => l.text(t('laeuft', { i: Math.min(i + 1, n), n }), i, n) });
      await files.finish({ id, size: offset });
      dlg.querySelector('#siPw1').value = dlg.querySelector('#siPw2').value = '';
      const s = await files.save({ id }); gespeichert = s && s.saved !== false;
      if (gespeichert) {
        try { localStorage.setItem('wfpdf_sicherung_zuletzt', r.erstellt); } catch (_) {}
        const z = dlg.querySelector('[data-sich-zuletzt]'); if (z) z.textContent = 'Letzte Sicherung: ' + jetzt.toLocaleDateString('de-DE') + '.';
        l.ende('fertig', t('gesichert', { d: r.docs, o: r.ordner, name }) + (r.ohneDatei ? t('ohneDatei', { n: r.ohneDatei }) : ''));
        welt.__wfpdf?.dlg?.sicherungErinnerung?.();
      } else l.ende('abgebrochen', t('nichtGespeichert'));
    } catch (err) {
      const m = err && err.message;
      if (m === 'abgebrochen') l.ende('abgebrochen', t('abgebrochen')); else l.ende('fehler', t('fehler') + (m || err));
    } finally { if (id) await files.abort({ id }).catch(() => {}); }
  }

  async function zurueckholen(dlg, f) {
    const SI = welt.WFP?.Sicherung, e = dlg.querySelector('#siZErg'), pw = dlg.querySelector('#siPwZ').value;
    if (!pw) { durchlassen = true; try { dlg.querySelector('#siZurueck').click(); } finally { durchlassen = false; } return; }
    e.textContent = ''; e.dataset.keinUe = '';
    const l = lauf(dlg, e); l.text(t('schluessel'));
    const lies = async (von, bis) => new Uint8Array(await f.slice(von, bis).arrayBuffer());
    let ordner = [], erst = true, dazu = 0, schonDa = 0, ordnerDazu = 0;
    try {
      await oeffnen(pw, lies, f.size, async ({ doc, bytes, original }) => {
        if (!bytes) return;
        const r = await SI.zusammenfuehren(db(), { ordner: erst ? ordner : [], docs: [doc], dateien: new Map([[doc.id, bytes]]), originale: new Map(original ? [[doc.id, original]] : []) });
        erst = false; dazu += r.dazu; schonDa += r.schonDa; ordnerDazu += r.ordnerDazu;
      }, { signal: l.signal, beiKopf: k => { ordner = k.ordner; }, fort: (i, n) => l.text(t('holt', { i, n }), i, n) });
      if (erst && ordner.length) { const r = await SI.zusammenfuehren(db(), { ordner, docs: [], dateien: new Map(), originale: new Map() }); ordnerDazu += r.ordnerDazu; }
      dlg.querySelector('#siPwZ').value = '';
      l.ende('fertig', t('zurueck', { d: dazu, s: schonDa, o: ordnerDazu ? t('ordnerDazu', { n: ordnerDazu }) : '' }) + (dazu || ordnerDazu ? t('neuLaden') : ''));
      if (dazu || ordnerDazu) setTimeout(() => location.reload(), 1500);
    } catch (err) {
      const m = err && err.message, teil = dazu ? ' ' + t('zurueck', { d: dazu, s: schonDa, o: '' }) : '';
      if (m === 'abgebrochen') l.ende('abgebrochen', t('abgebrochenZ') + teil);
      else if (W[m]) l.ende('fehler', t(m) + teil);
      else l.ende('fehler', t('fehlerZ') + (m || err));
      if (dazu) setTimeout(() => location.reload(), 4000);
    }
  }

  // Der Kern-Dialog bleibt; seine beiden Knöpfe gehen hier durch (Fangen vor dem onclick des Kerns).
  document.addEventListener('click', ev => {
    const b = ev.target.closest?.('#siErstellen,#siZurueck'); if (!b || durchlassen) return;
    const dlg = b.closest('.dlg'); if (!dlg) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (laeuft) return;
    if (b.id === 'siErstellen') { laeuft = true; void erstellen(dlg).finally(() => { laeuft = false; }); return; }
    const f = dlg.querySelector('#siDatei')?.files?.[0];
    if (!f) { durchlassen = true; try { b.click(); } finally { durchlassen = false; } return; }
    laeuft = true;
    void (async () => {
      if (await istFassung2(async (von, bis) => new Uint8Array(await f.slice(von, bis).arrayBuffer()))) await zurueckholen(dlg, f);
      else { durchlassen = true; try { b.click(); } finally { durchlassen = false; } }   // alte JSON-Sicherung: der Kern
    })().finally(() => { laeuft = false; });
  }, true);
  // Die Dateiwahl nimmt auch die neue Sicherung (.wfps) an.
  new MutationObserver(() => {
    const i = document.getElementById('siDatei');
    if (i && !i.dataset.wfps) { i.dataset.wfps = '1'; i.setAttribute('accept', '.wfps,.json,application/json,application/octet-stream'); }
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  welt.WFPNativeSicherung = Object.freeze({ dateiname });
})(typeof window !== 'undefined' ? window : globalThis);
