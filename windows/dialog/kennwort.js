/* Passwortfenster des Windows-Hosts, Gegenstück zum Android-Passwortdialog.
   Das Passwort geht nur an den Rust-Host, nie an die Webseite des Hauptfensters. */
(() => {
  'use strict';
  const WORDS = [
    ['Dokumenttresor einrichten', 'Create document vault', 'Создать хранилище документов', 'إنشاء خزنة المستندات'],
    ['Dokumenttresor öffnen', 'Open document vault', 'Открыть хранилище документов', 'فتح خزنة المستندات'],
    ['Passwort', 'Password', 'Пароль', 'كلمة المرور'],
    ['Passwort wiederholen', 'Repeat password', 'Повторить пароль', 'تأكيد كلمة المرور'],
    ['Passwort vergessen = Daten verloren. Ich bewahre es sicher auf.', 'Forgotten password = lost data. I will keep it safe.', 'Забытый пароль = потерянные данные. Я сохраню его надёжно.', 'نسيان كلمة المرور يعني فقدان البيانات. سأحتفظ بها بأمان.'],
    ['Auf diesem Gerät entsperrt halten', 'Keep unlocked on this device', 'Оставить разблокированным на этом устройстве', 'الإبقاء على الخزنة مفتوحة على هذا الجهاز'],
    ['Abbrechen', 'Cancel', 'Отмена', 'إلغاء'],
    ['Weiter', 'Continue', 'Продолжить', 'متابعة'],
    ['Mindestens 10 Zeichen; beide Passwörter müssen übereinstimmen. Hinweis bestätigen.', 'Use at least 10 matching characters and confirm the notice.', 'Не менее 10 символов; пароли должны совпадать. Подтвердите предупреждение.', 'استخدم 10 أحرف على الأقل، وطابق كلمتي المرور وأكّد التنبيه.'],
    ['Passwort falsch oder Speicherort nicht erreichbar. Keine Daten wurden zurückgesetzt.', 'Wrong password or storage unavailable. No data was reset.', 'Неверный пароль или хранилище недоступно. Данные не сброшены.', 'كلمة المرور غير صحيحة أو التخزين غير متاح. لم تتم إعادة تعيين البيانات.'],
    ['Wird geprüft …', 'Checking …', 'Проверка …', 'جارٍ التحقق …']
  ];
  const query = new URLSearchParams(location.search);
  const mode = Number(query.get('modus')) || 0;
  const lang = Math.max(0, ['de', 'en', 'ru', 'ar'].indexOf(query.get('sprache')));
  const t = n => WORDS[n][lang];
  const $ = id => document.getElementById(id);
  document.documentElement.lang = ['de', 'en', 'ru', 'ar'][lang];
  if (lang === 3) document.documentElement.dir = 'rtl';
  $('titel').textContent = t(mode === 0 ? 0 : 1);
  document.title = t(mode === 0 ? 0 : 1);
  $('erstes').placeholder = t(2); $('zweites').placeholder = t(3);
  $('hinweisText').textContent = t(4); $('merkenText').textContent = t(5);
  $('abbrechen').textContent = t(6); $('weiter').textContent = t(7);
  if (mode === 0) { $('zweites').hidden = false; $('hinweisZeile').hidden = false; }
  const invoke = (action, fields) => window.__TAURI_INTERNALS__.invoke('wfp_dialog', { action, fields });
  let busy = false;
  const clear = () => { $('erstes').value = ''; $('zweites').value = ''; };
  async function send() {
    if (busy) return;
    busy = true; $('weiter').disabled = $('abbrechen').disabled = true; $('status').textContent = t(10);
    const fields = { password: $('erstes').value, repeat: $('zweites').value, notice: $('hinweis').checked, remember: $('merken').checked };
    try {
      const answer = await invoke('senden', fields);
      if (answer?.done) { clear(); return; }
      $('status').textContent = t(answer?.status === 8 ? 8 : 9);
      if (answer?.status !== 8) clear();
    } catch { $('status').textContent = t(9); clear(); }
    finally { fields.password = fields.repeat = ''; busy = false; $('weiter').disabled = $('abbrechen').disabled = false; $('erstes').focus(); }
  }
  $('weiter').onclick = send;
  $('abbrechen').onclick = () => { clear(); void invoke('abbrechen'); };
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); void send(); }
    if (event.key === 'Escape' && !busy) { clear(); void invoke('abbrechen'); }
  });
  $('erstes').focus();
})();
