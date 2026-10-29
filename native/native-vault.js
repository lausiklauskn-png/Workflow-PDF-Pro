/* Product storage boundary, installed before app.js captures WFP.DB. Passwords
   stay in Android. Internal operation is available without an SD card. */
(() => {
  'use strict';
  if(!window.Capacitor?.isNativePlatform?.())return;
  const api=Capacitor.Plugins.WorkflowVault;if(!api)return;
  const original=WFP.DB, records=new WFPVaultRecords(api);
  const words={
    // Leitfaden § 2 (Klaus 2026-10-28): nur EIN Ding heißt „Tresor“; der Kasten trägt Ablage und Tresor untereinander.
    title:['Tresor & Ablage','Vault & storage','Сейф и хранилище','الخزنة والتخزين'],
    ablage:['Ablage von Workflow PDF Pro','Workflow PDF Pro storage','Хранилище Workflow PDF Pro','تخزين Workflow PDF Pro'],
    info:['Die Ablage ist der eigene verschlüsselte Ordner von Workflow PDF Pro. Der Tresor umschließt die Ablagen aller Pro-Apps. Ein Passwort für alle.','The storage is Workflow PDF Pro’s own encrypted folder. The vault encloses the storage of all Pro apps. One password for all.','Хранилище — собственная зашифрованная папка Workflow PDF Pro. Сейф объединяет хранилища всех Pro-приложений. Один пароль для всех.','التخزين هو مجلد Workflow PDF Pro المشفر. تضم الخزنة تخزين كل تطبيقات Pro. كلمة مرور واحدة للجميع.'],
    geraet:['Gerät','Device','Устройство','الجهاز'],karte:['SD-Karte','SD card','SD-карта','بطاقة SD'],
    KEIN_DATEIEN_PROGRAMM:['Keine Dateien-App gefunden, die Ordner zeigen kann. Pfad: ','No Files app found that can show folders. Path: ','Не найдено приложение «Файлы». Путь: ','لم يُعثر على تطبيق ملفات يعرض المجلدات. المسار: '],
    internal:['Gerätespeicher – keine SD-Karte erforderlich.','Device storage – no SD card required.','Память устройства — SD-карта не требуется.','تخزين الجهاز — لا حاجة إلى بطاقة SD.'],
    folder:['Ablage von Workflow PDF Pro: ','Workflow PDF Pro storage: ','Хранилище Workflow PDF Pro: ','تخزين Workflow PDF Pro: '],
    choose:['Ordner wählen / vorhandenen Tresor öffnen …','Choose folder / open existing vault …','Выбрать папку / открыть хранилище …','اختيار مجلد / فتح خزنة موجودة …'],
    unlock:['Entsperren / erneut versuchen','Unlock / retry','Разблокировать / повторить','فتح القفل / إعادة المحاولة'],
    regrant:['Ordner erneut freigeben …','Grant folder access again …','Снова разрешить доступ к папке …','السماح بالوصول إلى المجلد مجدداً …'],
    lock:['Ablage sperren','Lock storage','Заблокировать хранилище','قفل التخزين'],
    close:['Schließen','Close','Закрыть','إغلاق'],
    notice:['PDFs, Originale, Felder und Übersetzungsstände werden übernommen. Alte Ordner und Sicherungen bleiben erhalten. API-Schlüssel und Netzidentitäten bleiben auf diesem Gerät.','PDFs, originals, fields and translation progress are transferred. Old folders and backups are retained. API keys and network identities stay on this device.','PDF, оригиналы, поля и ход перевода будут перенесены. Старые папки и резервные копии сохранятся. Ключи API и сетевые идентификаторы останутся на устройстве.','تُنقل ملفات PDF والأصول والحقول وتقدم الترجمة. تُحفظ المجلدات والنسخ الاحتياطية القديمة. تبقى مفاتيح API وهويات الشبكة على هذا الجهاز.'],
    confirm:['Übernahme starten und diesen Tresor verwenden','Transfer and use this vault','Перенести и использовать это хранилище','بدء النقل واستخدام هذه الخزنة'],
    cancel:['Abbrechen','Cancel','Отмена','إلغاء'],
    writing:['Wird verschlüsselt gespeichert …','Saving encrypted data …','Сохранение зашифрованных данных …','جارٍ حفظ البيانات المشفرة …'],
    saved:['Im Tresor gespeichert und geprüft.','Saved and verified in the vault.','Сохранено и проверено в хранилище.','تم الحفظ والتحقق في الخزنة.'],
    stored:['✓ Auf diesem Gerät gespeichert.','✓ Saved on this device.','✓ Сохранено на этом устройстве.','✓ تم الحفظ على هذا الجهاز.'],
    localHint:['Dokumente und Arbeitsstände liegen im App-Speicher dieses Geräts. Das Löschen der App-Daten entfernt diese Ablage. In den Einstellungen lässt sich ein verschlüsselter Ordner als Hauptablage wählen; zusätzliche Sicherungen bleiben möglich.','Documents and working states are in this device’s app storage. Clearing app data removes this storage. Settings let you choose an encrypted folder as the main storage; additional backups remain available.','Документы и рабочие состояния находятся в памяти приложения на этом устройстве. Очистка данных приложения удаляет их. В настройках можно выбрать зашифрованную папку как основное хранилище и создавать дополнительные резервные копии.','المستندات وحالات العمل في مساحة التطبيق على هذا الجهاز. مسح بيانات التطبيق يزيل هذا التخزين. يمكنك اختيار مجلد مشفر كمخزن أساسي من الإعدادات وإنشاء نسخ احتياطية إضافية.'],
    durable:['Dokument und Arbeitsstand liegen im gewählten verschlüsselten Tresor. Die interne Datenbank dient als Arbeitsindex. Zusätzliche Sicherungen lassen sich wie bisher erstellen.','The document and working state are in your selected encrypted vault. The internal database is a working index. Additional backups remain available.','Документ и рабочее состояние находятся в выбранном зашифрованном хранилище. Внутренняя база служит рабочим индексом. Дополнительные резервные копии доступны.','المستند وحالة العمل في الخزنة المشفرة المحددة. قاعدة البيانات الداخلية فهرس للعمل. يمكنك إنشاء نسخ احتياطية إضافية.'],
    blocked:['Ablage gesperrt oder nicht erreichbar. Die Bibliothek wird nicht durch eine leere ersetzt.','Storage is locked or unavailable. The library will not be replaced by an empty one.','Хранилище заблокировано или недоступно. Библиотека не будет заменена пустой.','التخزين مقفل أو غير متاح. لن تُستبدل المكتبة بمكتبة فارغة.'],
    conflict:['Gleiche Kennungen mit anderem Inhalt gefunden. Es wurde nichts überschrieben. Bitte einen neuen leeren Zielordner wählen.','Conflicting IDs contain different data. Nothing was overwritten. Choose a new empty destination folder.','Найдены одинаковые идентификаторы с разным содержимым. Ничего не перезаписано. Выберите новую пустую папку.','وُجدت معرفات متطابقة بمحتوى مختلف. لم تُستبدل أي بيانات. اختر مجلداً جديداً فارغاً.'],
    failed:['Speichern/Übernahme nicht abgeschlossen. Bisherige Daten bleiben erhalten. Erneut versuchen.','Save/transfer did not complete. Existing data is retained. Retry.','Сохранение/перенос не завершены. Прежние данные сохранены. Повторите попытку.','لم يكتمل الحفظ أو النقل. تبقى البيانات السابقة محفوظة. أعد المحاولة.'],
    cancelled:['Übernahme abgebrochen; die bisherige Bibliothek bleibt erhalten.','Transfer cancelled; the previous library is retained.','Перенос отменён; прежняя библиотека сохранена.','أُلغي النقل وتبقى المكتبة السابقة محفوظة.'],
    recovery:['Ersatzschlüssel für die Ablage erzeugen (3 von 5) …','Create recovery keys for the storage (3 of 5) …','Создать ключи восстановления хранилища (3 из 5) …','إنشاء مفاتيح استرداد التخزين (3 من 5) …'],
    recoveryNone:['Noch keine Ersatzschlüssel. Ohne Passwort und ohne Ersatzschlüssel sind die Daten nicht mehr zu öffnen.','No recovery keys yet. Without the password and without recovery keys the data cannot be opened.','Ключей восстановления пока нет. Без пароля и без ключей данные не открыть.','لا توجد مفاتيح استرداد بعد. بدون كلمة المرور ومفاتيح الاسترداد لا يمكن فتح البيانات.'],
    recoveryDone:['Ersatzschlüssel vorhanden (3 von 5), erstellt am ','Recovery keys exist (3 of 5), created on ','Ключи восстановления есть (3 из 5), созданы ','مفاتيح الاسترداد موجودة (3 من 5)، أُنشئت في ']
  };
  const t=key=>words[key][Math.max(0,['de','en','ru','ar'].indexOf(document.documentElement.lang))];
  const language=()=>document.documentElement.lang||'de';
  let active=null,needed=null,panel=null,operation=false,banner,gebunden=null;
  // Klaus 2026-10-29: die Meldung stand bei jedem Klick da. Jetzt: „Wird verschlüsselt gespeichert …“ erst, wenn das Schreiben
  // länger als 1,2 s dauert, „gespeichert und geprüft“ nur danach; Fehler sofort. Kurze Schreibvorgänge laufen still.
  function status(kind){
    if(!banner){banner=document.createElement('p');banner.id='nativeVaultStatus';banner.dataset.keinUe='';banner.setAttribute('role','status');banner.hidden=true;document.body.append(banner);}
    const zeigen=text=>{banner.textContent=text;banner.hidden=false;};
    clearTimeout(status.timer);
    if(kind==='error'){clearTimeout(status.spaet);status.sichtbar=true;zeigen(t('blocked'));return;}
    if(kind==='saved'){clearTimeout(status.spaet);status.spaet=null;
      if(status.sichtbar){zeigen(t('saved'));status.timer=setTimeout(()=>{banner.hidden=true;status.sichtbar=false;},2000);}
      return;}
    if(!status.spaet&&!status.sichtbar)status.spaet=setTimeout(()=>{status.spaet=null;status.sichtbar=true;zeigen(t('writing'));},1200);
    else if(status.sichtbar)zeigen(t('writing'));
  }
  window.__wppVaultStatus=status;   // Probe
  const gate=new WFPVaultGate(error=>{status('error');void manage(true,error);});
  WFP.DB=gate.db;
  const localReady=WFPVaultDB.localIndex(original);
  async function usable(location){
    const state=await api.state(location?{location}:{});
    if(state.configured&&!state.unlocked){needed=state;throw Error(state.problem||'VAULT_LOCKED');}
    return state;
  }
  async function attach(state){
    if(!state.configured)return original;
    const local=await localReady;
    const journal=new WFPVaultJournal({bridge:api,records,local,location:state.location,vaultId:state.id,status});
    await journal.recover();active={state,journal};
    // The selected encrypted vault is authoritative. Rebuild missing cache
    // entries (including a cleared WebView database), never show an empty
    // replacement library merely because the internal index was lost.
    const changes=[];
    for(const store of WFPVaultMigration.stores){
      const localIds=new Set(await original.keys(store));
      const remote=await api.list({location:state.location,store});
      if(!Array.isArray(remote.ids))throw Error('VAULT_RECORD_DAMAGED');
      for(const id of remote.ids){
        const raw=await original.get(store,id),info=await api.info({location:state.location,store,id});
        const same=store==='files'?raw?.__wfpVault?.hash===info.hash&&raw.__wfpVault.location===state.location:raw&&await WFPVaultMigration.hash(raw)===info.hash;
        if(!same){
          const {record}=await records.load(state.location,store,id,info.hash);
          changes.push({kind:'put',store,id,record:store==='files'?{id,__wfpVault:{location:state.location,vaultId:state.id,hash:info.hash}}:record});
        }
        localIds.delete(id);
      }
      for(const id of localIds){
        if(store==='files'&&!(await original.get(store,id))?.__wfpVault)throw Error('VAULT_MIGRATION_REQUIRED');
        changes.push({kind:'delete',store,id});
      }
    }
    await local.commit(changes);
    gebunden=WFPVaultDB.create({journal,local,records,sammeln:{ruheMs:10000,fehler:error=>{gate.fault=true;gate.blocked=true;gate.generation++;status('error');void manage(true,error);}}});
    return gebunden;
  }
  // Gesammelter Arbeitsstand geht vor jedem Sperren/Wechseln, auf „Speichern“, beim Schließen des Dokuments und wenn die App in den
  // Hintergrund geht in den Tresor (Android beendet eine App im Hintergrund ohne Vorwarnung).
  async function pause(){try{await gebunden?.schreibeJetzt();}catch{/* Fehler meldet das Journal */}await gate.pause();}
  const jetztSchreiben=()=>{void gebunden?.schreibeJetzt().catch(()=>{});};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')jetztSchreiben();});
  window.addEventListener('pagehide',jetztSchreiben);
  document.addEventListener('click',event=>{if(event.target?.closest?.('#edSpeichern,#edZurueck'))setTimeout(jetztSchreiben,80);},true);
  async function sourceState(){
    // A migration can stop after the atomic index transaction but before the
    // native primary pointer. References resolve that interval without guessing.
    for(const id of await original.keys('files')){
      const ref=(await original.get('files',id))?.__wfpVault;
      if(ref)return usable(ref.location);
    }
    return usable();
  }
  async function boot(){
    await pause();active=null;needed=null;
    const state=await sourceState(), source=await attach(state);
    let selected=state,bound=source;
    const migration=await api.migration();
    if(migration.location){
      const target=await usable(migration.location);
      await WFPVaultMigration.transfer({bridge:api,records,source,local:await localReady,location:target.location,vaultId:target.id,progress:()=>status('writing')});
      selected=target;bound=await attach(target);
    }
    // Never release startup readers in the small interval before a required
    // preferences reload. They would otherwise see a ready library that is
    // immediately navigated away, losing in-flight reads or user actions.
    if(selected.configured&&!WFPVaultPreferences.keys.some(key=>localStorage.getItem(key)!==null)&&localStorage.getItem('wfp_native_preferences_loaded')!==selected.id){
      const info=await api.info({location:selected.location,store:'settings',id:'workflow-preferences-v1'});
      if(info.exists)WFPVaultPreferences.restore((await records.load(selected.location,'settings','workflow-preferences-v1',info.hash)).record);
      localStorage.setItem('wfp_native_preferences_loaded',selected.id);location.reload();return gate.db;
    }
    gate.resume(bound);
    delete document.documentElement.dataset.wfpVaultLocked;
    panel?.close();panel?.remove();panel=null;
    return gate.db;
  }
  // Knöpfe aus der gemeinsamen Bedien-Datei (flach, ein farbiger nächster Schritt); ohne sie wie bisher.
  function button(container,label,work,haupt=false){
    const P=window.ProBedienung,run=()=>void work().catch(error=>manage(true,error));
    const b=P?P.knopf(t(label),{beiTipp:run,name:label}):Object.assign(document.createElement('button'),{type:'button',className:'knopf',textContent:t(label),onclick:run});
    b.dataset.vault=label;container.append(b);if(haupt&&P)P.hauptSetzen(container.closest('dialog')||container,b);return b;
  }
  const ablagePfad=state=>(state.speicher==='karte'?t('karte'):state.speicher==='geraet'?t('geraet'):'')+(state.speicher?'/':'')+(state.pfad||state.folder||'');
  // Zustand ● und ganzer Pfad + „In Dateien öffnen“ (Leitfaden § 2, § 5).
  function ortZeile(state,note){
    const P=window.ProBedienung;if(!P)return null;
    const pfad=ablagePfad(state);
    const oeffnen=typeof api.ordnerOeffnen==='function'?async()=>{
      try{await api.ordnerOeffnen({welcher:'ablage'});}
      catch(error){note.textContent=String(error?.code||error?.message||'').includes('KEIN_DATEIEN_PROGRAMM')?t('KEIN_DATEIEN_PROGRAMM')+pfad:t('failed');}
    }:null;
    const z=P.ordnerZeile(pfad,oeffnen);z.prepend(P.zustand(Boolean(state.unlocked)));return z;
  }
  async function confirmMove(state){
    panel?.close();panel?.remove();panel=document.createElement('dialog');panel.className='native-vault-dialog';panel.dataset.keinUe='';
    const title=document.createElement('h2'),text=document.createElement('p'),actions=document.createElement('div');actions.className='pro-knoepfe';title.textContent=t('title');text.textContent=t('notice');panel.append(title,text,actions);document.body.append(panel);panel.showModal();
    button(actions,'cancel',async()=>{panel.close();panel.remove();panel=null;});
    button(actions,'confirm',async()=>{
      if(operation)return;operation=true;
      const old=gate.target,controller=new AbortController();
      // Fortschritt mit Balken, „bitte nicht schließen“ (Leitfaden § 3).
      const lauf=window.ProBedienung?ProBedienung.fortschritt(null,{schliessbar:false}):null;if(lauf)panel.insertBefore(lauf.element,actions);
      actions.replaceChildren();const cancel=button(actions,'cancel',async()=>{controller.abort();cancel.disabled=true;});
      panel.oncancel=event=>{event.preventDefault();controller.abort();cancel.disabled=true;};
      try{
        document.activeElement?.blur();await Promise.resolve();await pause();
        const source=old||original;
        const prefInfo=await api.info({location:state.location,store:'settings',id:'workflow-preferences-v1'});
        const hasDocs=(await source.keys('docs')).length>0;
        const restorePreferences=!hasDocs&&prefInfo.exists;
        await WFPVaultMigration.transfer({bridge:api,records,source,local:await localReady,location:state.location,vaultId:state.id,signal:controller.signal,
          preferences:restorePreferences?undefined:WFPVaultPreferences.snapshot(),
          progress:(done,total,finishing)=>{text.textContent=t('writing')+' '+done+' / '+total;lauf?.schritt(done,total);if(finishing)cancel.disabled=true;}});
        if(restorePreferences)WFPVaultPreferences.restore((await records.load(state.location,'settings','workflow-preferences-v1')).record);
        gate.resume(await attach(state));await Promise.resolve();await pause();
        // User-visible state is rebuilt only after durable data and queued writes.
        location.reload();
      }catch(error){
        if(error.message==='VAULT_MIGRATION_CANCELLED')lauf?.abgebrochen();else lauf?.fehler();
        if(error.message==='VAULT_MIGRATION_CANCELLED'){gate.resume(old||original);text.textContent=t('cancelled');}
        else if(error.message==='VAULT_MIGRATION_CONFLICT'){gate.resume(old||original);text.textContent=t('conflict');}
        else {status('error');text.textContent=t('failed');}
        actions.replaceChildren();button(actions,'unlock',async()=>{await boot();});
      }finally{operation=false;}
    },true);
  }
  async function manage(locked=false,error){
    if(operation)return;
    if(locked)document.documentElement.dataset.wfpVaultLocked='';
    panel?.close();panel?.remove();panel=document.createElement('dialog');panel.className='native-vault-dialog';panel.dataset.keinUe='';
    const P=window.ProBedienung;
    const kopf=document.createElement('div'),h=document.createElement('h2'),text=document.createElement('p'),actions=document.createElement('div');
    kopf.className='pro-kasten-kopf';h.textContent=t('title');kopf.append(h);
    text.id='nativeAblageZeile';actions.className='pro-knoepfe';
    // Erklärungen nur hinter ⓘ, zugeklappt (Leitfaden § 1.2).
    const erklaerung=document.createElement('div');for(const k of ['info','notice']){const p=document.createElement('p');p.textContent=t(k);erklaerung.append(p);}
    const i=P?P.info('wpp-tresor-ablage',erklaerung):null;
    if(i)kopf.append(i.knopf);
    panel.append(kopf);if(i)panel.append(i.inhalt);else panel.append(erklaerung);
    const ablage=document.createElement('section');ablage.id='nativeAblage';
    const ah=document.createElement('h3');ah.textContent=t('ablage');ablage.append(ah);
    const note=document.createElement('p');note.id='nativeAblageHinweis';note.setAttribute('role','status');
    panel.append(ablage);document.body.append(panel);panel.showModal();
    panel.oncancel=event=>{if(locked)event.preventDefault();};
    if(locked){
      const wanted=needed||active?.state;
      if(wanted?.configured&&P){const z=ortZeile({...wanted,unlocked:false},note);if(z){z.id='nativeAblageOrt';ablage.append(z);}}
      text.textContent=t('blocked');ablage.append(text,note,actions);
      button(actions,'unlock',async()=>{
        const wanted=needed||active?.state;
        if(wanted){const answer=await api.unlock({location:wanted.location,language:language()});if(answer.cancelled)return;}
        await boot();
      },true);
      button(actions,'regrant',async()=>{
        const wanted=needed||active?.state;
        const answer=await api.choose({language:language(),...(wanted?.id?{expectedVaultId:wanted.id}:{})});
        if(!answer.cancelled){
          if(wanted?.location&&answer.location!==wanted.location)
            await WFPVaultMigration.reconnect({bridge:api,records,local:await localReady,location:answer.location,vaultId:answer.state.id});
          await boot();
        }
      });
    }else{
      if(active){const z=ortZeile(active.state,note);if(z){z.id='nativeAblageOrt';ablage.append(z);}else{text.textContent=t('folder')+(active.state.folder||'');}}
      else text.textContent=t('internal');
      if(text.textContent)ablage.append(text);
      ablage.append(note,actions);
      button(actions,'choose',async()=>{const answer=await api.choose({language:language()});if(!answer.cancelled)await confirmMove(answer.state);},!active);
      if(active&&typeof api.createRecovery==='function'){
        const line=document.createElement('p');line.id='nativeVaultRecovery';ablage.insertBefore(line,actions);
        const show=info=>{line.textContent=info?.exists?t('recoveryDone')+new Date(info.created||info.createdAt).toLocaleDateString(language()):t('recoveryNone');};
        void api.recoveryInfo({location:active.state.location}).then(show).catch(()=>{});
        button(actions,'recovery',async()=>{const answer=await api.createRecovery({location:active.state.location,language:language()});if(answer?.created)show({exists:true,createdAt:answer.createdAt});});
      }
      // Sperren nur, wenn die Ablage offen ist (Leitfaden § 1.4: Unnötiges verschwindet).
      if(active)button(actions,'lock',async()=>{document.activeElement?.blur();await pause();await active.journal.tail;await api.lock();await boot();});
      const fuss=document.createElement('div');fuss.className='pro-knoepfe';panel.append(fuss);
      // Gemeinsamer Tresorordner (Schritt D1): eigener Abschnitt „Tresor (alle Pro-Apps)“, nur bei entsperrter Ablage.
      if(active&&window.WFPTresorordner)void WFPTresorordner.abschnitt(panel,fuss,active.state).catch(()=>{});
      button(fuss,'close',async()=>{panel.close();panel.remove();panel=null;});
    }
  }
  // Existing settings dialog remains intact, including BYOK edits and old backup.
  const observe=new MutationObserver(()=>{
    const backup=document.getElementById('stSicherung');
    if(backup&&!document.getElementById('stNativeVault')){
      const b=document.createElement('button');b.id='stNativeVault';b.className='knopf';b.dataset.keinUe='';b.textContent=t('title');b.onclick=()=>void manage();backup.parentElement.append(b);
    }
    // „Speicher“ in den Einstellungen: nie der Browser-Satz des Kerns (Leitfaden § 4), sondern wo die App ablegt.
    const storage=document.getElementById('stSpeicher');
    if(storage){const text=active?t('folder')+ablagePfad(active.state):t('internal');if(storage.textContent!==text){storage.dataset.keinUe='';storage.textContent=text;}}
    for(const dialog of document.querySelectorAll('.dlg')){
      if(!dialog.querySelector('h2')?.textContent.startsWith('💾')||!dialog.querySelector('[data-dl]'))continue;
      const paragraphs=dialog.querySelectorAll(':scope > p');if(paragraphs.length<2)continue;
      const first=active?t('saved'):t('stored');
      if(paragraphs[0].textContent!==first){paragraphs[0].dataset.keinUe='';paragraphs[0].textContent=first;}
      const hint=active?t('durable'):t('localHint');if(paragraphs[1].textContent!==hint){paragraphs[1].dataset.keinUe='';paragraphs[1].textContent=hint;}
    }
  });observe.observe(document.body,{childList:true,subtree:true});
  // Portable preferences are saved independently of local secrets/consents.
  const set=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    const result=set.call(this,key,value);
    if(this===localStorage&&WFPVaultPreferences.keys.includes(key)&&active&&!gate.blocked){
      const snapshot=WFPVaultPreferences.snapshot();
      void active.journal.enqueue(async()=>{status('writing');await active.journal.check();await records.save(active.state.location,'settings',snapshot);status('saved');}).catch(error=>{gate.fault=true;gate.blocked=true;gate.generation++;status('error');void manage(true,error);});
    }
    return result;
  };
  window.WFPNativeVault=Object.freeze({manage,boot,gate,selectLocation:confirmMove,aktiv:()=>active?.state||null});
  void boot().catch(error=>{status('error');void manage(true,error);});
})();
