/* Sichtbarer Laufhinweis während der Chrome-Übersetzung (Gegenstück zur Android-Benachrichtigung). */
(() => {
  'use strict';
  const lang = Math.max(0, ['de', 'en', 'ru', 'ar'].indexOf(new URLSearchParams(location.search).get('sprache')));
  const words = {
    titel: ['Übersetzung läuft', 'Translation in progress', 'Идёт перевод', 'الترجمة قيد التشغيل'],
    text: ['Lokaler Textaustausch mit Chrome. Abbruch über die Schaltfläche.', 'Local text exchange with Chrome. Use the button to cancel.', 'Локальный обмен текстом с Chrome. Для отмены нажмите кнопку.', 'تبادل نصي محلي مع Chrome. استخدم الزر للإلغاء.'],
    abbrechen: ['Abbrechen', 'Cancel', 'Отменить', 'إلغاء']
  };
  document.documentElement.lang = ['de', 'en', 'ru', 'ar'][lang];
  if (lang === 3) document.documentElement.dir = 'rtl';
  for (const key of Object.keys(words)) document.getElementById(key).textContent = words[key][lang];
  document.title = words.titel[lang];
  document.getElementById('abbrechen').onclick = () => { void window.__TAURI_INTERNALS__.invoke('wfp_dialog', { action: 'abbrechen' }); };
})();
