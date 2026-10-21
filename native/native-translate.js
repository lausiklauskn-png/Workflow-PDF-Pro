/* Native implementation of the Translator capability expected by the original
   on-device path, including its existing retry and sentence splitting. */
(() => {
  'use strict';
  if(!window.Capacitor?.isNativePlatform?.()||!Capacitor.Plugins.WorkflowTranslate)return;
  const api=Capacitor.Plugins.WorkflowTranslate;
  class LocalTranslator {
    constructor(id){this.id=id;}
    static async availability(options){
      const result=await api.availability({from:options.sourceLanguage,to:options.targetLanguage});
      if(!['available','downloadable','unavailable'].includes(result.status))throw Error('LOCAL_MODELS_UNAVAILABLE');return result.status;
    }
    static async create(options){
      const monitor=new EventTarget();options.monitor?.(monitor);
      monitor.dispatchEvent(new ProgressEvent('downloadprogress',{loaded:0,total:1,lengthComputable:false}));
      const result=await api.create({from:options.sourceLanguage,to:options.targetLanguage});
      if(typeof result.id!=='string'||!result.id)throw Error('LOCAL_TRANSLATOR_UNAVAILABLE');
      monitor.dispatchEvent(new ProgressEvent('downloadprogress',{loaded:1,total:1,lengthComputable:true}));
      return new LocalTranslator(result.id);
    }
    async translate(text){
      if(!this.id)throw new DOMException('Translator closed','AbortError');
      const id=this.id,result=await api.translate({id,text:String(text)});
      if(this.id!==id)throw new DOMException('Translator closed','AbortError');
      if(typeof result.text!=='string')throw Error('LOCAL_TRANSLATION_FAILED');return result.text;
    }
    destroy(){const id=this.id;this.id=null;if(id)void api.destroy({id}).catch(()=>{});}
  }
  window.Translator=LocalTranslator;
  // The source retains its controls and language choices. Name the actual host
  // capability truthfully without rewriting the pinned core or translated UI.
  const titles=['📱 Übersetzer auf dem Gerät','📱 On-device translator','📱 Переводчик на устройстве','📱 المترجم على الجهاز'];
  function label(){for(const title of document.querySelectorAll('[data-weg="browser"] > b')){
    const text=titles[Math.max(0,['de','en','ru','ar'].indexOf(document.documentElement.lang))];if(title.textContent!==text)title.textContent=text;
  }}
  new MutationObserver(label).observe(document.body,{subtree:true,childList:true});
})();
