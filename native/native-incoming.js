/* Explicit native SEND/VIEW intake. The ordinary core import owns parsing,
   working states and manual checks. Durable readback precedes acknowledgement. */
(() => {
  'use strict';
  if (!window.Capacitor?.isNativePlatform?.()) return;
  const api = Capacitor.Plugins.WorkflowIncoming;
  if (!api) return;
  const words = {
    received: ['Dateien empfangen', 'Files received', 'Получены файлы', 'تم استلام الملفات'],
    read: ['Einlesen', 'Import', 'Импортировать', 'استيراد'],
    reading: ['Dateien werden gelesen …', 'Reading files …', 'Чтение файлов …', 'جارٍ قراءة الملفات …'],
    dismiss: ['Nicht einlesen', 'Dismiss', 'Не импортировать', 'تجاهل'],
    confirm: ['Empfang bestätigen', 'Acknowledge receipt', 'Подтвердить получение', 'تأكيد الاستلام'],
    retry: ['Erneut versuchen', 'Retry', 'Повторить', 'إعادة المحاولة'],
    failed: ['Einlesen nicht vollständig abgeschlossen. Die Empfangskopien bleiben erhalten. Erneut versuchen setzt den Eingang fort.', 'Import did not complete. Intake copies are retained. Retry resumes this intake.', 'Импорт не завершён. Полученные копии сохранены. Повторите, чтобы продолжить.', 'لم يكتمل الاستيراد. تبقى نسخ الاستلام محفوظة. أعد المحاولة للمتابعة.'],
    uncertain: ['Dateien gespeichert und geprüft. Die Empfangsbestätigung ist fehlgeschlagen. Erneut versuchen bestätigt denselben Eingang.', 'Files saved and verified. Acknowledgement failed. Retry acknowledges the same intake.', 'Файлы сохранены и проверены. Подтверждение не удалось. Повторите для того же входящего пакета.', 'حُفظت الملفات وتم التحقق منها. تعذر تأكيد الاستلام. أعد المحاولة لتأكيد الحزمة نفسها.'],
    history:['Empfangene Dateien wiederherstellen','Recover received files','Восстановить полученные файлы','استعادة الملفات المستلمة'],
    recovery:['Private Empfangskopien bleiben bis zum ausdrücklichen Löschen erhalten. Erneutes Einlesen kann Duplikate erzeugen. Bereits importierte Dokumente bleiben beim Löschen einer Empfangskopie erhalten.','Private intake copies remain until you explicitly delete them. Importing again can create duplicates. Deleting an intake copy preserves imported documents.','Частные копии полученных файлов хранятся до явного удаления. Повторный импорт может создать дубликаты. Удаление копии не удаляет импортированные документы.','تبقى النسخ الخاصة للملفات المستلمة حتى تحذفها صراحة. قد تنشأ نسخ مكررة عند الاستيراد مجدداً. حذف نسخة الاستلام يُبقي المستندات المستوردة.'],
    offer:['Erneut zum Einlesen anbieten','Offer for import again','Предложить импорт снова','إتاحة الاستيراد مجدداً'],
    remove:['Empfangskopie löschen','Delete intake copy','Удалить полученную копию','حذف نسخة الاستلام'],
    really:['Wirklich löschen? Erneut tippen.','Delete this copy? Tap again.','Удалить копию? Нажмите снова.','حذف هذه النسخة؟ اضغط مجدداً.'],
    close:['Schließen','Close','Закрыть','إغلاق'],
    empty:['Keine Empfangskopien vorhanden.','No intake copies available.','Нет полученных копий.','لا توجد نسخ مستلمة.']
  };
  const t = key => words[key][Math.max(0, ['de', 'en', 'ru', 'ar'].indexOf(document.documentElement.lang))];
  let panel, busy = false, requested = false;
  function show() {
    if (busy) { requested = true; return; }
    if (panel || !document.getElementById('inDatei')?.onchange) return;
    busy = true;
    void api.pending().then(batch => {
      if (batch.empty) return;
      if (typeof batch.id !== 'string' || !batch.id) throw new Error('INCOMING_INVALID_TRANSFER');
      panel = document.createElement('section'); panel.id = 'nativeIncoming'; panel.dataset.keinUe = '';
      panel.setAttribute('aria-label', t('received')); panel.setAttribute('role', 'region');
      const line = document.createElement('p'), list = document.createElement('p');
      line.setAttribute('role', 'status'); line.textContent = t(batch.problem ? 'failed' : 'received');
      list.textContent = (batch.files || []).map(file => file.name).join(' · ');
      const read = document.createElement('button'), dismiss = document.createElement('button');
      read.className = dismiss.className = 'knopf'; read.textContent = t(batch.problem ? 'retry' : 'read'); dismiss.textContent = t('dismiss');
      panel.append(line, list, read, dismiss); document.body.append(panel);
      dismiss.onclick = async () => {
        if (busy) return; busy = true; read.disabled = dismiss.disabled = true;
        try {
          const current = await api.pending();
          if (current.id === batch.id) await api.acknowledge({ id: batch.id,discard:!submitted });
          else if (current.empty !== true && typeof current.id !== 'string') throw new Error('INCOMING_INVALID_TRANSFER');
          panel.remove(); panel = null;
        }
        catch { line.textContent = t('failed'); }
        finally { busy = false; read.disabled = dismiss.disabled = false; show(); }
      };
      let submitted=false;
      read.onclick = async () => {
        if (busy) return; busy = true; read.disabled = dismiss.disabled = true;
        submitted=false;
        let dispatched = false;
        try {
          line.textContent = t('reading');
          // Read and verify every source before importing any file. Persisted
          // per-file reservations make a partial import safe to resume.
          const current = await api.pending();
          if (current.id !== batch.id || !Array.isArray(current.files) || !current.files.length) throw new Error('INCOMING_INVALID_TRANSFER');
          const files = [];let total=0;
          for (const item of current.files) {
            if (typeof item.id !== 'string' || typeof item.name !== 'string' || !Number.isSafeInteger(item.size) || item.size<=0 || item.size>200*1024*1024 || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('INCOMING_INVALID_TRANSFER');
            total+=item.size;if(total>512*1024*1024)throw Error('INCOMING_INVALID_TRANSFER');
            const parts = []; let offset = 0;
            while (true) {
              const part = await api.read({ batch: batch.id, id: item.id, offset });
              if (typeof part.data !== 'string' || part.data.length > 349528 || typeof part.done !== 'boolean') throw new Error('INCOMING_INVALID_TRANSFER');
              const bytes = Uint8Array.from(atob(part.data), char => char.charCodeAt(0));
              if (bytes.length > 262144 || !bytes.length && !part.done) throw new Error('INCOMING_INVALID_TRANSFER');
              parts.push(bytes); offset += bytes.length;
              if(offset>item.size||part.done&&offset!==item.size)throw new Error('INCOMING_INVALID_TRANSFER');
              if (part.done) break;
            }
            const file=new File(parts,item.name,{type:item.mime||''});
            if(await WFPProTransferStore.hash(file)!==item.sha256)throw Error('INCOMING_INVALID_TRANSFER');
            files.push({file,identity:{kind:'native',batch:batch.id,item:item.id},expected:{sha256:item.sha256,size:item.size}});
          }
          await WFPDurableImport.takeMany(files);
          dispatched = true; submitted=true;
          await api.acknowledge({ id: batch.id }); panel.remove(); panel = null;
        } catch {
          line.textContent = t(dispatched ? 'uncertain' : 'failed'); read.textContent = t('retry');
          // Retry uses the committed receipt and cannot duplicate an accepted
          // file. A failed/partial import keeps the native source pending.
          if (dispatched) dismiss.textContent = t('confirm');
        } finally { busy = false; read.disabled = dismiss.disabled = false; show(); }
      };
    }).catch(() => {
      // A bridge failure must remain visible even without an available batch.
      panel = document.createElement('p'); panel.id = 'nativeIncoming'; panel.dataset.keinUe = '';
      panel.setAttribute('role', 'alert'); panel.textContent = t('failed');
      const retry = document.createElement('button'); retry.className = 'knopf'; retry.textContent = t('retry');
      retry.onclick = () => { panel.remove(); panel = null; show(); }; panel.append(retry); document.body.append(panel);
    }).finally(() => { busy = false; if (requested) { requested = false; show(); } });
  }
  // Capacitor's injected legacy Plugins API returns a synchronous listener
  // handle; registerPlugin proxies return a promise. Support both contracts.
  Promise.resolve(api.addListener('available', show)).catch(() => {});
  async function history(){
    if(typeof api.history!=='function')return;
    const dialog=document.createElement('dialog');dialog.className='native-vault-dialog';dialog.dataset.keinUe='';
    const heading=document.createElement('h2'),help=document.createElement('p'),rows=document.createElement('div'),close=document.createElement('button');
    heading.textContent=t('history');help.textContent=t('recovery');close.className='knopf';close.textContent=t('close');close.onclick=()=>dialog.close();
    dialog.append(heading,help,rows,close);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
    try{
      const result=await api.history();if(!Array.isArray(result.receipts))throw Error();
      if(!result.receipts.length)rows.textContent=t('empty');
      for(const receipt of result.receipts){
        const row=document.createElement('section'),name=document.createElement('p'),offer=document.createElement('button'),remove=document.createElement('button');
        name.textContent=(receipt.files||[]).map(file=>file.name).join(' · ');offer.className=remove.className='knopf';offer.textContent=t('offer');remove.textContent=t('remove');
        offer.onclick=async()=>{offer.disabled=remove.disabled=true;try{await api.restore({id:receipt.id});dialog.close();show();}catch{help.textContent=t('failed');offer.disabled=remove.disabled=false;}};
        let armed=false;remove.onclick=async()=>{if(!armed){armed=true;remove.textContent=t('really');return;}offer.disabled=remove.disabled=true;try{await api.discardArchived({id:receipt.id});row.remove();}catch{help.textContent=t('failed');offer.disabled=remove.disabled=false;}};
        row.append(name,offer,remove);rows.append(row);
      }
    }catch{help.textContent=t('failed');}
  }
  function settings(){
    const anchor=document.getElementById('stSicherung');if(!anchor||document.getElementById('stIncomingHistory')||typeof api.history!=='function')return;
    const button=document.createElement('button');button.id='stIncomingHistory';button.className='knopf';button.textContent=t('history');button.onclick=history;anchor.parentNode.append(button);
  }
  new MutationObserver(settings).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('load', show);
  window.WFPNativeIncoming = Object.freeze({ show,history });
})();
