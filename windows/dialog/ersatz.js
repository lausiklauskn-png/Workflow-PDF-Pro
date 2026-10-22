/* Anzeige neuer Ersatzschlüssel (3 von 5) in einem eigenen Fenster. Die Teile
   kommen direkt vom Rust-Host und gelangen nie in die Webseite des Hauptfensters. */
(() => {
  'use strict';
  const lang = Math.max(0, ['de', 'en', 'ru', 'ar'].indexOf(new URLSearchParams(location.search).get('sprache')));
  const W = {
    titel: ['Ersatzschlüssel (3 von 5)', 'Recovery keys (3 of 5)', 'Ключи восстановления (3 из 5)', 'مفاتيح الاسترداد (3 من 5)'],
    hilfe: ['Diese fünf Ersatzschlüssel getrennt aufbewahren, zum Beispiel ausgedruckt an verschiedenen Orten. Drei beliebige genügen, um ein vergessenes Passwort zu ersetzen. Wer drei Teile hat, kann den Tresor öffnen. Ältere Ersatzschlüssel gelten ab jetzt nicht mehr.', 'Keep these five recovery keys separately, e.g. printed in different places. Any three replace a forgotten password. Anyone holding three keys can open the vault. Older recovery keys are no longer valid.', 'Храните пять ключей раздельно, например распечатанными в разных местах. Любые три заменяют забытый пароль. Владелец трёх ключей может открыть хранилище. Прежние ключи больше не действуют.', 'احتفظ بمفاتيح الاسترداد الخمسة بشكل منفصل، مثلاً مطبوعة في أماكن مختلفة. أي ثلاثة منها تستبدل كلمة مرور منسية. من يملك ثلاثة مفاتيح يمكنه فتح الخزنة. المفاتيح القديمة لم تعد صالحة.'],
    bestaetigt: ['Ich habe alle fünf Ersatzschlüssel gespeichert, gedruckt oder aufgeschrieben.', 'I have saved, printed or written down all five recovery keys.', 'Я сохранил, распечатал или записал все пять ключей.', 'لقد حفظت أو طبعت أو دونت مفاتيح الاسترداد الخمسة.'],
    speichern: ['Als Datei speichern …', 'Save as file …', 'Сохранить в файл …', 'حفظ كملف …'],
    drucken: ['Drucken …', 'Print …', 'Печать …', 'طباعة …'],
    fertig: ['Fertig', 'Done', 'Готово', 'تم'],
    gespeichert: ['Datei gespeichert und geprüft. Teile trotzdem getrennt aufbewahren.', 'File saved and verified. Still keep the keys separately.', 'Файл сохранён и проверен. Храните ключи раздельно.', 'تم حفظ الملف والتحقق منه. احتفظ بالمفاتيح منفصلة.'],
    fehler: ['Datei konnte nicht gespeichert werden.', 'The file could not be saved.', 'Не удалось сохранить файл.', 'تعذر حفظ الملف.']
  };
  const $ = id => document.getElementById(id);
  document.documentElement.lang = ['de', 'en', 'ru', 'ar'][lang];
  if (lang === 3) document.documentElement.dir = 'rtl';
  $('titel').textContent = document.title = W.titel[lang]; $('hilfe').textContent = W.hilfe[lang];
  $('bestaetigtText').textContent = W.bestaetigt[lang];
  for (const id of ['speichern', 'drucken', 'fertig']) $(id).textContent = W[id][lang];
  const invoke = (action, fields) => window.__TAURI_INTERNALS__.invoke('wfp_dialog', { action, fields });
  void invoke('anzeigen').then(answer => {
    for (const share of answer.shares || []) { const li = document.createElement('li'); li.textContent = share; $('teile').append(li); }
  });
  $('bestaetigt').onchange = () => { $('fertig').disabled = !$('bestaetigt').checked; };
  $('speichern').onclick = async () => {
    try { const r = await invoke('speichern', { language: document.documentElement.lang }); if (r?.saved) $('status').textContent = W.gespeichert[lang]; }
    catch { $('status').textContent = W.fehler[lang]; }
  };
  $('drucken').onclick = () => window.print();
  $('fertig').onclick = () => { $('teile').replaceChildren(); void invoke('fertig'); };
})();
