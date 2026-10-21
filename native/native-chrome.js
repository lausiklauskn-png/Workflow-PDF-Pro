/* Replace only the transport factory. Cleaning, page jobs, PDF geometry and
   result checks remain owned by the byte-identical original engine. */
(() => {
  'use strict';
  if (!window.Capacitor?.isNativePlatform?.() || !Capacitor.Plugins.WorkflowChrome || !window.WFP?.Uebersetzung) return;
  const api=Capacitor.Plugins.WorkflowChrome;
  let active;
  const instructions=[
    'Die bereinigten Texte werden in Google Chrome geöffnet. Dort ⋮ → Übersetzen und die Zielsprache wählen. Das Ergebnis wird in der App zum PDF. Der Text geht an Google; das Original bleibt erhalten. Die laufende Benachrichtigung bietet Abbrechen.',
    'Cleaned text opens in Google Chrome. Select ⋮ → Translate and the target language. The app turns the result into a PDF. Text goes to Google; the original is retained. The ongoing notification offers Cancel.',
    'Очищенный текст открывается в Google Chrome. Выберите ⋮ → Перевести и нужный язык. Приложение создаст PDF из результата. Текст передаётся Google; оригинал сохраняется. Отмена доступна в уведомлении.',
    'يُفتح النص المنقّح في Google Chrome. اختر ⋮ ← ترجمة ولغة الهدف. ينشئ التطبيق ملف PDF من النتيجة. يُرسل النص إلى Google ويبقى الأصل محفوظاً. يتيح الإشعار المستمر الإلغاء.'
  ];
  new MutationObserver(()=>{for(const span of document.querySelectorAll('[data-weg="chrome"] > span')){
    const text=instructions[Math.max(0,['de','en','ru','ar'].indexOf(document.documentElement.lang))];if(span.textContent!==text){span.dataset.keinUe='';span.textContent=text;}
  }}).observe(document.body,{subtree:true,childList:true});
  const messages={
    CHROME_NOTIFICATION_REQUIRED:['Bitte Benachrichtigungen für Workflow PDF Pro erlauben, damit die Übersetzung sichtbar abgebrochen werden kann.','Allow Workflow PDF Pro notifications so the translation can be cancelled visibly.','Разрешите уведомления Workflow PDF Pro, чтобы можно было отменить перевод.','اسمح بإشعارات Workflow PDF Pro لتتمكن من إلغاء الترجمة.'],
    CHROME_NOT_INSTALLED:['Bitte Google Chrome installieren und die Übersetzung erneut starten.','Install Google Chrome and start the translation again.','Установите Google Chrome и запустите перевод снова.','ثبّت Google Chrome ثم أعد بدء الترجمة.'],
    stopped:['Übersetzung angehalten. Der bisher gespeicherte Stand bleibt erhalten.','Translation stopped. Previously saved progress is retained.','Перевод остановлен. Сохранённый прогресс сохранён.','توقفت الترجمة. تم الاحتفاظ بالتقدم المحفوظ.'],
    failed:['Chrome-Verbindung fehlgeschlagen. Bitte Chrome und die Benachrichtigungsfreigabe prüfen und erneut starten. Gespeicherte Seiten bleiben erhalten.','Chrome connection failed. Check Chrome and notification permissions, then retry. Saved pages are retained.','Сбой соединения с Chrome. Проверьте Chrome и разрешение уведомлений, затем повторите. Сохранённые страницы остаются.','فشل الاتصال بمتصفح Chrome. تحقّق من Chrome وإذن الإشعارات ثم أعد المحاولة. تبقى الصفحات المحفوظة.']
  };
  const cancelled=reason=>/^CHROME_(CANCELLED|REPLACED|TIME_LIMIT|EXPIRED|APP_CLOSED|SERVICE_STOPPED)$/.test(reason||'');
  const message=reason=>(messages[reason]||messages[cancelled(reason)?'stopped':'failed'])[Math.max(0,['de','en','ru','ar'].indexOf(document.documentElement.lang))];
  Promise.resolve(api.addListener('stopped',event=>{
    if(active?.id===event.id)active.stop(false,cancelled(event.reason));
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
    function stop(closeNative=true,notify=true){
      state.closed=true;
      if(!notify&&active===state)active=null;
      if(closeNative&&state.id)void api.close({id:state.id}).catch(()=>{});
      if(notify&&!state.halted){state.halted=true;if(state.fn.beimHalt)state.fn.beimHalt();}
    }
    const fn=async texte=>{
      try{
        if(state.closed)throw Error('CHROME_CANCELLED');
        if(!Array.isArray(texte)||texte.some(text=>typeof text!=='string'))throw Error('CHROME_INVALID_TEXT');
        const id=await ready;
        // A transport frame is bounded; the document is not. Exceptionally long
        // paragraphs use the source's sentence splitter and keep their single
        // original PDF block after all frames have returned successfully.
        const pieces=[],owners=[],out=texte.map(()=>[]),encoder=new TextEncoder();
        for(let i=0;i<texte.length;i++){
          const chunks=encoder.encode(JSON.stringify(texte[i])).length>262144?WFP.Uebersetzung.saetze(texte[i],12000):[texte[i]];
          for(const chunk of chunks){pieces.push(chunk);owners.push(i);}
        }
        let index=0;
        while(index<pieces.length){
          const batch=[];let bytes=2;
          while(index+batch.length<pieces.length){
            const text=pieces[index+batch.length],size=encoder.encode(JSON.stringify(text)).length+1;
            if(batch.length&&bytes+size>524288)break;batch.push(text);bytes+=size;
          }
          if(state.closed)throw Error('CHROME_CANCELLED');
          const result=await api.translate({id,texte:batch});
          if(state.closed)throw Error('CHROME_CANCELLED');
          if(!Array.isArray(result.texte)||result.texte.length!==batch.length||result.texte.some(text=>typeof text!=='string'))throw Error('CHROME_RESULT_INVALID');
          for(const key of ['zeichen','anfragen','ohne']){
            if(!Number.isSafeInteger(result.stat?.[key])||result.stat[key]<stat[key])throw Error('CHROME_RESULT_INVALID');
          }
          Object.assign(stat,result.stat);for(let i=0;i<batch.length;i++)out[owners[index+i]].push(result.texte[i]);index+=batch.length;
        }
        return out.map(parts=>parts.join(' '));
      }catch(error){stop(true,cancelled(error?.message));throw Error(message(error?.message));}
    };
    state.fn=fn;fn.art='chrome';fn.stat=stat;fn.halt=()=>stop();
    fn.zu=()=>{state.closed=true;if(active===state)active=null;if(state.id)void api.close({id:state.id}).catch(()=>{});};
    return fn;
  };
})();
