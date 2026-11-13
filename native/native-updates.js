/* „Auf Updates prüfen“ in der Android-App (Leitfaden § 6, Klaus 2026-10-28): immer mit Version —
   „Du verwendest die aktuelle Version 1.0.6.“ / „Neu: 1.0.7 (du hast 1.0.6)“. Nur auf Tipp; Java liest die öffentlichen
   GitHub-Veröffentlichungen (WorkflowUpdates). „Herunterladen“ öffnet die feste Seite der Veröffentlichung, installiert nichts.
   Windows hat seinen eigenen Weg (windows/bridge/updates.js).
   Update-Fähnchen (Klaus 2026-11-13): dieselbe Brücke wird zusätzlich STILL gefragt — kurz nach dem Start und beim Zurückholen der
   App, höchstens einmal je Stunde. Steht eine neuere Fassung bereit, erscheint neben der Version im Kopf „Update X.Y.Z“.
   Direkt laden (Klaus 2026-11-13: „nicht in den Einstellungen … direkt soll es geladen werden, genau wie bei Familienakte und
   BookLedgerPro“): ein Tipp auf das Fähnchen ODER auf die Versionsnummer lädt die APK und öffnet Androids Installieren-Fenster
   (WorkflowUpdates.install, prüft Größe, SHA-256, Paket, Zertifikat, versionCode). Die Versionsnummer öffnet nicht mehr die
   Einstellungen – dafür ist das Zahnrad da; ist die App aktuell, sagt eine kurze Meldung das. Ohne install (Windows, ältere Hülle):
   die Seite der Veröffentlichung. Aktuell, ohne Netz oder Fehler bei der stillen Frage: nichts, keine Meldung. */
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
    flag:['Update','Update','Обновление','تحديث'],
    flagHint:['Update {v} steht bereit. Antippen zum Aktualisieren.','Update {v} is available. Tap to update.','Доступно обновление {v}. Нажмите, чтобы обновить.','التحديث {v} متاح. اضغط للتحديث.'],
    openFailed:['Die Seite ließ sich nicht öffnen.','The page could not be opened.','Не удалось открыть страницу.','تعذّر فتح الصفحة.'],
    current:['Aktuelle Version {v}','Current version {v}','Текущая версия {v}','الإصدار الحالي {v}'],
    loading:['Lädt {p} %','Loading {p} %','Загрузка {p} %','جارٍ التحميل {p} %'],
    allow:['Erlaube „Apps installieren“ und tippe dann noch einmal auf das Update.','Allow “Install apps”, then tap the update again.','Разрешите «Установку приложений» и нажмите обновление ещё раз.','اسمح بـ«تثبيت التطبيقات» ثم اضغط على التحديث مرة أخرى.'],
    installFailed:['Update ließ sich nicht laden. Später noch einmal antippen.','The update could not be loaded. Tap again later.','Не удалось загрузить обновление. Нажмите позже ещё раз.','تعذّر تحميل التحديث. اضغط مرة أخرى لاحقاً.']
  };
  const t=key=>words[key][Math.max(0,['de','en','ru','ar'].indexOf(document.documentElement.lang))];
  let busy=false,result=null,fehler='',lauf=null;
  // Eine Anfrage zur Zeit: Android weist eine zweite gleichzeitige ab (UPDATE_BUSY). Wer während der stillen Prüfung tippt, wartet auf sie.
  const frage=()=>lauf||(lauf=Promise.resolve().then(()=>api.check()).finally(()=>{lauf=null;}));
  const STILL_KEY='wpp_update_still_v1',STUNDE=60*60*1000,START_MS=2500;
  const zahl=v=>{const m=String(v||'').match(/^v?(\d+)\.(\d+)\.(\d+)/);return m?[+m[1],+m[2],+m[3]]:null;};
  const neuer=(a,b)=>{const x=zahl(a),y=zahl(b);if(!x||!y)return false;for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i];return false;};
  const ich=()=>(String(document.querySelector('meta[name="wfp-version"]')?.content||'').match(/^\d+\.\d+\.\d+/)||[''])[0];
  const gemerkt=()=>{try{const g=JSON.parse(localStorage.getItem(STILL_KEY)||'null');return g&&typeof g==='object'?g:null;}catch{return null;}};
  const merken=g=>{try{localStorage.setItem(STILL_KEY,JSON.stringify(g));}catch{/* ohne Speicher: nur für diese Sitzung */}};
  let fahneVersion='';
  function fahne(){
    // Gezeigt wird nur eine Fassung, die neuer ist als die laufende App (nach dem Update ist das Fähnchen von selbst weg).
    const v=fahneVersion&&zahl(fahneVersion)&&(!ich()||neuer(fahneVersion,ich()))?fahneVersion:'';
    let b=document.getElementById('wppUpdateFahne');
    if(!v){b?.remove();delete document.documentElement.dataset.wppUpdate;return;}
    const anker=document.getElementById('wppKopfVersion')||document.querySelector('header.kopf .marke .marke-name');
    if(!anker)return;
    if(!b){
      b=document.createElement('button');b.type='button';b.id='wppUpdateFahne';b.className='wpp-update-fahne';b.dataset.keinUe='';
      const kurz=document.createElement('span');kurz.className='wpp-fahne-kurz';kurz.setAttribute('aria-hidden','true');kurz.textContent='\u2191';
      const lang=document.createElement('span');lang.className='wpp-fahne-lang';
      const nr=document.createElement('span');nr.className='wpp-fahne-nr';
      b.append(kurz,lang,nr);
      b.addEventListener('click',()=>void direkt());
    }
    if(anker.nextElementSibling!==b)anker.after(b);
    b.querySelector('.wpp-fahne-lang').textContent=t('flag')+' ';b.querySelector('.wpp-fahne-nr').textContent=v;
    b.dataset.update=v;b.title=t('flagHint').replace('{v}',v);b.setAttribute('aria-label',b.title);
    document.documentElement.dataset.wppUpdate=v;
  }
  const uebernehmen=r=>{fahneVersion=r?.status==='available'&&zahl(r.version)?zahl(r.version).join('.'):'';fahne();};
  async function still(){
    if(document.visibilityState==='hidden')return;
    const g=gemerkt(),jetzt=Date.now();
    if(g&&Number.isFinite(g.zeit)&&jetzt>=g.zeit&&jetzt-g.zeit<STUNDE){if(!lauf)uebernehmen(g.status==='available'?g:null);return;}
    merken({zeit:jetzt,status:g?.status||'',version:g?.version||''});   // auch ein Fehlschlag zählt: höchstens eine Anfrage je Stunde
    try{
      const r=await frage();
      merken({zeit:jetzt,status:r?.status==='available'?'available':'current',version:String(r?.version||'')});
      result=r;uebernehmen(r);
      const box=document.getElementById('stUpdatesKasten');if(box&&!busy){fehler='';zeichnen(box);}
    }catch{/* ohne Netz oder Fehler: still, keine Meldung, ein schon gezeigtes Fähnchen bleibt */}
  }
  // Kurze Meldung unter dem Kopf (kein Dialog), verschwindet nach ein paar Sekunden.
  let meldungUhr=0;
  function melden(text){
    let m=document.getElementById('wppUpdateMeldung');
    if(!m){m=document.createElement('div');m.id='wppUpdateMeldung';m.className='wpp-update-meldung';m.setAttribute('role','status');m.dataset.keinUe='';document.body.append(m);}
    m.textContent=text;m.hidden=false;clearTimeout(meldungUhr);meldungUhr=setTimeout(()=>{m.hidden=true;},4000);
  }
  let laedt=false;
  // Tipp auf Fähnchen oder Versionsnummer: prüfen (falls nötig), dann direkt laden und installieren.
  async function direkt(){
    if(laedt)return;laedt=true;
    const b=()=>document.getElementById('wppUpdateFahne');
    try{
      let r=result;
      if(r?.status!=='available'){r=result=await frage();uebernehmen(r);merken({zeit:Date.now(),status:r?.status==='available'?'available':'current',version:String(r?.version||'')});}
      if(r?.status!=='available'){melden(t('current').replace('{v}',r?.installiert||r?.version||ich()));return;}
      if(typeof api.install!=='function'||!r.apk){await api.openDownload();return;}
      const hoerer=await api.addListener?.('stand',e=>{const f=b();if(f&&e?.groesse)f.querySelector('.wpp-fahne-lang').textContent=t('loading').replace('{p}',String(Math.min(99,Math.floor(e.geladen*100/e.groesse))))+' ';});
      try{
        const aus=await api.install();
        if(aus?.erlaubnis)melden(t('allow'));
      }finally{try{await hoerer?.remove?.();}catch{/* egal */}fahne();}
    }catch{melden(t('installFailed'));}
    finally{laedt=false;}
  }
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
    try{result=await frage();uebernehmen(result);merken({zeit:Date.now(),status:result?.status==='available'?'available':'current',version:String(result?.version||'')});}catch{result=null;fehler=t('failed');}
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
  document.addEventListener('wfp-version',fahne);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void still();});
  const start=()=>{fahne();setTimeout(()=>void still(),START_MS);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.WFPNativeUpdates=Object.freeze({direkt,pruefe:()=>{const b=document.getElementById('stUpdatesKasten');return b?pruefe(b):null;},still,fahne});
})();
