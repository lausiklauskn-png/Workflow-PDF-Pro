/* „Auf Updates prüfen“ in der Android-App (Leitfaden § 6, Klaus 2026-10-28): immer mit Version —
   „Du verwendest die aktuelle Version 1.0.6.“ / „Neu: 1.0.7 (du hast 1.0.6)“. Nur auf Tipp; Java liest die öffentlichen
   GitHub-Veröffentlichungen (WorkflowUpdates). „Herunterladen“ öffnet die feste Seite der Veröffentlichung, installiert nichts.
   Windows hat seinen eigenen Weg (windows/bridge/updates.js). */
(() => {
  'use strict';
  if(!window.Capacitor?.isNativePlatform?.())return;
  const api=Capacitor.Plugins?.WorkflowUpdates;if(typeof api?.check!=='function')return;
  const words={
    check:['Auf Updates prüfen','Check for updates','Проверить обновления','البحث عن تحديثات'],
    hint:['Prüft die öffentlichen Veröffentlichungen auf GitHub. Dabei wird eine Verbindung zu GitHub aufgebaut; Dokumente gehen nicht mit.','Checks the public releases on GitHub. This connects to GitHub; documents are not sent.','Проверяет публичные выпуски на GitHub. Устанавливается соединение с GitHub; документы не передаются.','يتحقق من الإصدارات العامة على GitHub. يتصل بـ GitHub؛ لا تُرسل المستندات.'],
    checking:['Prüfung läuft …','Checking …','Проверка …','جارٍ التحقق …'],
    download:['Neue Version herunterladen','Download new version','Загрузить новую версию','تنزيل الإصدار الجديد'],
    failed:['Updateprüfung gerade nicht möglich. Verbindung prüfen und später erneut versuchen.','Unable to check for updates right now. Check the connection and try again later.','Проверка обновлений сейчас невозможна. Проверьте соединение и повторите позже.','تعذّر التحقق من التحديثات الآن. تحقق من الاتصال وأعد المحاولة لاحقاً.'],
    openFailed:['Die Seite ließ sich nicht öffnen.','The page could not be opened.','Не удалось открыть страницу.','تعذّر فتح الصفحة.']
  };
  const t=key=>words[key][Math.max(0,['de','en','ru','ar'].indexOf(document.documentElement.lang))];
  let busy=false,result=null,fehler='';
  function zeichnen(box){
    const P=window.ProBedienung,stand=box.querySelector('#stUpdatesStand'),knoepfe=box.querySelector('.pro-knoepfe');
    knoepfe.replaceChildren();
    const k=(text,tipp,haupt)=>{const b=P?P.knopf(text,{beiTipp:tipp,haupt}):Object.assign(document.createElement('button'),{type:'button',className:'knopf',textContent:text,onclick:tipp});knoepfe.append(b);return b;};
    const pruefen=k(t('check'),()=>void pruefe(box),false);pruefen.id='stUpdates';pruefen.title=t('hint');pruefen.disabled=busy;
    stand.textContent=busy?t('checking'):fehler?fehler:result?(P?P.versionSatz(result.installiert,result.status==='available'?result.version:undefined):result.version):'';
    if(result?.status==='available'&&!busy){const d=k(t('download'),async()=>{try{await api.openDownload();}catch{stand.textContent=t('openFailed');}},true);d.id='stUpdatesLaden';}
  }
  async function pruefe(box){
    if(busy)return;busy=true;fehler='';zeichnen(box);
    try{result=await api.check();}catch{result=null;fehler=t('failed');}
    finally{busy=false;if(box.isConnected)zeichnen(box);}
  }
  function einsetzen(){
    const backup=document.getElementById('stSicherung');
    if(!backup||document.getElementById('stUpdatesKasten'))return;
    const box=document.createElement('div');box.id='stUpdatesKasten';box.dataset.keinUe='';
    const stand=document.createElement('p');stand.id='stUpdatesStand';stand.className='hinweis';stand.setAttribute('role','status');
    const knoepfe=document.createElement('div');knoepfe.className='pro-knoepfe';
    box.append(knoepfe,stand);backup.parentElement.after(box);zeichnen(box);
  }
  new MutationObserver(einsetzen).observe(document.documentElement,{childList:true,subtree:true});
  window.WFPNativeUpdates=Object.freeze({pruefe:()=>{const b=document.getElementById('stUpdatesKasten');return b?pruefe(b):null;}});
})();
