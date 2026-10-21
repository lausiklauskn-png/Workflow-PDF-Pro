/* Replace only the transport factory. Cleaning, page jobs, PDF geometry and
   result checks remain owned by the byte-identical original engine. */
(() => {
  'use strict';
  if (!window.Capacitor?.isNativePlatform?.() || !Capacitor.Plugins.WorkflowChrome || !window.WFP?.Uebersetzung) return;
  const api=Capacitor.Plugins.WorkflowChrome;
  let active;
  const messages={
    CHROME_NOTIFICATION_REQUIRED:['Bitte Benachrichtigungen für Workflow PDF Pro erlauben, damit die Übersetzung sichtbar abgebrochen werden kann.','Allow Workflow PDF Pro notifications so the translation can be cancelled visibly.','Разрешите уведомления Workflow PDF Pro, чтобы можно было отменить перевод.','اسمح بإشعارات Workflow PDF Pro لتتمكن من إلغاء الترجمة.'],
    CHROME_NOT_INSTALLED:['Bitte Google Chrome installieren und die Übersetzung erneut starten.','Install Google Chrome and start the translation again.','Установите Google Chrome и запустите перевод снова.','ثبّت Google Chrome ثم أعد بدء الترجمة.'],
    stopped:['Übersetzung angehalten. Der bisher gespeicherte Stand bleibt erhalten.','Translation stopped. Previously saved progress is retained.','Перевод остановлен. Сохранённый прогресс сохранён.','توقفت الترجمة. تم الاحتفاظ بالتقدم المحفوظ.']
  };
  const message=reason=>(messages[reason]||messages.stopped)[Math.max(0,['de','en','ru','ar'].indexOf(document.documentElement.lang))];
  Promise.resolve(api.addListener('stopped',event=>{
    if(active?.id===event.id)active.stop(false);
  })).catch(()=>{});
  WFP.Uebersetzung.chromeUebersetzer=(von,nach)=>{
    if(active)active.fn.zu();
    const state={id:null,closed:false,halted:false,fn:null,stop};
    active=state;
    const stat={zeichen:0,anfragen:0,ohne:0,modell:'Chrome (Google)'};
    // Begin while the initiating Activity is visible. No text or browser URL
    // exists at this point; the original cleaning confirmation runs afterwards.
    const ready=api.begin({von,nach,language:document.documentElement.lang}).then(async result=>{
      if(typeof result.id!=='string'||!result.id)throw Error('CHROME_SESSION_INVALID');
      state.id=result.id;
      if(state.closed){await api.close({id:state.id});throw Error('CHROME_CANCELLED');}
      return result.id;
    });
    ready.catch(()=>{});
    function stop(closeNative=true){
      if(state.halted)return;state.halted=true;state.closed=true;
      if(closeNative&&state.id)void api.close({id:state.id}).catch(()=>{});
      if(state.fn.beimHalt)state.fn.beimHalt();
    }
    const fn=async texte=>{
      try{
        if(state.closed)throw Error('CHROME_CANCELLED');
        if(!Array.isArray(texte)||texte.some(text=>typeof text!=='string'))throw Error('CHROME_INVALID_TEXT');
        const id=await ready;
        const result=await api.translate({id,texte});
        if(state.closed)throw Error('CHROME_CANCELLED');
        if(!Array.isArray(result.texte)||result.texte.length!==texte.length||result.texte.some(text=>typeof text!=='string'))throw Error('CHROME_RESULT_INVALID');
        for(const key of ['zeichen','anfragen','ohne']){
          if(!Number.isSafeInteger(result.stat?.[key])||result.stat[key]<stat[key])throw Error('CHROME_RESULT_INVALID');
        }
        Object.assign(stat,result.stat);return result.texte;
      }catch(error){stop();throw Error(message(error?.message));}
    };
    state.fn=fn;fn.art='chrome';fn.stat=stat;fn.halt=()=>stop();
    fn.zu=()=>{state.closed=true;if(state.id)void api.close({id:state.id}).catch(()=>{});if(active===state)active=null;};
    return fn;
  };
})();
