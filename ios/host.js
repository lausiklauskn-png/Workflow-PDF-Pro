'use strict';
document.documentElement.dataset.wfpNative = 'ios';

// Keep the shared speech adapter byte-identical. Correct its Android-specific
// explanation only in this Apple host, before the core attaches any buttons.
if (window.Capacitor?.Plugins.WorkflowSpeech && window.WFSprechen) {
  const attach = WFSprechen.anhaengen;
  const label = button => {
    button.title = [
      'Sprechen statt tippen – Apple erkennt die Aufnahme möglichst auf diesem Gerät. Je nach Gerät und Sprache kann die Aufnahme an Apple gesendet werden.',
      'Speak instead of typing – Apple recognizes audio on this device where supported. Depending on your device and language, audio may be sent to Apple.',
      'Голосовой ввод: Apple распознаёт звук на устройстве, если это поддерживается. В зависимости от устройства и языка звук может передаваться Apple.',
      'إدخال صوتي: تتعرّف Apple على الصوت على هذا الجهاز حيثما كان ذلك مدعومًا. قد يُرسل الصوت إلى Apple بحسب الجهاز واللغة.'
    ][Math.max(0, ['de', 'en', 'ru', 'ar'].indexOf(document.documentElement.lang))];
  };
  WFSprechen.anhaengen = options => {
    const result = attach(options);
    if (options.knopf) { options.knopf.dataset.iosSpeech = ''; label(options.knopf); }
    return result;
  };
  document.addEventListener('wfp-sprache', () => document.querySelectorAll('[data-ios-speech]').forEach(label));
}
