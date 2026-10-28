/* Windows-only updates. Document content never enters an update request. */
(() => {
  'use strict';
  if (!window.__TAURI_INTERNALS__?.invoke || location.origin !== 'https://tauri.localhost') return;
  const words = {
    check: ['Nach Updates suchen', 'Check for updates', 'Проверить обновления', 'البحث عن تحديثات'],
    automatic: ['Automatisch nach Updates suchen', 'Check for updates automatically', 'Автоматически проверять обновления', 'البحث عن التحديثات تلقائياً'],
    checking: ['Suche nach Updates …', 'Checking for updates …', 'Проверка обновлений …', 'جارٍ البحث عن تحديثات …'],
    current: ['Die installierte Version ist aktuell.', 'The installed version is up to date.', 'Установлена актуальная версия.', 'الإصدار المثبّت محدّث.'],
    available: ['Neue Version verfügbar: ', 'New version available: ', 'Доступна новая версия: ', 'يتوفر إصدار جديد: '],
    install: ['Herunterladen und installieren', 'Download and install', 'Загрузить и установить', 'تنزيل وتثبيت'],
    later: ['Später', 'Later', 'Позже', 'لاحقاً'],
    downloading: ['Update wird heruntergeladen und geprüft …', 'Downloading and verifying update …', 'Загрузка и проверка обновления …', 'جارٍ تنزيل التحديث والتحقق منه …'],
    saving: ['Arbeitsstand wird gespeichert …', 'Saving your work …', 'Сохранение работы …', 'جارٍ حفظ العمل …'],
    installing: ['Update wird installiert. Die App startet anschließend neu.', 'Installing update. The app will restart.', 'Установка обновления. Приложение перезапустится.', 'جارٍ تثبيت التحديث. سيُعاد تشغيل التطبيق.'],
    failed: ['Update nicht abgeschlossen. Die vorhandene Version bleibt erhalten. Bitte erneut versuchen.', 'Update did not complete. The existing version is retained. Please retry.', 'Обновление не завершено. Прежняя версия сохранена. Повторите попытку.', 'لم يكتمل التحديث. يبقى الإصدار الحالي محفوظاً. أعد المحاولة.'],
    notConfigured: ['Sichere Updates sind noch nicht eingerichtet.', 'Secure updates have not been configured yet.', 'Безопасные обновления ещё не настроены.', 'لم يتم إعداد التحديثات الآمنة بعد.'],
    saveFailed: ['Update angehalten: Der Arbeitsstand konnte nicht sicher gespeichert werden. Bitte zuerst den Speicher prüfen.', 'Update stopped: your work could not be saved safely. Please check storage first.', 'Обновление остановлено: не удалось безопасно сохранить работу. Проверьте хранилище.', 'توقف التحديث: تعذّر حفظ العمل بأمان. تحقق من التخزين أولاً.']
  };
  const t = key => words[key][Math.max(0, ['de', 'en', 'ru', 'ar'].indexOf(document.documentElement.lang))];
  const autoKey = 'wfp_windows_updates_auto_v1';
  const api = (operation, version) => window.__TAURI_INTERNALS__.invoke('wfp_update', {operation, version, language: document.documentElement.lang});
  let pending, busy = false, panel, message, lock;
  function show(key, suffix = '') {
    if (!panel) {
      panel = document.createElement('section'); panel.id = 'windowsUpdates'; panel.dataset.keinUe = '';
      panel.setAttribute('aria-label', 'Workflow PDF Pro');
      message = document.createElement('p'); message.setAttribute('role', 'status'); panel.append(message); document.body.append(panel);
    }
    message.textContent = t(key) + suffix; panel.hidden = false;
    panel.querySelectorAll('button').forEach(b => b.remove());
  }
  function button(key, action) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'knopf'; b.textContent = t(key); b.onclick = action; panel.append(b);
  }
  // Leitfaden § 6 (Klaus 2026-10-28): immer mit Version – „Du verwendest die aktuelle Version 1.0.6.“ / „Neu: 1.0.7 (du hast 1.0.6)“.
  const ich = () => (document.querySelector?.('meta[name="wfp-version"]')?.content || '').trim();
  const mitVersion = neu => { const P = window.ProBedienung; if (P && ich() && message) message.textContent = P.versionSatz(ich(), neu); };
  function offer() { show('available', pending.version); mitVersion(pending.version); button('install', install); button('later', () => {panel.hidden = true;}); }
  async function check(manual = false) {
    if (busy) return; busy = true;
    try {
      if (manual) show('checking');
      const status = await api('status');
      if (!status.configured) { if (manual) {show('notConfigured'); button('later', () => {panel.hidden = true;});} return; }
      const result = await api('check'); pending = result.available ? result : null;
      if (pending) offer();
      else if (manual) {show('current'); mitVersion(); button('later', () => {panel.hidden = true;});}
    } catch {if (manual) {show('failed'); button('check', () => check(true)); button('later', () => {panel.hidden = true;});}}
    finally {busy = false;}
  }
  async function saveBeforeRestart() {
    const gate = window.WFPNativeVault?.gate;
    if (!gate || gate.blocked || gate.fault) throw Error('STORAGE_NOT_READY');
    document.activeElement?.blur();
    const current = window.__wfpdf?.S?.doc;
    if (current) await window.WFP.DB.put('docs', structuredClone(current));
    // A journal read is also a barrier for preference writes queued outside the
    // document gate, including when no document is open.
    await window.WFP.DB.keys('docs');
    await gate.pause();
    if (gate.fault) throw Error('STORAGE_NOT_READY');
    return gate;
  }
  async function install() {
    if (busy || !pending) return; busy = true; let gate, saveStarted = false;
    try {
      show('downloading');
      await api('download', pending.version);
      // Prevent edits while saving and while the native confirmation is open.
      lock = document.createElement('dialog'); lock.className = 'native-vault-dialog';
      const text = document.createElement('p'); text.textContent = t('saving'); lock.append(text);
      lock.oncancel = event => event.preventDefault(); document.body.append(lock); lock.showModal();
      saveStarted = true; gate = await saveBeforeRestart();
      const result = await api('install', pending.version);
      if (result.installing) {text.textContent = t('installing'); return;}
      offer();
    } catch {show(saveStarted && !gate ? 'saveFailed' : 'failed'); button('later', () => {panel.hidden = true;});}
    finally {
      if (gate?.blocked && !gate.fault) gate.resume();
      lock?.close(); lock?.remove(); lock = null; busy = false;
    }
  }
  // Der Tauri-Weg zeigt sich nur, wenn er eingerichtet ist (Schlüssel vorhanden). Sonst gilt „Auf Updates prüfen“ wie unter
  // Android (native/native-updates.js über WorkflowUpdates, Klaus 2026-10-28) — kein zweiter Knopf, kein „nicht eingerichtet“.
  let eingerichtet = null;
  function settings() {
    const backup = document.getElementById('stSicherung');
    if (!backup || document.getElementById('stWindowsUpdates')) return;
    if (eingerichtet === null) { eingerichtet = false; api('status').then(s => { eingerichtet = !!s?.configured; if (eingerichtet) settings(); }).catch(() => {}); return; }
    if (!eingerichtet) return;
    const b = document.createElement('button'); b.id = 'stWindowsUpdates'; b.type = 'button'; b.className = 'knopf'; b.dataset.keinUe = ''; b.textContent = t('check'); b.onclick = () => check(true); backup.parentElement.append(b);
    const label = document.createElement('label'), input = document.createElement('input');
    input.type = 'checkbox'; input.checked = localStorage.getItem(autoKey) !== 'off';
    input.onchange = () => localStorage.setItem(autoKey, input.checked ? 'on' : 'off');
    label.dataset.keinUe = ''; label.append(input, document.createTextNode(' ' + t('automatic'))); backup.parentElement.append(label);
  }
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver(settings).observe(document.body, {childList: true, subtree: true});
    settings();
    const automatic = () => {if (localStorage.getItem(autoKey) !== 'off' && !pending) void check();};
    setTimeout(automatic, 3000); setInterval(automatic, 6 * 60 * 60 * 1000);
  });
  // Minimal surface for the installed-app acceptance suite, no URLs or keys.
  window.WFPWindowsUpdates = Object.freeze({check: () => check(true), saveBeforeRestart});
})();
