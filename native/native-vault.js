/* Product storage boundary, installed before app.js captures WFP.DB. Passwords
   stay in Android. Internal operation is available without an SD card. */
(() => {
  'use strict';
  if(!window.Capacitor?.isNativePlatform?.())return;
  const api=Capacitor.Plugins.WorkflowVault;if(!api)return;
  const original=WFP.DB, records=new WFPVaultRecords(api);
  const words={
    title:['Speicher und Dokumenttresor','Storage and document vault','Хранилище документов','التخزين وخزنة المستندات'],
    internal:['Gerätespeicher – keine SD-Karte erforderlich.','Device storage – no SD card required.','Память устройства — SD-карта не требуется.','تخزين الجهاز — لا حاجة إلى بطاقة SD.'],
    folder:['Verschlüsselter Tresor als Hauptablage: ','Encrypted vault as primary storage: ','Зашифрованное основное хранилище: ','الخزنة المشفرة كمخزن أساسي: '],
    choose:['Ordner wählen / vorhandenen Tresor öffnen …','Choose folder / open existing vault …','Выбрать папку / открыть хранилище …','اختيار مجلد / فتح خزنة موجودة …'],
    unlock:['Entsperren / erneut versuchen','Unlock / retry','Разблокировать / повторить','فتح القفل / إعادة المحاولة'],
    regrant:['Ordner erneut freigeben …','Grant folder access again …','Снова разрешить доступ к папке …','السماح بالوصول إلى المجلد مجدداً …'],
    lock:['Tresor sperren','Lock vault','Заблокировать хранилище','قفل الخزنة'],
    close:['Schließen','Close','Закрыть','إغلاق'],
    notice:['PDFs, Originale, Felder und Übersetzungsstände werden übernommen. Alte Ordner und Sicherungen bleiben erhalten. API-Schlüssel und Netzidentitäten bleiben auf diesem Gerät.','PDFs, originals, fields and translation progress are transferred. Old folders and backups are retained. API keys and network identities stay on this device.','PDF, оригиналы, поля и ход перевода будут перенесены. Старые папки и резервные копии сохранятся. Ключи API и сетевые идентификаторы останутся на устройстве.','تُنقل ملفات PDF والأصول والحقول وتقدم الترجمة. تُحفظ المجلدات والنسخ الاحتياطية القديمة. تبقى مفاتيح API وهويات الشبكة على هذا الجهاز.'],
    confirm:['Übernahme starten und diesen Tresor verwenden','Transfer and use this vault','Перенести и использовать это хранилище','بدء النقل واستخدام هذه الخزنة'],
    cancel:['Abbrechen','Cancel','Отмена','إلغاء'],
    writing:['Wird verschlüsselt gespeichert …','Saving encrypted data …','Сохранение зашифрованных данных …','جارٍ حفظ البيانات المشفرة …'],
    saved:['Im Tresor gespeichert und geprüft.','Saved and verified in the vault.','Сохранено и проверено в хранилище.','تم الحفظ والتحقق في الخزنة.'],
    blocked:['Speicher gesperrt oder nicht erreichbar. Die Bibliothek wird nicht durch eine leere ersetzt.','Storage is locked or unavailable. The library will not be replaced by an empty one.','Хранилище заблокировано или недоступно. Библиотека не будет заменена пустой.','التخزين مقفل أو غير متاح. لن تُستبدل المكتبة بمكتبة فارغة.'],
    conflict:['Gleiche Kennungen mit anderem Inhalt gefunden. Es wurde nichts überschrieben. Bitte einen neuen leeren Zielordner wählen.','Conflicting IDs contain different data. Nothing was overwritten. Choose a new empty destination folder.','Найдены одинаковые идентификаторы с разным содержимым. Ничего не перезаписано. Выберите новую пустую папку.','وُجدت معرفات متطابقة بمحتوى مختلف. لم تُستبدل أي بيانات. اختر مجلداً جديداً فارغاً.'],
    failed:['Speichern/Übernahme nicht abgeschlossen. Bisherige Daten bleiben erhalten. Erneut versuchen.','Save/transfer did not complete. Existing data is retained. Retry.','Сохранение/перенос не завершены. Прежние данные сохранены. Повторите попытку.','لم يكتمل الحفظ أو النقل. تبقى البيانات السابقة محفوظة. أعد المحاولة.'],
    cancelled:['Übernahme abgebrochen; die bisherige Bibliothek bleibt erhalten.','Transfer cancelled; the previous library is retained.','Перенос отменён; прежняя библиотека сохранена.','أُلغي النقل وتبقى المكتبة السابقة محفوظة.']
  };
  const t=key=>words[key][Math.max(0,['de','en','ru','ar'].indexOf(document.documentElement.lang))];
  const language=()=>document.documentElement.lang||'de';
  let active=null,needed=null,panel=null,operation=false,banner;
  function status(kind){
    if(!banner){banner=document.createElement('p');banner.id='nativeVaultStatus';banner.dataset.keinUe='';banner.setAttribute('role','status');document.body.append(banner);}
    banner.textContent=t(kind==='error'?'blocked':kind==='saved'?'saved':'writing');banner.hidden=false;
    clearTimeout(status.timer);if(kind==='saved')status.timer=setTimeout(()=>banner.hidden=true,2500);
  }
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
    return WFPVaultDB.create({journal,local,records});
  }
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
    await gate.pause();active=null;needed=null;
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
    panel?.close();panel?.remove();panel=null;
    return gate.db;
  }
  function button(container,label,work){const b=document.createElement('button');b.type='button';b.className='knopf';b.textContent=t(label);b.onclick=()=>void work().catch(error=>manage(true,error));container.append(b);return b;}
  async function confirmMove(state){
    panel?.close();panel?.remove();panel=document.createElement('dialog');panel.className='native-vault-dialog';panel.dataset.keinUe='';
    const title=document.createElement('h2'),text=document.createElement('p'),actions=document.createElement('div');title.textContent=t('title');text.textContent=t('notice');panel.append(title,text,actions);document.body.append(panel);panel.showModal();
    button(actions,'cancel',async()=>{panel.close();panel.remove();panel=null;});
    button(actions,'confirm',async()=>{
      if(operation)return;operation=true;
      const old=gate.target,controller=new AbortController();
      actions.replaceChildren();const cancel=button(actions,'cancel',async()=>{controller.abort();cancel.disabled=true;});
      panel.oncancel=event=>{event.preventDefault();controller.abort();cancel.disabled=true;};
      try{
        document.activeElement?.blur();await Promise.resolve();await gate.pause();
        const source=old||original;
        const prefInfo=await api.info({location:state.location,store:'settings',id:'workflow-preferences-v1'});
        const hasDocs=(await source.keys('docs')).length>0;
        const restorePreferences=!hasDocs&&prefInfo.exists;
        await WFPVaultMigration.transfer({bridge:api,records,source,local:await localReady,location:state.location,vaultId:state.id,signal:controller.signal,
          preferences:restorePreferences?undefined:WFPVaultPreferences.snapshot(),
          progress:(done,total,finishing)=>{text.textContent=t('writing')+' '+done+' / '+total;if(finishing)cancel.disabled=true;}});
        if(restorePreferences)WFPVaultPreferences.restore((await records.load(state.location,'settings','workflow-preferences-v1')).record);
        gate.resume(await attach(state));await Promise.resolve();await gate.pause();
        // User-visible state is rebuilt only after durable data and queued writes.
        location.reload();
      }catch(error){
        if(error.message==='VAULT_MIGRATION_CANCELLED'){gate.resume(old||original);text.textContent=t('cancelled');}
        else if(error.message==='VAULT_MIGRATION_CONFLICT'){gate.resume(old||original);text.textContent=t('conflict');}
        else {status('error');text.textContent=t('failed');}
        actions.replaceChildren();button(actions,'unlock',async()=>{await boot();});
      }finally{operation=false;}
    });
  }
  async function manage(locked=false,error){
    if(operation)return;
    panel?.close();panel?.remove();panel=document.createElement('dialog');panel.className='native-vault-dialog';panel.dataset.keinUe='';
    const h=document.createElement('h2'),text=document.createElement('p'),explain=document.createElement('p'),actions=document.createElement('div');
    h.textContent=t('title');text.textContent=locked?t('blocked'):active?t('folder')+(active.state.folder||''):t('internal');explain.textContent=t('notice');
    panel.append(h,text,explain,actions);document.body.append(panel);panel.showModal();
    panel.oncancel=event=>{if(locked)event.preventDefault();};
    if(locked){
      button(actions,'unlock',async()=>{
        const wanted=needed||active?.state;
        if(wanted){const answer=await api.unlock({location:wanted.location,language:language()});if(answer.cancelled)return;}
        await boot();
      });
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
      button(actions,'choose',async()=>{const answer=await api.choose({language:language()});if(!answer.cancelled)await confirmMove(answer.state);});
      if(active)button(actions,'lock',async()=>{document.activeElement?.blur();await gate.pause();await active.journal.tail;await api.lock();await boot();});
      button(actions,'close',async()=>{panel.close();panel.remove();panel=null;});
    }
  }
  // Existing settings dialog remains intact, including BYOK edits and old backup.
  const observe=new MutationObserver(()=>{
    const backup=document.getElementById('stSicherung');
    if(backup&&!document.getElementById('stNativeVault')){
      const b=document.createElement('button');b.id='stNativeVault';b.className='knopf';b.dataset.keinUe='';b.textContent=t('title');b.onclick=()=>void manage();backup.parentElement.append(b);
    }
    const storage=document.getElementById('stSpeicher');
    if(storage&&active){const text=t('folder')+(active.state.folder||'');if(storage.textContent!==text){storage.dataset.keinUe='';storage.textContent=text;}}
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
  window.WFPNativeVault=Object.freeze({manage,boot,gate,selectLocation:confirmMove});
  void boot().catch(error=>{status('error');void manage(true,error);});
})();
