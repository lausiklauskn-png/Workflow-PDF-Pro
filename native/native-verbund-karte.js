/* Pro-App-Verbund als Vorschau-Hilfe (Klaus 2026-11-09: „Jetzt die Karte in die Apps einbauen … als Vorschau“).
   Die Karte native/pro-verbund.html ist eine byte-gleiche Kopie aus BookLedgerPro (Pin native/pro-verbund.herkunft.json).
   Diese Datei hängt nur den Einstieg in die Einstellungen und zeigt die Karte in einem Vollbild-Rahmen in der App
   (kein neues Fenster). Android-Zurück schließt den Rahmen über WFPNativeNavigation (oberster offener <dialog>). */
(() => {
  'use strict';
  if (!window.Capacitor?.isNativePlatform?.()) return;
  const words = {
    titel: ['Pro-App-Verbund (Vorschau)', 'Pro app network (preview)', 'Связка Pro-приложений (предпросмотр)', 'شبكة تطبيقات Pro (معاينة)'],
    info: ['Wie Workflow PDF Pro mit BookLedgerPro, Private Brain Pro und der Familienakte zusammenarbeitet – Stand der Wege in Farben.',
      'How Workflow PDF Pro works together with BookLedgerPro, Private Brain Pro and Familienakte – the state of each route in colours.',
      'Как Workflow PDF Pro работает вместе с BookLedgerPro, Private Brain Pro и Familienakte – состояние путей показано цветом.',
      'كيف يعمل Workflow PDF Pro مع BookLedgerPro وPrivate Brain Pro وFamilienakte – حالة كل مسار بالألوان.'],
    schliessen: ['Schließen', 'Close', 'Закрыть', 'إغلاق'],
    nurDeutsch: ['', 'The map itself is in German.', 'Сама карта на немецком языке.', 'الخريطة نفسها باللغة الألمانية.']
  };
  const t = key => words[key][Math.max(0, ['de', 'en', 'ru', 'ar'].indexOf((document.documentElement.lang || 'de').slice(0, 2)))];
  const ADRESSE = 'native/pro-verbund.html';
  function el(tag, text, cls) { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; }
  function knopf(text, beiTipp) {
    if (window.ProBedienung) return ProBedienung.knopf(text, { beiTipp });
    const b = el('button', text, 'knopf'); b.type = 'button'; b.onclick = beiTipp; return b;
  }
  function zeigen() {
    document.getElementById('nativeVerbundKarte')?.close();
    const d = el('dialog', null, 'native-verbund-karte'); d.id = 'nativeVerbundKarte'; d.dataset.keinUe = '';
    d.setAttribute('aria-label', t('titel'));
    const kopf = el('div', null, 'native-verbund-kopf');
    const h = el('h2', t('titel'));
    const zu = knopf(t('schliessen'), () => d.close()); zu.dataset.verbundZu = '';
    kopf.append(h, zu);
    if (t('nurDeutsch')) kopf.append(el('small', t('nurDeutsch')));
    const rahmen = el('iframe'); rahmen.src = ADRESSE; rahmen.title = t('titel'); rahmen.dataset.verbundRahmen = '';
    rahmen.setAttribute('referrerpolicy', 'no-referrer');
    d.append(kopf, rahmen); document.body.append(d);
    d.addEventListener('close', () => d.remove(), { once: true });
    d.showModal(); return d;
  }
  // Einstieg in den Einstellungen des Kerns, direkt hinter „Pro-Apps“ (native-pro-verbund.js) bzw. der Sicherung.
  function einhaengen() {
    const sicherung = document.getElementById('stSicherung');
    if (!sicherung || document.getElementById('stNativeVerbundKarte')) return;
    const zeile = el('span', null, 'native-verbund-eintrag'); zeile.dataset.keinUe = '';
    const b = knopf(t('titel'), () => void zeigen()); b.id = 'stNativeVerbundKarte'; b.dataset.verbundKarte = '';
    zeile.append(b);
    let inhalt = null;
    if (window.ProBedienung?.info) { const i = ProBedienung.info('verbund-karte', t('info')); zeile.append(i.knopf); inhalt = i.inhalt; }
    else b.title = t('info');
    const nach = document.getElementById('stNativeProVerbund') || sicherung;
    nach.after(zeile);
    if (inhalt) zeile.after(inhalt);
  }
  new MutationObserver(einhaengen).observe(document.documentElement, { childList: true, subtree: true });
  window.WFPVerbundKarte = Object.freeze({ zeigen, adresse: ADRESSE });
})();
