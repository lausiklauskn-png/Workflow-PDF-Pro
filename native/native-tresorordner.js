/* Gemeinsamer Tresorordner aller Pro-Apps (Schritt D1, Klaus 2026-10-27). Nur in der Android-App mit der
   Brücke WorkflowVault.tresor*; sonst tut diese Datei nichts. Der Knopf „In den Tresorordner einziehen“ steht im
   Tresor-Kasten der Einstellungen (native-vault.js ruft abschnitt()). Passwort und Schlüssel bleiben in Android;
   hierher kommen nur Zustand und Rückmeldungen. Das Inhaltsverzeichnis entsteht aus der Bibliothek (Name, Datum,
   Größe, Seitentext-Auszug ≤ 1000 Zeichen) und wird nur bei einer Änderung neu geschrieben (Java vergleicht). */
(() => {
  'use strict';
  if(!window.Capacitor?.isNativePlatform?.())return;
  const api=Capacitor.Plugins.WorkflowVault;
  if(!api||typeof api.tresorZustand!=='function')return;
  const words={
    // Leitfaden § 2: „Tresor (alle Pro-Apps)“ – der gemeinsame Ordner über den Ablagen.
    title:['Tresor (alle Pro-Apps)','Vault (all Pro apps)','Сейф (все Pro-приложения)','الخزنة (كل تطبيقات Pro)'],
    geraet:['Gerät','Device','Устройство','الجهاز'],karte:['SD-Karte','SD card','SD-карта','بطاقة SD'],
    KEIN_DATEIEN_PROGRAMM:['Keine Dateien-App gefunden, die Ordner zeigen kann. Pfad: ','No Files app found that can show folders. Path: ','Не найдено приложение «Файлы». Путь: ','لم يُعثر على تطبيق ملفات يعرض المجلدات. المسار: '],
    intro:['Ein Ordner, ein Passwort und ein Ersatzschlüssel für alle Pro-Apps (Private Brain Pro, Workflow PDF Pro, BookLedgerPro). Gewählt wird der Ordner, in dem „Workflow PDF Pro“ liegt – für eine Probe eine Kopie davon. Dort kommen nur „tresorordner.json“ und der Ordner „Tresorordner“ dazu; „Workflow PDF Pro“ bleibt, wie es ist.',
      'One folder, one password and one recovery key for all Pro apps (Private Brain Pro, Workflow PDF Pro, BookLedgerPro). Choose the folder that contains “Workflow PDF Pro” – for a trial, a copy of it. Only “tresorordner.json” and the folder “Tresorordner” are added there; “Workflow PDF Pro” stays as it is.',
      'Одна папка, один пароль и один ключ восстановления для всех Pro-приложений (Private Brain Pro, Workflow PDF Pro, BookLedgerPro). Выберите папку, в которой лежит «Workflow PDF Pro» – для пробы её копию. Туда добавятся только «tresorordner.json» и папка «Tresorordner»; «Workflow PDF Pro» не изменится.',
      'مجلد واحد وكلمة مرور واحدة ومفتاح استرداد واحد لكل تطبيقات Pro (Private Brain Pro وWorkflow PDF Pro وBookLedgerPro). اختر المجلد الذي يحتوي «Workflow PDF Pro» – وللتجربة نسخة منه. يضاف هناك فقط «tresorordner.json» والمجلد «Tresorordner»؛ ويبقى «Workflow PDF Pro» كما هو.'],
    neu:['Workflow PDF Pro ist noch nicht im Tresor.','Workflow PDF Pro is not in the vault yet.','Workflow PDF Pro ещё не в сейфе.','Workflow PDF Pro ليس في الخزنة بعد.'],
    move:['In den Tresorordner einziehen …','Move into the shared vault folder …','Перенести в общую папку …','الانتقال إلى مجلد الخزنة المشترك …'],
    unlock:['Tresorordner entsperren …','Unlock shared vault folder …','Разблокировать общую папку …','فتح مجلد الخزنة المشترك …'],
    other:['Anderen Tresorordner wählen …','Choose another shared vault folder …','Выбрать другую общую папку …','اختيار مجلد خزنة مشترك آخر …'],
    write:['Inhaltsverzeichnis jetzt schreiben','Write table of contents now','Записать оглавление сейчас','كتابة الفهرس الآن'],
    lock:['Tresorordner sperren','Lock shared vault folder','Заблокировать общую папку','قفل مجلد الخزنة المشترك'],
    connected:['Mit dem Tresorordner verbunden: ','Connected to the shared vault folder: ','Подключено к общей папке: ','متصل بمجلد الخزنة المشترك: '],
    entries:[' · Einträge im Inhaltsverzeichnis: ',' · entries in the table of contents: ',' · записей в оглавлении: ',' · إدخالات في الفهرس: '],
    locked:['Tresorordner gesperrt: ','Shared vault folder locked: ','Общая папка заблокирована: ','مجلد الخزنة المشترك مقفل: '],
    away:['Tresorordner nicht erreichbar (SD-Karte eingelegt?): ','Shared vault folder unavailable (SD card inserted?): ','Общая папка недоступна (вставлена SD-карта?): ','مجلد الخزنة المشترك غير متاح (هل بطاقة SD موجودة؟): '],
    written:['Inhaltsverzeichnis geschrieben und geprüft.','Table of contents written and verified.','Оглавление записано и проверено.','تمت كتابة الفهرس والتحقق منه.'],
    same:['Inhaltsverzeichnis ist aktuell.','Table of contents is up to date.','Оглавление актуально.','الفهرس محدَّث.'],
    done:['Eingezogen. Die anderen Pro-Apps sehen jetzt das Inhaltsverzeichnis.','Moved in. The other Pro apps now see the table of contents.','Перенесено. Другие Pro-приложения теперь видят оглавление.','تم الانتقال. ترى تطبيقات Pro الأخرى الفهرس الآن.'],
    TRESOR_ORDNER_OHNE_TRESOR:['In diesem Ordner liegt kein „Workflow PDF Pro“. Bitte den Ordner darüber wählen, in dem „Workflow PDF Pro“ liegt. Nichts wurde verändert.','This folder does not contain “Workflow PDF Pro”. Choose the folder above it. Nothing was changed.','В этой папке нет «Workflow PDF Pro». Выберите папку уровнем выше. Ничего не изменено.','لا يحتوي هذا المجلد على «Workflow PDF Pro». اختر المجلد الأعلى. لم يتغير شيء.'],
    TRESOR_ORDNER_IST_FACH:['Das ist der Ordner „Workflow PDF Pro“ selbst. Bitte die Ebene darüber wählen. Nichts wurde verändert.','This is the “Workflow PDF Pro” folder itself. Choose the level above. Nothing was changed.','Это сама папка «Workflow PDF Pro». Выберите уровень выше. Ничего не изменено.','هذا هو مجلد «Workflow PDF Pro» نفسه. اختر المستوى الأعلى. لم يتغير شيء.'],
    TRESOR_ORDNER_FREMDER_TRESOR:['Dort liegt ein anderer Workflow-PDF-Tresor als der geöffnete. Nichts wurde verändert.','That folder holds a different Workflow PDF vault than the open one. Nothing was changed.','Там другое хранилище Workflow PDF, не открытое сейчас. Ничего не изменено.','يحتوي المجلد على خزنة Workflow PDF أخرى غير المفتوحة. لم يتغير شيء.'],
    TRESOR_FACH_BELEGT:['Im Tresorordner ist schon ein anderer Workflow-PDF-Tresor eingezogen. Nichts wurde verändert.','Another Workflow PDF vault has already moved into this folder. Nothing was changed.','В эту папку уже перенесено другое хранилище Workflow PDF. Ничего не изменено.','انتقلت خزنة Workflow PDF أخرى إلى هذا المجلد. لم يتغير شيء.'],
    VAULT_LOCKED:['Erst den Dokumenttresor entsperren.','Unlock the document vault first.','Сначала разблокируйте хранилище документов.','افتح خزنة المستندات أولاً.'],
    // Übergabefach „Eingang-WorkflowPDF“ (Pro-Umbau 5): was andere Pro-Apps hier ablegen
    eingang:['Eingang-WorkflowPDF','Eingang-WorkflowPDF','Eingang-WorkflowPDF','Eingang-WorkflowPDF'],
    eingangNeu:['Neu im Eingang: {n}','New in the inbox: {n}','Новое во входящих: {n}','جديد في الوارد: {n}'],
    eingangLeer:['Im Eingang liegt nichts Neues.','Nothing new in the inbox.','Во входящих ничего нового.','لا جديد في الوارد.'],
    eingangInfo:['Hier legen die anderen Pro-Apps Dateien für Workflow PDF Pro ab (zum Beispiel BookLedgerPro mit „An Pro-App geben …“). „Übernehmen“ liest sie in die Bibliothek; im Tresorordner bleibt alles liegen, die Datei wird nur als übernommen markiert. Geprüft wird wie jede eingelesene Datei: auf Knopfdruck.','Other Pro apps put files for Workflow PDF Pro here (for example BookLedgerPro with “Give to Pro app …”). “Take over” imports them into the library; everything stays in the shared folder, the file is only marked as taken over. Checking works as for every imported file: on request.','Сюда другие Pro-приложения кладут файлы для Workflow PDF Pro. «Принять» импортирует их в библиотеку; в общей папке всё остаётся, файл лишь помечается как принятый.','هنا تضع تطبيقات Pro الأخرى ملفات لـ Workflow PDF Pro. «استلام» يستوردها إلى المكتبة؛ يبقى كل شيء في المجلد المشترك ويُعلَّم الملف فقط كمستلَم.'],
    uebernehmen:['Übernehmen ({n})','Take over ({n})','Принять ({n})','استلام ({n})'],
    uebernommen:['Übernommen: {n}. Die Karten stehen in der Bibliothek.','Taken over: {n}. The cards are in the library.','Принято: {n}. Карточки в библиотеке.','تم الاستلام: {n}. البطاقات في المكتبة.'],
    liest:['Liest {i} von {n} …','Reading {i} of {n} …','Чтение {i} из {n} …','قراءة {i} من {n} …'],
    failed:['Nicht geklappt. Nichts wurde verändert. Code: ','Did not work. Nothing was changed. Code: ','Не получилось. Ничего не изменено. Код: ','لم ينجح. لم يتغير شيء. الرمز: ']
  };
  const index=()=>Math.max(0,['de','en','ru','ar'].indexOf(document.documentElement.lang));
  const t=(key,v={})=>String(words[key][index()]).replace(/\{(\w+)\}/g,(_,x)=>String(v[x]??''));
  const language=()=>document.documentElement.lang||'de';
  const message=error=>{const code=String(error?.code||error?.message||'');return words[code]?t(code):t('failed')+code;};
  const AUSZUG=1000;
  let busy=false,last=0,note='';

  /* ---------- Eingang-WorkflowPDF: ansehen und übernehmen ---------- */
  const eingangDa=()=>typeof api.tresorEingang==='function';
  async function eingangLesen(){
    const r=await api.tresorEingang({});
    const marken=new Set(r?.marken||[]);
    return (r?.eintraege||[]).filter(e=>e&&typeof e.id==='string'&&!marken.has(e.id)).sort((a,b)=>(b.datum||0)-(a.datum||0));
  }
  const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  /* Erst ALLE neuen Dateien lesen und einlesen, dann markieren (wie BookLedgerPro): bricht etwas ab, bleibt nichts halb markiert. */
  async function uebernehmen(neue,stand){
    const dateien=[];
    for(let i=0;i<neue.length;i++){
      stand?.(t('liest',{i:i+1,n:neue.length}));
      const o=await api.tresorEingangOeffnen({id:neue[i].id});const teile=[];
      for(;;){const r=await api.tresorEingangTeil({ticket:o.ticket});if(r.data)teile.push(b64(r.data));if(r.fertig)break;}
      dateien.push(new File(teile,String(o.name||neue[i].name||'Datei'),{type:String(o.art||neue[i].art||'application/octet-stream')}));
    }
    await window.__wfpdf.importDateien(dateien);
    for(const e of neue)await api.tresorEingangMarkieren({id:e.id});
    return dateien.length;
  }
  const groesse=n=>n>=1048576?(n/1048576).toFixed(1).replace('.',',')+' MB':Math.max(1,Math.round((n||0)/1024))+' KB';
  const datum=ms=>ms?new Date(ms).toLocaleDateString(document.documentElement.lang||'de'):'';
  async function eingangBlock(section){
    if(!eingangDa())return;
    section.querySelector('#nativeTresorEingang')?.remove();
    const blk=document.createElement('div');blk.id='nativeTresorEingang';blk.dataset.keinUe='';
    const kopf=document.createElement('div');kopf.className='pro-kasten-kopf';const h=document.createElement('h4');h.textContent=t('eingang');kopf.append(h);
    const erkl=window.ProBedienung?ProBedienung.info('wpp-tresor-eingang',t('eingangInfo')):null;if(erkl)kopf.append(erkl.knopf);
    const zeile=document.createElement('p'),liste=document.createElement('ul'),box=document.createElement('div');
    zeile.setAttribute('role','status');zeile.dataset.eingangZeile='';liste.className='wpp-eingang-liste';box.className='pro-knoepfe';
    blk.append(kopf,...(erkl?[erkl.inhalt]:[]),zeile,liste,box);section.append(blk);
    let neue=[];try{neue=await eingangLesen();}catch(error){zeile.textContent=message(error);return;}
    zeile.textContent=neue.length?t('eingangNeu',{n:neue.length}):t('eingangLeer');zeile.dataset.eingangNeu=String(neue.length);
    for(const e of neue.slice(0,50)){const li=document.createElement('li');li.dataset.eingangEintrag=e.id;li.textContent=[e.name,datum(e.datum),groesse(e.groesse)].filter(Boolean).join(' · ');li.title=e.name||'';liste.append(li);}
    if(!neue.length)return;
    const P=window.ProBedienung;let b;
    const los=async()=>{b.disabled=true;try{const n=await uebernehmen(neue,txt=>{zeile.textContent=txt;});zeile.textContent=t('uebernommen',{n});liste.replaceChildren();b.remove();eingangHinweis();}catch(error){zeile.textContent=message(error);b.disabled=false;}};
    b=P?P.knopf(t('uebernehmen',{n:neue.length}),{haupt:true,beiTipp:()=>void los()}):Object.assign(document.createElement('button'),{type:'button',className:'knopf rot',textContent:t('uebernehmen',{n:neue.length}),onclick:()=>void los()});
    b.dataset.eingangUebernehmen='';box.append(b);
  }
  /* Eine flache Zeile über den Karten, solange etwas Neues im Eingang liegt (nur bei offenem Tresorordner). */
  async function eingangHinweis(){
    const alt=document.getElementById('nativeEingangHinweis');
    if(!eingangDa()||!location()){alt?.remove();return;}
    let neue=[];
    try{const z=await api.tresorZustand({location:location()});if(!(z.offen&&z.eingezogen&&z.pruefung==='PASST')){alt?.remove();return;}neue=await eingangLesen();}catch{alt?.remove();return;}
    if(!neue.length){alt?.remove();return;}
    const ziel=document.getElementById('pruefAlle');if(!ziel)return;
    const d=alt||document.createElement('div');d.id='nativeEingangHinweis';d.dataset.keinUe='';d.className='pruef-alle';
    const s=document.createElement('span'),b=document.createElement('button');s.textContent=t('eingangNeu',{n:neue.length});
    b.type='button';b.className='knopf klein rot';b.textContent=t('uebernehmen',{n:neue.length});b.dataset.eingangUebernehmen='kopf';
    b.onclick=async()=>{b.disabled=true;try{const n=await uebernehmen(neue,txt=>{s.textContent=txt;});s.textContent=t('uebernommen',{n});b.remove();setTimeout(()=>d.remove(),4000);}catch(error){s.textContent=message(error);b.disabled=false;}};
    d.replaceChildren(s,b);if(!alt)ziel.before(d);
  }

  /* Seitentext der Bibliothek (texte: Seiten → [Wort, x, y, b, h]) zu einem kurzen Auszug. */
  function auszug(seiten){
    let s='';
    for(const items of Array.isArray(seiten)?seiten:[]){
      for(const item of Array.isArray(items)?items:[]){const w=Array.isArray(item)?item[0]:item?.str;if(typeof w==='string')s+=w+' ';}
      if(s.length>AUSZUG*2)break;
    }
    s=s.replace(/\s+/g,' ').trim();
    if(s.length<=AUSZUG)return s;
    const cut=/[\uD800-\uDBFF]/.test(s[AUSZUG-1])?AUSZUG-1:AUSZUG;return s.slice(0,cut);
  }
  async function zeilen(db,location){
    const out=[];
    for(const d of await db.all('docs')){
      if(!d||typeof d.id!=='string'||!/^[A-Za-z0-9._-]{1,80}$/.test(d.id))continue;
      let groesse=0,sha256='';
      try{const info=await api.info({location,store:'files',id:d.id});if(info?.exists){groesse=info.size;sha256=info.hash;}}catch{/* ohne Größe eintragen */}
      let text='';try{text=auszug((await db.get('texte',d.id))?.seiten);}catch{/* ohne Auszug */}
      const name=String(d.name||'Dokument');
      out.push({id:d.id,name:/\.pdf$/i.test(name)?name:name+'.pdf',art:'application/pdf',datum:Date.parse(d.updatedAt||d.createdAt)||0,groesse,auszug:text,verweis:'docs/'+d.id,sha256});
    }
    return out;
  }
  const location=()=>window.WFPNativeVault?.aktiv?.()?.location||null;
  /* Inhaltsverzeichnis schreiben, wenn der Tresorordner offen und dieser Tresor eingezogen ist. */
  async function aktualisieren(sofort=false){
    const where=location();if(!where||busy)return null;
    if(!sofort&&Date.now()-last<120000)return null;
    busy=true;
    try{
      const z=await api.tresorZustand({location:where});
      if(!(z.offen&&z.eingezogen&&z.pruefung==='PASST'))return null;
      const r=await api.tresorVerzeichnis({location:where,zeilen:await zeilen(window.WFP.DB,where)});
      last=Date.now();note='';return r;
    }catch(error){note=message(error);if(sofort)throw error;return null;}
    finally{busy=false;}
  }
  function knopf(box,label,work,haupt=false){
    const P=window.ProBedienung,run=()=>void work();
    const b=P?P.knopf(t(label),{beiTipp:run}):Object.assign(document.createElement('button'),{type:'button',className:'knopf',textContent:t(label),onclick:run});
    b.dataset.tresor=label;box.append(b);if(haupt&&P)P.hauptSetzen(box.closest('dialog')||box,b);return b;
  }
  /* Abschnitt „Tresor (alle Pro-Apps)“ im Kasten „Tresor & Ablage“ (native-vault.js, nur bei entsperrter Ablage). */
  async function abschnitt(panel,before,state){
    const section=document.createElement('section');section.id='nativeTresorordner';section.dataset.keinUe='';
    const h=document.createElement('h3'),ort=document.createElement('div'),line=document.createElement('p'),info=document.createElement('p'),box=document.createElement('div');
    h.textContent=t('title');ort.id='nativeTresorordnerOrt';line.id='nativeTresorordnerZeile';info.id='nativeTresorordnerHinweis';info.setAttribute('role','status');box.className='pro-knoepfe';
    // Die lange Erklärung steht hinter ⓘ (zugeklappt, Leitfaden § 1.2).
    const kopf=document.createElement('div');kopf.className='pro-kasten-kopf';kopf.append(h);
    const erkl=window.ProBedienung?ProBedienung.info('wpp-tresor-alle',t('intro')):null;if(erkl){kopf.append(erkl.knopf);erkl.inhalt.id='nativeTresorordnerInfo';}
    section.append(kopf,...(erkl?[erkl.inhalt]:[]),ort,line,info,box);panel.insertBefore(section,before);
    const zeigen=async()=>{
      box.replaceChildren();info.textContent=note;
      let z;try{z=await api.tresorZustand({location:state.location});}catch(error){line.textContent=message(error);return;}
      section.dataset.zustand=z.eingezogen&&z.offen&&z.pruefung==='PASST'?'verbunden':z.gewaehlt&&z.erreichbar===false?'fern':z.gewaehlt&&z.vorhanden&&z.pruefung==='PASST'&&!z.offen?'gesperrt':'neu';
      // Zustand ● und ganzer Pfad + „In Dateien öffnen“ (Leitfaden § 2, § 5) — nur mit gewähltem Ordner.
      const P=window.ProBedienung;ort.replaceChildren();
      if(P&&z.gewaehlt){
        const pfad=(z.speicher==='karte'?t('karte')+'/':z.speicher==='geraet'?t('geraet')+'/':'')+(z.pfad||z.ordner||'');
        const oeffnen=typeof api.ordnerOeffnen==='function'?async()=>{
          try{await api.ordnerOeffnen({welcher:'tresor'});}
          catch(error){info.textContent=String(error?.code||error?.message||'').includes('KEIN_DATEIEN_PROGRAMM')?t('KEIN_DATEIEN_PROGRAMM')+pfad:message(error);}
        }:null;
        const zeile=P.ordnerZeile(pfad,oeffnen);zeile.prepend(P.zustand(section.dataset.zustand==='verbunden'));ort.append(zeile);
      }
      const einziehen=neu=>async()=>{
        info.textContent='';
        try{
          const r=await api.tresorEinziehen({location:state.location,language:language(),...(neu?{neuWaehlen:true}:{})});
          if(r?.abgebrochen)return;
          if(r?.eingezogenJetzt){await aktualisieren(true);info.textContent=t('done');note='';}
        }catch(error){info.textContent=message(error);}
        const keep=info.textContent;await zeigen();info.textContent=keep;
      };
      // Genau ein farbiger Knopf = der nächste Schritt (Leitfaden § 1.4); verbunden braucht keinen.
      if(section.dataset.zustand==='verbunden'){
        line.textContent=t('connected')+(z.ordner||'')+t('entries')+(z.eintraege??0);
        knopf(box,'write',async()=>{try{const r=await aktualisieren(true);info.textContent=r?t(r.geschrieben?'written':'same'):'';}catch(error){info.textContent=message(error);}const keep=info.textContent;await zeigen();info.textContent=keep;});
        knopf(box,'lock',async()=>{try{await api.tresorSperren({location:state.location});}catch(error){info.textContent=message(error);}await zeigen();});
        knopf(box,'other',einziehen(true));
        if(P)P.hauptSetzen(panel,null);
        await eingangBlock(section);
      }else if(section.dataset.zustand==='gesperrt'){
        line.textContent=t('locked')+(z.ordner||'');
        knopf(box,'unlock',einziehen(false),true);knopf(box,'other',einziehen(true));
      }else if(section.dataset.zustand==='fern'){
        line.textContent=t('away')+(z.ordner||'');
        knopf(box,'other',einziehen(true),true);
      }else{
        line.textContent=window.ProBedienung?t('neu'):t('intro');
        knopf(box,'move',einziehen(false),true);
      }
    };
    await zeigen();
    return section;
  }
  // Im Hintergrund nachziehen: beim Verlassen der App und kurz nach dem Start (höchstens alle 2 Minuten).
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void aktualisieren();});
  setTimeout(()=>void aktualisieren(),60000);
  setTimeout(()=>void eingangHinweis(),4000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void eingangHinweis();});
  window.WFPTresorordner=Object.freeze({abschnitt,aktualisieren,zeilen,auszug,eingangLesen,uebernehmen,eingangHinweis});
})();
