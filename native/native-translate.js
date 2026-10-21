/* Native implementation of the Translator capability expected by the original
   on-device path, including its existing retry and sentence splitting. */
(() => {
  'use strict';
  if(!window.Capacitor?.isNativePlatform?.()||!Capacitor.Plugins.WorkflowTranslate)return;
  const api=Capacitor.Plugins.WorkflowTranslate;
  const language=()=>Math.max(0,['de','en','ru','ar'].indexOf(document.documentElement.lang));
  const notice=[
    'Google Translate übersetzt mit heruntergeladenen Sprachmodellen auf diesem Gerät. Texte und Ergebnisse werden dabei nicht an Google gesendet. Das Google-SDK lädt Modelle und übermittelt technische Geräte-, App-, Nutzungs- und Leistungsdaten an Google. Automatische Übersetzungen können Fehler enthalten.',
    'Google Translate uses downloaded language models on this device. Text and results are not sent to Google. The Google SDK downloads models and sends technical device, app, usage and performance data to Google. Automatic translations can contain errors.',
    'Google Translate использует загруженные языковые модели на этом устройстве. Текст и результаты не передаются Google. SDK Google загружает модели и передаёт технические данные устройства, приложения, использования и производительности. Автоматический перевод может содержать ошибки.',
    'يستخدم Google Translate نماذج لغوية محمّلة على هذا الجهاز. لا يُرسل النص أو النتيجة إلى Google. تحمّل حزمة Google النماذج وترسل بيانات تقنية عن الجهاز والتطبيق والاستخدام والأداء إلى Google. قد تحتوي الترجمة الآلية على أخطاء.'
  ];
  let accepted=false,pendingConsent;
  try{accepted=localStorage.getItem('wfp_native_google_models_consent_v1')==='yes';}catch{}
  function consent(){
    if(accepted)return Promise.resolve(true);if(pendingConsent)return pendingConsent;
    pendingConsent=new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='native-vault-dialog native-translate-consent';dialog.dataset.keinUe='';
      const heading=document.createElement('h2'),text=document.createElement('p'),terms=document.createElement('a'),cancel=document.createElement('button'),yes=document.createElement('button');
      heading.textContent='Google Translate';text.textContent=notice[language()];terms.textContent=['Datenschutz und Bedingungen','Privacy and terms','Конфиденциальность и условия','الخصوصية والشروط'][language()];terms.href='https://developers.google.com/ml-kit/terms';terms.target='_blank';terms.rel='noopener noreferrer';
      cancel.textContent=['Zurück','Back','Назад','رجوع'][language()];yes.textContent=['Google-Modelle verwenden','Use Google models','Использовать модели Google','استخدام نماذج Google'][language()];yes.dataset.accept='';cancel.className=yes.className='knopf';
      let chosen=false;yes.onclick=()=>{chosen=true;dialog.close();};cancel.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();pendingConsent=null;if(chosen){accepted=true;try{localStorage.setItem('wfp_native_google_models_consent_v1','yes');}catch{}}resolve(chosen);});
      dialog.append(heading,text,terms,document.createElement('p'),cancel,yes);document.body.append(dialog);dialog.showModal();
    });return pendingConsent;
  }
  class LocalTranslator {
    constructor(id){this.id=id;}
    static async availability(options){
      const result=await api.availability({from:options.sourceLanguage,to:options.targetLanguage});
      if(!['available','downloadable','unavailable'].includes(result.status))throw Error('LOCAL_MODELS_UNAVAILABLE');return result.status;
    }
    static async create(options){
      if(!await consent())throw new DOMException('Google Translate: cancelled','NotAllowedError');
      await api.activate();
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
  const titles=['📱 Mit Google auf dem Gerät übersetzen','📱 Translate with Google on this device','📱 Перевести с Google на устройстве','📱 الترجمة باستخدام Google على الجهاز'];
  function information(){
    const dialog=document.createElement('dialog');dialog.className='native-vault-dialog';dialog.dataset.keinUe='';const title=document.createElement('h2'),text=document.createElement('p'),link=document.createElement('a'),close=document.createElement('button');
    title.textContent='Google Translate';text.textContent=notice[language()];link.href='https://developers.google.com/ml-kit/terms';link.target='_blank';link.rel='noopener noreferrer';link.textContent=['Datenschutz und Bedingungen','Privacy and terms','Конфиденциальность и условия','الخصوصية والشروط'][language()];
    close.className='knopf';close.textContent=['Schließen','Close','Закрыть','إغلاق'][language()];close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.append(title,text,link,document.createElement('p'),close);document.body.append(dialog);dialog.showModal();
  }
  function credit(){const link=document.createElement('a');link.textContent='powered by Google Translate';link.href='https://translate.google.com';link.target='_blank';link.rel='noopener noreferrer';link.className='native-google-credit';link.dataset.keinUe='';return link;}
  function label(){
    const backup=document.getElementById('stSicherung');if(backup&&!document.getElementById('stGooglePrivacy')){const button=document.createElement('button');button.id='stGooglePrivacy';button.className='knopf';button.dataset.keinUe='';button.textContent=['Google-Übersetzung und Datenschutz','Google translation and privacy','Перевод Google и конфиденциальность','ترجمة Google والخصوصية'][language()];button.onclick=information;backup.parentElement.append(button);}
    for(const title of document.querySelectorAll('[data-weg="browser"] > b')){
      const text=titles[language()];if(title.textContent!==text)title.textContent=text;
      let small=title.parentElement.querySelector('[data-google-model-notice]');if(!small){small=document.createElement('small');small.dataset.googleModelNotice='';small.dataset.keinUe='';title.parentElement.append(small);}if(small.textContent!==notice[language()])small.textContent=notice[language()];
    }
    const editor=document.getElementById('sc-ed');
    if(editor){let attribution=editor.querySelector(':scope > .native-google-credit');if(!attribution){attribution=credit();editor.insertBefore(attribution,document.getElementById('edFlaeche'));}attribution.hidden=window.__wfpdf?.S.doc?.uebersetzung?.weg!=='browser';}
    for(const nav of document.querySelectorAll('.native-pdf-view nav'))if(window.__wfpdf?.S.doc?.uebersetzung?.weg==='browser'&&!nav.querySelector('.native-google-credit'))nav.append(credit());
  }
  new MutationObserver(label).observe(document.body,{subtree:true,childList:true});
})();
