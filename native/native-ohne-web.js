/* Keine Web-Reste in der Pro-App (Leitfaden § 4, Klaus 2026-10-28). Vorbild: Private Brain Pro native/native-ohne-web.js.
   Der Kern (upstream/, byte-1:1 aus Workflow PDF) spricht vom „Browser“, vom „Browser-Speicher“, von „Browserdaten“ und
   bietet „Dauerhaft speichern lassen“ und „Als App installieren“ an. In der App stimmt das nicht: dort sind es die App und
   Android. Diese Schicht ersetzt nur in der App feste Wendungen in sichtbarem Text, Titel und Platzhalter und blendet die
   reinen Browser-Knöpfe aus. Die PWA (gleiches index.html ohne Capacitor) bleibt unberührt.
   Sie läuft NACH der Sprachschicht des Kerns (sprache.js übersetzt Deutsch → EN/RU/AR im DOM): deshalb je Sprache eine
   eigene Liste, und ersetzt wird erst im Mikrotask nach dem Beobachter der Sprachschicht. Ausgenommen ist, wo „Browser“
   wirklich Browser heißt: HTML-Ausgabe zum Ausfüllen im Browser, Links im Feld („Im Browser öffnen“), die Chrome-Fläche,
   die Diagnose und die SBKIM-Fenster. */
(() => {
  'use strict';
  if (window.WFPOhneWeb || !window.Capacitor?.isNativePlatform?.()) return;
  // Reihenfolge zählt: die längere Wendung zuerst.
  const ERSATZ = {
    de: [
      // Hilfe → Übersetzen: in der App öffnet sie selbst Chrome (native-chrome.js); kein „installiert im eigenen Fenster“.
      ['— die App zeigt den Text unten an, du tippst in Chrome ⋮ → „Übersetzen" (der Text geht an Google). Läuft die App installiert im eigenen Fenster und fehlt dort „Übersetzen": „🌐 In Chrome öffnen" — derselbe Übersetzer öffnet sich in Chrome mit denselben Dokumenten, das Ergebnis liegt danach auch in der App.', '— die App öffnet den bereinigten Text in Google Chrome, dort ⋮ → „Übersetzen" (der Text geht an Google); das Ergebnis wird in der App zum PDF.'],
      // Seit Pro-Umbau 5 ersetzt der Kern das Welt-Emoji durch ein Strichsymbol (assets/strich.js): derselbe Satz steht dann in ZWEI Textknoten,
      // getrennt am Symbol. Teil 1 bekommt den Ersatz, Teil 2 fällt weg (samt dem Symbol davor, textKnoten).
      ['— die App zeigt den Text unten an, du tippst in Chrome ⋮ → „Übersetzen" (der Text geht an Google). Läuft die App installiert im eigenen Fenster und fehlt dort „Übersetzen": „', '— die App öffnet den bereinigten Text in Google Chrome, dort ⋮ → „Übersetzen" (der Text geht an Google); das Ergebnis wird in der App zum PDF.'],
      [' In Chrome öffnen" — derselbe Übersetzer öffnet sich in Chrome mit denselben Dokumenten, das Ergebnis liegt danach auch in der App.', ''],
      ['Der Schlüssel liegt unverschlüsselt im Speicher dieses Browsers (localStorage) und wird nur an den gewählten Anbieter geschickt.', 'Der Schlüssel liegt unverschlüsselt im Speicher dieser App auf dem Gerät und wird nur an den gewählten Anbieter geschickt.'],
      ['Der Browserspeicher gilt nur für ', 'Der App-Speicher gilt nur für '],
      ['Alles bleibt in diesem Browser (DeX-Chrome und Tablet-Chrome sind zwei getrennte Browser).', 'Alles bleibt in dieser App auf dem Gerät.'],
      ['Ein anderer Browser (z. B. DeX und Tablet) sieht ihn nicht, und „Browserdaten löschen" löscht ihn mit.', 'Wer die App-Daten löscht, löscht ihn mit.'],
      ['Ein anderer Browser (z. B. DeX und Tablet) sieht ihn nicht, und „Browserdaten löschen" löscht ihn mit.', 'Wer die App-Daten löscht, löscht ihn mit.'],
      [' (vom Browser als dauerhaft bestätigt)', ''],
      ['auch in einem anderen Browser', 'auch auf einem anderen Gerät'],
      ['Übersetzer im Browser', 'Übersetzer auf dem Gerät'],
      ['Dieser Browser hat keinen eingebauten Übersetzer', 'Diese App hat keinen eingebauten Übersetzer'],
      ['Spracheingabe kann dieser Browser nicht', 'Spracheingabe kann diese App hier nicht'],
      ['Dieser Browser kann keine Dateien teilen', 'Diese App kann hier keine Dateien teilen'],
      ['an den Browser-Hersteller (Chrome: Google)', 'an die Spracherkennung des Systems (unter Android meist Google)'],
      ['im Vorrat dieses Browsers', 'im Speicher dieser App'], ['im Speicher dieses Browsers', 'im Speicher dieser App'],
      ['nur in diesem Browser gespeichert', 'nur in dieser App gespeichert'],
      ['Löscht jemand die Browserdaten', 'Löscht jemand die App-Daten'],
      ['Browserdaten', 'App-Daten'], ['Browserspeicher', 'App-Speicher'], ['Browser-Speicher', 'App-Speicher'],
      ['In diesem Browser gespeichert', 'In dieser App gespeichert'],
      ['aus diesem Browser gelöscht', 'aus dieser App gelöscht'], ['in diesem Browser', 'in dieser App'],
      ['diesen Browser', 'diese App'], ['dieses Browsers', 'dieser App'],
      ['Stand im Browser', 'Stand in der App'], ['im Browser lag', 'in der App lag'],
      ['bleibt im Browser', 'bleibt in der App'], ['geschieht laufend im Browser', 'geschieht laufend in der App'],
      ['Dieser Browser', 'Diese App'], ['Der Browser', 'Die App'], ['der Browser', 'die App']
    ],
    en: [
      ['— the app shows the text below, you tap ⋮ → "Translate" in Chrome (the text goes to Google). If the app runs installed in its own window and "Translate" is missing there: "🌐 Open in Chrome" — the same translator opens in Chrome with the same documents, and the result then shows up in the app too.', '— the app opens the cleaned text in Google Chrome, there ⋮ → "Translate" (the text goes to Google); the app turns the result into a PDF.'],
      ['— the app shows the text below, you tap ⋮ → "Translate" in Chrome (the text goes to Google). If the app runs installed in its own window and "Translate" is missing there: "', '— the app opens the cleaned text in Google Chrome, there ⋮ → "Translate" (the text goes to Google); the app turns the result into a PDF.'],
      [' Open in Chrome" — the same translator opens in Chrome with the same documents, and the result then shows up in the app too.', ''],
      ["The API key is stored unencrypted in this browser's storage (localStorage) and is only sent to the chosen provider.", "The API key is stored unencrypted in this app's storage on the device and is only sent to the chosen provider."],
      ['Browser storage only applies to ', 'App storage only applies to '],
      ['Everything stays in this browser (DeX Chrome and tablet Chrome are two separate browsers).', 'Everything stays in this app on the device.'],
      ['Browser translator', 'On-device translator'], ["The browser's translator", 'The on-device translator'],
      ['This browser has no built-in translator', 'This app has no built-in translator'],
      ['This browser cannot do voice input', 'This app cannot do voice input here'],
      ['This browser cannot share files', 'This app cannot share files here'],
      ['to the browser maker for recognition (Chrome: Google)', 'to the system speech recognition (on Android usually Google)'],
      ['stored only in this browser', 'stored only in this app'], ['clears the browser data', 'clears the app data'],
      ['browser data', 'app data'], ['browsing data', 'app data'], ['Browser storage', 'App storage'], ["this browser's", "this app's"],
      ['Saved in this browser', 'Saved in this app'], ['from this browser', 'from this app'], ['in this browser', 'in this app'],
      ['in another browser', 'on another device'], ['stays in the browser', 'stays in the app'], ['in the browser', 'in the app'],
      ['This browser', 'This app'], ['this browser', 'this app'],
      ['The browser', 'The app'], ['the browser', 'the app']
    ],
    ru: [
      ['в этом браузере', 'в этом приложении'], ['данные браузера', 'данные приложения'], ['Память браузера', 'Память приложения'],
      ['памяти браузера', 'памяти приложения'], ['Этот браузер', 'Это приложение'], ['этот браузер', 'это приложение'],
      ['в браузере', 'в приложении'], ['браузера', 'приложения'], ['Браузер', 'Приложение'], ['браузер', 'приложение']
    ],
    ar: [
      ['في هذا المتصفح', 'في هذا التطبيق'], ['بيانات المتصفح', 'بيانات التطبيق'], ['هذا المتصفح', 'هذا التطبيق'],
      ['في المتصفح', 'في التطبيق'], ['المتصفح', 'التطبيق']
    ]
  };
  // Reine Browser-Bedienung, die es in der App nicht gibt (Android hält den Speicher der App ohnehin; installiert ist sie schon).
  const AUSBLENDEN = ['#btnInstall', '[data-einst-install]', '#stInstall', '#siDauer', '#siDauerKnopf'];
  // Wo „Browser“ wirklich Browser heißt, und was die App selbst schreibt.
  const NIE = '#wfp-chrome, [data-m="html"], a[data-link], [id^="sbkim-"], [class^="sbkim-"], script, style, textarea, input, select, [contenteditable="true"], [data-wfp-diagnose]';
  const NIE_ATTR = '#wfp-chrome, [data-m="html"], a[data-link], [id^="sbkim-"], [class^="sbkim-"]';
  const liste = () => ERSATZ[String(document.documentElement.lang || 'de').slice(0, 2)] || ERSATZ.de;
  const tausch = v => { let r = v; for (const [a, b] of liste()) if (r.includes(a)) r = r.split(a).join(b); return r; };
  const ausgenommen = e => !e || Boolean(e.closest(NIE)) || diagnose(e);
  // Die Diagnose (Hilfe → Diagnose) nennt Browser und Übersetzer ehrlich beim Namen: ihr Fenster bleibt, wie es ist.
  const diagnose = e => { const d = e.closest('.dlg, dialog'); return Boolean(d && /Diagnose|Diagnostics|Диагностика|تشخيص/.test(d.querySelector('h2')?.textContent || '')); };
  const textKnoten = n => { const e = n.parentElement; if (ausgenommen(e)) return; const neu = tausch(n.nodeValue); if (neu === n.nodeValue) return; n.nodeValue = neu;
    // Fällt ein Satzteil ganz weg, geht das Strichsymbol davor mit (sonst stünde ein Symbol ohne Text da).
    const v = n.previousSibling; if (!neu.trim() && v && v.nodeType === 1 && v.hasAttribute('data-strich')) v.remove(); };
  // Platzhalter und Titel auch an Eingabefeldern (nur der Wert eines Feldes bleibt unberührt).
  const attribute = e => { if (!e || e.closest(NIE_ATTR) || diagnose(e)) return; for (const a of ['title', 'placeholder', 'aria-label']) { const v = e.getAttribute(a); if (v) { const neu = tausch(v); if (neu !== v) e.setAttribute(a, neu); } } };
  function ausblenden() {
    for (const s of AUSBLENDEN) for (const e of document.querySelectorAll(s)) {
      // Ganze Zeile weg, wenn der Knopf allein in ihr steht (Sicherung: „Dauerhaft speichern lassen“).
      const ziel = e.id === 'siDauerKnopf' && e.parentElement?.classList.contains('zeile') ? e.parentElement : e;
      if (!ziel.hidden) ziel.hidden = true;
      // Die Überschrift „Speicher des Browsers“ gehört zum Absatz #siDauer.
      if (e.id === 'siDauer') { const h = e.previousElementSibling; if (h && h.tagName === 'H3' && !h.hidden) h.hidden = true; }
    }
  }
  function durchgehen(wurzel) {
    if (!wurzel) return;
    if (wurzel.nodeType === Node.TEXT_NODE) return textKnoten(wurzel);
    if (wurzel.nodeType !== Node.ELEMENT_NODE) return;
    attribute(wurzel);
    const w = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
    while ((n = w.nextNode())) { if (n.nodeType === Node.TEXT_NODE) textKnoten(n); else attribute(n); }
  }
  function alles() { ausblenden(); durchgehen(document.body); }
  let offen = new Set(), geplant = false;
  // Erst nach dem Beobachter der Sprachschicht (Mikrotask): sonst fände sie den deutschen Schlüssel nicht mehr.
  function planen() { if (geplant) return; geplant = true; queueMicrotask(() => { geplant = false; const l = offen; offen = new Set(); for (const n of l) if (n.isConnected) durchgehen(n); ausblenden(); }); }
  const beobachter = new MutationObserver(liste_ => {
    for (const m of liste_) {
      if (m.type === 'characterData' || m.type === 'attributes') offen.add(m.target);
      else for (const n of m.addedNodes) offen.add(n);
    }
    planen();
  });
  function start() {
    alles();
    beobachter.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });
    new MutationObserver(() => queueMicrotask(alles)).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  window.WFPOhneWeb = Object.freeze({ tausch, alles });
})();
