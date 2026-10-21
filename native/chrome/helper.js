// Host-neutral browser half of trial A. Uses the byte-identical original engine.
(async () => {
  'use strict';
  let key = location.hash.slice(1), engine, lastId = 0, cancelled=false, cancelling;
  history.replaceState(null, '', '/');
  const status = document.getElementById('status');
  let language=0;
  const words={
    privacy:['Übersetzen mit Chrome: Der Text geht dabei an Google. Das Original bleibt in der App.','Chrome translation sends this text to Google. The original stays in the app.','Перевод в Chrome отправляет текст в Google. Оригинал остаётся в приложении.','ترجمة Chrome ترسل هذا النص إلى Google. يبقى الأصل في التطبيق.'],
    back:['Nach Abschluss zurück zur App wechseln. Schließen dieses Tabs ersetzt keinen Abbruch in der App.','Return to the app when finished. Closing this tab does not cancel the task in the app.','После завершения вернитесь в приложение. Закрытие вкладки не отменяет задачу в приложении.','عُد إلى التطبيق بعد الانتهاء. إغلاق هذه الصفحة لا يلغي المهمة في التطبيق.'],
    waiting:['Warte auf die nächste Seite aus der App …','Waiting for the next page from the app …','Ожидание следующей страницы из приложения …','بانتظار الصفحة التالية من التطبيق …'],
    translate:['In Chrome ⋮ → Übersetzen wählen. Die App wartet auf das Ergebnis.','In Chrome select ⋮ → Translate. The app is waiting for the result.','В Chrome выберите ⋮ → Перевести. Приложение ожидает результат.','في Chrome اختر ⋮ ← ترجمة. التطبيق ينتظر النتيجة.'],
    done:['Seite an die App zurückgegeben. Dort wird das PDF erstellt.','Page returned to the app, which creates the PDF.','Страница возвращена в приложение для создания PDF.','أُعيدت الصفحة إلى التطبيق لإنشاء PDF.'],
    stopped:['Verbindung beendet. Bitte zur App wechseln und dort fortsetzen.','Connection ended. Return to the app to continue.','Соединение завершено. Вернитесь в приложение.','انتهى الاتصال. عُد إلى التطبيق للمتابعة.']
  };
  const say=key=>words[key][language];
  const request = async (path, data) => {
    const response = await fetch(path, {
      method: data === undefined ? 'GET' : 'POST',
      cache: 'no-store', credentials: 'omit', redirect: 'error',
      headers: { Authorization: 'Bearer ' + key, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    if (!response.ok) throw new Error('Verbindung beendet (' + response.status + ').');
    return response.json();
  };
  try {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Diese Sitzung fehlt oder ist abgelaufen. In der App erneut starten.');
    for (;;) {
      const next = await request('/batch');
      if (next.waiting || next.id === lastId) {
        status.textContent = say('waiting');
        await new Promise(resolve => setTimeout(resolve, 400)); continue;
      }
      lastId = next.id;
      language=Math.max(0,['de','en','ru','ar'].indexOf(next.uiLang));
      document.documentElement.dir=language===3?'rtl':'ltr';
      document.getElementById('privacy').textContent=say('privacy');
      document.getElementById('return').textContent=say('back');
      if (!engine) {
        engine = WFP.Uebersetzung.chromeUebersetzer(next.von, next.nach);
        engine.beimHalt = () => { cancelled=true;cancelling=request('/cancel', {}).catch(() => {}); };
      }
      status.textContent = say('translate');
      try {
        const texte = await engine(next.texte);
        await request('/result', { id: next.id, texte, stat: engine.stat });
        // No document text remains on screen between pages or after completion.
        const list = document.querySelector('#wfp-chrome [data-liste]'); if (list) list.replaceChildren();
        status.textContent = say('done');
      } catch (error) {
        // The engine rejects its waiter on an explicit user cancellation too.
        // Keep that action distinct from a failed translation on both hosts.
        if(cancelled)await cancelling;
        else await request('/result', { id: next.id, error: 'translation-failed' }).catch(() => {});
        throw error;
      }
    }
  } catch (error) {
    key = '';
    if (engine) { engine.beimHalt = null; engine.halt(); engine.zu(); }
    status.textContent = say('stopped');
  }
})();
