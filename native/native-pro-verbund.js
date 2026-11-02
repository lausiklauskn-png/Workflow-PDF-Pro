/* Optional cooperation. Each app keeps its own library; connection alone never
   imports or sends a file. All actions below use the durable transfer adapter. */
(() => {
  'use strict';
  const T=window.WFPProTransfers,C=window.WFPProContract;
  if(!T)return;
  const api=Capacitor.Plugins.WorkflowVault,names={familienakte:'Familienakte Pro','private-brain':'Private Brain Pro',bookledgerpro:'BookLedgerPro','workflow-pdf-pro':'Workflow PDF Pro'};
  const words={
    title:['Zusammenarbeit mit Pro-Apps','Work with Pro apps','Совместная работа Pro-приложений','التعاون مع تطبيقات Pro'],
    short:['Pro-Apps','Pro apps','Pro-приложения','تطبيقات Pro'],
    info:['Freiwillig denselben Tresorordner verbinden. Jede App behält ihre eigene Ablage. Ausgewählte Dateien kommen erst mit „Übernehmen“ in die Bibliothek. Zum Weitergeben wie gewohnt „Teilen“ wählen.','Optionally connect the same vault folder. Each app keeps its own library. Selected files enter the library when you choose “Import”. Use the normal “Share” action to send files.','Можно подключить общую папку сейфа. У каждого приложения остаётся своя библиотека. Выбранные файлы попадут в неё после нажатия «Принять». Для отправки используйте обычное действие «Поделиться».','يمكن ربط مجلد خزنة مشترك اختيارياً. يحتفظ كل تطبيق بمكتبته. تدخل الملفات المختارة إلى المكتبة عند الضغط على «استلام». للإرسال استخدم «مشاركة» المعتاد.'],
    connect:['Tresorordner verbinden …','Connect vault folder …','Подключить папку сейфа …','ربط مجلد الخزنة …'],
    unlock:['Entsperren …','Unlock …','Разблокировать …','فتح القفل …'],
    other:['Anderen Ordner wählen …','Choose another folder …','Выбрать другую папку …','اختيار مجلد آخر …'],
    lock:['Sperren','Lock','Заблокировать','قفل'],
    forget:['Gemerktes Entsperren vergessen','Forget saved unlocking','Забыть сохранённую разблокировку','نسيان فتح القفل المحفوظ'],
    connected:['Verbunden','Connected','Подключено','متصل'],
    locked:['Gesperrt oder nicht erreichbar','Locked or unavailable','Заблокировано или недоступно','مقفل أو غير متاح'],
    none:['Keine Verbindung gewählt','No connection selected','Подключение не выбрано','لم يتم اختيار اتصال'],
    inbox:['Eingang','Inbox','Входящие','الوارد'],
    outbox:['Ausgang','Outbox','Исходящие','الصادر'],
    empty:['Keine offenen Übergaben.','No pending transfers.','Нет ожидающих передач.','لا توجد عمليات تسليم معلقة.'],
    receive:['Auswahl übernehmen','Import selected','Принять выбранное','استلام المحدد'],
    received:['Auswahl gespeichert und im Eingang bestätigt.','Selection saved and receipt confirmed.','Выбранное сохранено, получение подтверждено.','تم حفظ الملفات المحددة وتأكيد استلامها.'],
    reload:['Aktualisieren','Refresh','Обновить','تحديث'],
    retry:['Erneut bereitstellen','Send again','Отправить снова','إعادة الإرسال'],
    confirm:['Empfang prüfen','Check receipt','Проверить получение','التحقق من الاستلام'],
    prepared:['Vorbereitet – noch nicht bereitgestellt','Prepared – not sent yet','Подготовлено — ещё не отправлено','جاهز — لم يُرسل بعد'],
    forwarded:['Bereitgestellt – Empfang noch offen','Sent – receipt pending','Отправлено — получение ожидается','أُرسل — بانتظار تأكيد الاستلام'],
    confirmed:['In der Ziel-App gespeichert','Saved in the receiving app','Сохранено в приложении-получателе','حُفظ في التطبيق المستلم'],
    target:['Ausgewählte Ausgabe weitergeben','Send selected output','Передать выбранный результат','إرسال الناتج المحدد'],
    targetInfo:['Diese ausgegebene Fassung wird im Eingang der gewählten App bereitgestellt. Die andere App bestätigt den Empfang erst nach dem Speichern.','This output is placed in the selected app’s inbox. The other app confirms receipt only after saving.','Эта версия будет помещена во входящие выбранного приложения. Оно подтвердит получение только после сохранения.','توضع هذه النسخة في وارد التطبيق المختار. يؤكد التطبيق الآخر الاستلام بعد الحفظ فقط.'],
    os:['Über Windows / Android teilen …','Share via Windows / Android …','Поделиться через Windows / Android …','المشاركة عبر Windows / Android …'],
    limits:['Pro-Übergaben: höchstens 20 MiB je Datei. BookLedgerPro nimmt PDF, Bilder und E-Mails.','Pro transfers: up to 20 MiB per file. BookLedgerPro accepts PDF, images and email.','Передачи Pro: до 20 МиБ на файл. BookLedgerPro принимает PDF, изображения и письма.','تسليم Pro: حتى 20 MiB لكل ملف. يقبل BookLedgerPro ملفات PDF والصور والبريد.'],
    close:['Schließen','Close','Закрыть','إغلاق'],
    cancel:['Abbrechen','Cancel','Отмена','إلغاء'],
    failed:['Übergabe noch offen. Bereits gespeicherte Dateien bleiben erhalten. Code: ','Transfer still pending. Already saved files are retained. Code: ','Передача ещё не завершена. Уже сохранённые файлы остаются. Код: ','التسليم لا يزال معلقاً. تبقى الملفات المحفوظة. الرمز: '],
    changed:['Die Arbeitsablage hat gewechselt. Bitte die Ausgabe aus der gewünschten Bibliothek neu erstellen.','The working library changed. Create the output again from the intended library.','Рабочая библиотека изменилась. Создайте результат заново из нужной библиотеки.','تغيرت مكتبة العمل. أنشئ الناتج مجدداً من المكتبة المطلوبة.'],
    invalid:['Dieser Eintrag kann nicht übernommen werden.','This entry cannot be imported.','Эту запись нельзя принять.','لا يمكن استلام هذا الإدخال.']
  };
  const lang=()=>document.documentElement.lang||'de',t=key=>words[key][Math.max(0,['de','en','ru','ar'].indexOf(lang()))];
  const errorText=error=>error?.message==='PRO_LIBRARY_CHANGED'?t('changed'):t('failed')+String(error?.code||error?.message||'PRO_FAILED');
  function el(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
  function button(parent,label,handler,id){
    const b=el('button',label);b.type='button';b.className='knopf';if(id)b.dataset.proAction=id;b.onclick=handler;parent.append(b);return b;
  }
  function panel(title,id){
    const p=el('dialog');p.id=id;p.className='native-vault-dialog native-pro-dialog';p.dataset.keinUe='';p.append(el('h2',title));document.body.append(p);p.showModal();
    p.addEventListener('close',()=>p.remove(),{once:true});return p;
  }
  function explanation(p,key){
    if(window.ProBedienung){const info=ProBedienung.info('pro-'+key,t(key));p.append(info.knopf,info.inhalt);}else p.append(el('p',t(key)));
  }
  const statusLabel=row=>t(row.stand==='im-eingang'?'confirmed':row.stand==='weitergegeben'?'forwarded':'prepared');
  async function dialog(){
    document.getElementById('nativeProVerbund')?.close();
    const p=panel(t('title'),'nativeProVerbund');explanation(p,'info');
    const body=el('div'),note=el('p');note.setAttribute('role','status');note.dataset.proStatus='';p.append(body,note);
    const footer=el('div');p.append(footer);button(footer,t('close'),()=>p.close(),'close');
    let busy=false;
    const act=async work=>{
      if(busy)return;busy=true;note.textContent='';
      for(const b of p.querySelectorAll('button,input'))b.disabled=true;
      try{const message=await work();await render();if(typeof message==='string')note.textContent=message;}
      catch(error){note.textContent=errorText(error);}
      finally{busy=false;for(const b of p.querySelectorAll('button,input'))b.disabled=b.dataset.proDisabled==='true';}
    };
    p.oncancel=ev=>{if(busy)ev.preventDefault();};
    async function render(){
      body.replaceChildren();const z=await T.state(),path=z.pfad||z.ordner||'';
      body.append(el('p',(z.offen?t('connected'):z.gewaehlt?t('locked'):t('none'))+(path?' · '+path:'')));
      const actions=el('div');body.append(actions);
      if(!z.offen)button(actions,t(z.gewaehlt?'unlock':'connect'),()=>void act(()=>api.tresorVerbinden({language:lang()})),'connect');
      if(z.gewaehlt){
        button(actions,t('other'),()=>void act(()=>api.tresorVerbinden({language:lang(),neuWaehlen:true})),'choose');
        if(z.offen)button(actions,t('lock'),()=>void act(()=>api.tresorSperren({})),'lock');
        if(z.gemerkt)button(actions,t('forget'),()=>void act(()=>api.tresorSperren({vergessen:true})),'forget');
      }
      button(actions,t('reload'),()=>void act(async()=>{}),'refresh');
      body.append(el('h3',t('inbox')));
      if(z.offen){
        const rows=await T.inbox(z.kennung),list=el('ul');list.className='native-pro-list';body.append(list);
        if(!rows.length)list.append(el('li',t('empty')));
        const chosen=new Map();
        for(const row of rows){
          const li=el('li');li.dataset.proEntry=row.entryId;
          if(row.fehler)li.append(el('span',t('invalid')+' '+row.fehler));
          else{
            const label=el('label'),box=el('input');box.type='checkbox';box.onchange=()=>{if(box.checked)chosen.set(row.entryId,row);else chosen.delete(row.entryId);take.disabled=!chosen.size;take.dataset.proDisabled=String(!chosen.size);};
            label.append(box,document.createTextNode(' '+row.vertrag.name+' · '+names[row.vertrag.quelle]));li.append(label);
          }
          list.append(li);
        }
        const take=button(body,t('receive'),()=>void act(async()=>{for(const row of chosen.values())await T.receive(z.kennung,row);return t('received');}),'receive');
        take.disabled=true;take.dataset.proDisabled='true';
      }
      body.append(el('h3',t('outbox')));
      const rows=await T.outbox(),out=el('ul');out.className='native-pro-list';body.append(out);
      if(!rows.length)out.append(el('li',t('empty')));
      for(const row of rows.sort((a,b)=>b.at.localeCompare(a.at))){
        const li=el('li');li.dataset.proOutgoing=row.id;
        li.append(el('p',row.vertrag.name+' → '+names[row.vertrag.ziel]),el('p',statusLabel(row)));
        if(row.stand!=='im-eingang'){
          const ready=z.offen&&z.kennung===row.vaultId;
          const retry=button(li,t('retry'),()=>void act(async()=>statusLabel(await T.retry(row.id))),'retry');retry.disabled=!ready;retry.dataset.proDisabled=String(!ready);
          if(row.entryId){const check=button(li,t('confirm'),()=>void act(async()=>statusLabel(await T.confirm(row.id))),'confirm');check.disabled=!ready;check.dataset.proDisabled=String(!ready);}
          if(!ready)li.append(el('small',t('locked')+' · '+row.vaultId));
        }
        out.append(li);
      }
    }
    await act(async()=>{});
  }
  function notice(text){
    let line=document.getElementById('nativeProStatus');if(!line){line=el('p');line.id='nativeProStatus';line.setAttribute('role','status');document.body.append(line);}
    line.replaceChildren(document.createTextNode(text+' '));button(line,t('short'),()=>void dialog());line.hidden=false;
    button(line,t('close'),()=>{line.hidden=true;});
  }
  async function offer(files){
    if(!files?.length)return false;
    const z=await T.state();if(!z.gewaehlt)return false;
    return new Promise((resolve,reject)=>{
      const p=panel(t('target'),'nativeProTarget');explanation(p,'targetInfo');
      const list=el('ul');for(const file of files)list.append(el('li',file.name));p.append(list,el('p',t('limits')));
      const note=el('p');note.setAttribute('role','status');note.dataset.proStatus='';p.append(note);
      let busy=false,done=false;
      const finish=value=>{done=true;p.close();resolve(value);};
      p.oncancel=ev=>{ev.preventDefault();if(!busy){done=true;p.close();reject(new DOMException('Cancelled','AbortError'));}};
      p.addEventListener('close',()=>{if(!done)reject(new DOMException('Cancelled','AbortError'));});
      const targets=el('div');p.append(targets);
      for(const target of C.APPS.filter(x=>x!==C.APP)){
        const b=button(targets,names[target],async()=>{
          if(busy)return;busy=true;for(const b of p.querySelectorAll('button'))b.disabled=true;
          try{const rows=await T.send(files,target,z.kennung);notice(rows.every(r=>r.stand==='im-eingang')?t('confirmed'):t('forwarded'));finish(true);}
          catch(error){note.textContent=errorText(error);}
          finally{busy=false;for(const b of p.querySelectorAll('button'))b.disabled=b.dataset.proDisabled==='true';}
        },target);
        const disabled=!z.offen||files.some(f=>!C.accepts(target,f));b.disabled=disabled;b.dataset.proDisabled=String(disabled);
      }
      if(!z.offen){note.textContent=t('locked');button(p,t('unlock'),async()=>{p.close();await dialog();},'unlock');}
      button(p,t('os'),()=>finish(false),'os');
      button(p,t('cancel'),()=>p.dispatchEvent(new Event('cancel',{cancelable:true})),'cancel');
    });
  }
  function append(parent,before=null){
    const box=el('section');box.dataset.proLink='';button(box,t('title'),()=>void dialog(),'manage');parent.insertBefore(box,before);return box;
  }
  new MutationObserver(()=>{
    const backup=document.getElementById('stSicherung');
    if(backup&&!document.getElementById('stNativeProVerbund')){const b=button(backup.parentElement,t('short'),()=>void dialog());b.id='stNativeProVerbund';b.dataset.keinUe='';}
  }).observe(document.documentElement,{childList:true,subtree:true});
  window.WFPProVerbund=Object.freeze({dialog,offer,append});
})();
