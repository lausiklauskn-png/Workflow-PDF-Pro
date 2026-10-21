/* Web Speech event shape for the unchanged WFSprechen input/bar/dedup logic. */
(() => {
  'use strict';
  if(!window.Capacitor?.isNativePlatform?.()||!Capacitor.Plugins.WorkflowSpeech)return;
  const api=Capacitor.Plugins.WorkflowSpeech,sessions=new Map();
  class NativeRecognition {
    lang='de-DE';interimResults=true;continuous=true;maxAlternatives=1;
    start(){
      if(this.id)throw new DOMException('Already started','InvalidStateError');
      const id=this.id=crypto.randomUUID();sessions.set(id,this);
      Promise.resolve(api.start({id,language:this.lang})).catch(error=>{
        if(this.id!==id)return;
        this.onerror?.({error:error?.message||'audio-capture'});this.end();
      });
    }
    stop(){if(this.id)void api.stop({id:this.id,abort:false}).catch(()=>this.end());}
    abort(){if(this.id)void api.stop({id:this.id,abort:true}).catch(()=>{});this.end();}
    end(){if(!this.id)return;sessions.delete(this.id);this.id=null;this.onend?.();}
  }
  Promise.resolve(api.addListener('speech',event=>{
    const rec=sessions.get(event.id);if(!rec)return;
    if(event.kind==='end'){rec.end();return;}
    if(event.kind==='result'){
      if(typeof event.text!=='string'||typeof event.final!=='boolean')return;
      const result=[{transcript:event.text,confidence:0}];result.isFinal=event.final;
      rec.onresult?.({resultIndex:0,results:[result]});return;
    }
    if(event.kind==='error'){rec.onerror?.({error:event.error});return;}
    if(['start','speechstart','speechend'].includes(event.kind))rec['on'+event.kind]?.();
  })).catch(()=>{});
  window.SpeechRecognition=NativeRecognition;
  if(window.WFSprechen){
    const attach=WFSprechen.anhaengen;
    WFSprechen.anhaengen=options=>{
      const input=attach(options);
      if(options.knopf)options.knopf.title=[
        'Sprechen statt tippen – die Aufnahme verarbeitet die auf Android gewählte Spracherkennung; sie kann sie an ihren Anbieter senden.',
        'Speak instead of typing – your selected Android recognition service processes audio and may send it to its provider.',
        'Голосовой ввод: выбранная служба Android обрабатывает звук и может отправить его своему провайдеру.',
        'إدخال صوتي: تعالج خدمة التعرّف المحددة في Android الصوت وقد ترسله إلى مزوّدها.'
      ][Math.max(0,['de','en','ru','ar'].indexOf(document.documentElement.lang))];
      return input;
    };
  }
})();
