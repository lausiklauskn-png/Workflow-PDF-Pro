/* Passwortfenster des Windows-Hosts, Gegenstück zum Android-Passwortdialog.
   Passwort und Ersatzschlüssel gehen nur an den Rust-Host, nie an die Webseite des Hauptfensters. */
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
    ['Wird geprüft …', 'Checking …', 'Проверка …', 'جارٍ التحقق …'],
    ['Passwort vergessen?', 'Forgot password?', 'Забыли пароль?', 'نسيت كلمة المرور؟'],
    ['Mit Ersatzschlüsseln öffnen', 'Open with recovery keys', 'Открыть ключами восстановления', 'الفتح بمفاتيح الاسترداد'],
    ['Drei verschiedene Ersatzschlüssel eingeben und ein neues Passwort festlegen.', 'Enter three different recovery keys and choose a new password.', 'Введите три разных ключа восстановления и задайте новый пароль.', 'أدخل ثلاثة مفاتيح استرداد مختلفة واختر كلمة مرور جديدة.'],
    ['Ersatzschlüssel', 'Recovery key', 'Ключ восстановления', 'مفتاح الاسترداد'],
    ['Neues Passwort', 'New password', 'Новый пароль', 'كلمة مرور جديدة'],
    ['Neues Passwort wiederholen', 'Repeat new password', 'Повторите новый пароль', 'أعد كتابة كلمة المرور الجديدة'],
    ['Wiederherstellen', 'Recover', 'Восстановить', 'استرداد'],
    ['Ein Ersatzschlüssel ist falsch abgetippt. Bitte Zeichen für Zeichen prüfen.', 'A recovery key contains a typo. Please check it character by character.', 'Ключ восстановления введён с ошибкой. Проверьте его посимвольно.', 'يحتوي أحد مفاتيح الاسترداد على خطأ. يرجى التحقق منه حرفاً حرفاً.'],
    ['Bitte drei verschiedene Ersatzschlüssel desselben Satzes eingeben.', 'Enter three different recovery keys from the same set.', 'Введите три разных ключа из одного набора.', 'أدخل ثلاثة مفاتيح مختلفة من المجموعة نفسها.'],
    ['Diese Ersatzschlüssel gehören nicht zu diesem Tresor oder sind veraltet.', 'These recovery keys do not belong to this vault or are outdated.', 'Эти ключи не относятся к этому хранилищу или устарели.', 'مفاتيح الاسترداد هذه لا تخص هذه الخزنة أو أنها قديمة.'],
    ['Neues Passwort: mindestens 10 Zeichen, beide gleich.', 'New password: at least 10 characters, both identical.', 'Новый пароль: не менее 10 символов, оба одинаковые.', 'كلمة المرور الجديدة: 10 أحرف على الأقل ومتطابقة.'],
    ['Wiederherstellung nicht möglich. Keine Daten wurden verändert.', 'Recovery not possible. No data was changed.', 'Восстановление невозможно. Данные не изменены.', 'تعذر الاسترداد. لم تتغير أي بيانات.']
  ];
  const RECOVERY = { VAULT_RECOVERY_TYPO: 18, VAULT_RECOVERY_INCOMPLETE: 19, VAULT_RECOVERY_MIXED: 19, VAULT_RECOVERY_DUPLICATE: 19, VAULT_RECOVERY_UNKNOWN: 20, VAULT_RECOVERY_INVALID: 20, VAULT_PASSWORD_SHORT: 21 };
  const query = new URLSearchParams(location.search);
  const mode = Number(query.get('modus')) || 0;
  const lang = Math.max(0, ['de', 'en', 'ru', 'ar'].indexOf(query.get('sprache')));
  const t = n => WORDS[n][lang];
  const $ = id => document.getElementById(id);
  let recovering = false;
  document.documentElement.lang = ['de', 'en', 'ru', 'ar'][lang];
  if (lang === 3) document.documentElement.dir = 'rtl';
  $('titel').textContent = t(mode === 0 ? 0 : 1);
  document.title = t(mode === 0 ? 0 : 1);
  $('erstes').placeholder = t(2); $('zweites').placeholder = t(3);
  $('hinweisText').textContent = t(4); $('merkenText').textContent = t(5);
  $('abbrechen').textContent = t(6); $('weiter').textContent = t(7);
  $('vergessen').textContent = t(11); $('ersatzHilfe').textContent = t(13);
  for (const n of [1, 2, 3]) $('teil' + n).placeholder = t(14) + ' ' + n + ' (WFP1-…)';
  $('neu1').placeholder = t(15); $('neu2').placeholder = t(16);
  if (mode === 0) { $('zweites').hidden = false; $('hinweisZeile').hidden = false; }
  else $('vergessenZeile').hidden = false;
  const invoke = (action, fields) => window.__TAURI_INTERNALS__.invoke('wfp_dialog', { action, fields });
  let busy = false;
  const clear = () => { for (const id of ['erstes', 'zweites', 'teil1', 'teil2', 'teil3', 'neu1', 'neu2']) $(id).value = ''; };
  function switchToRecovery() {
    recovering = true; clear();
    $('normal').hidden = true; $('ersatz').hidden = false; $('vergessenZeile').hidden = true;
    $('titel').textContent = document.title = t(12); $('weiter').textContent = t(17); $('status').textContent = '';
    $('teil1').focus();
  }
  async function send() {
    if (busy) return;
    if (recovering && ($('neu1').value.length < 10 || $('neu1').value.normalize('NFC') !== $('neu2').value.normalize('NFC'))) { $('status').textContent = t(21); return; }
    busy = true; $('weiter').disabled = $('abbrechen').disabled = true; $('status').textContent = t(10);
    const fields = recovering
      ? { keys: [$('teil1').value, $('teil2').value, $('teil3').value], password: $('neu1').value, repeat: $('neu2').value, remember: $('merken').checked }
      : { password: $('erstes').value, repeat: $('zweites').value, notice: $('hinweis').checked, remember: $('merken').checked };
    try {
      const answer = await invoke(recovering ? 'ersatz' : 'senden', fields);
      if (answer?.done) { clear(); return; }
      if (recovering) { $('status').textContent = t(RECOVERY[answer?.code] ?? 22); $('neu1').value = $('neu2').value = ''; }
      else { $('status').textContent = t(answer?.status === 8 ? 8 : 9); if (answer?.status !== 8) clear(); }
    } catch { $('status').textContent = t(recovering ? 22 : 9); if (!recovering) clear(); }
    finally {
      if (fields.keys) fields.keys.fill('');
      fields.password = fields.repeat = '';
      busy = false; $('weiter').disabled = $('abbrechen').disabled = false;
      (recovering ? $('teil1') : $('erstes')).focus();
    }
  }
  $('weiter').onclick = send;
  $('vergessen').onclick = switchToRecovery;
  $('abbrechen').onclick = () => { clear(); void invoke('abbrechen'); };
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); void send(); }
    if (event.key === 'Escape' && !busy) { clear(); void invoke('abbrechen'); }
  });
  $('erstes').focus();
})();
