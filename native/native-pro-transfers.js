/* Selected, ordinary core outputs. A committed outbox keeps the exact chosen
   bytes across restart; only the receiving app's durable mark means receipt. */
(() => {
  'use strict';
  if(!window.Capacitor?.isNativePlatform?.())return;
  const api=Capacitor.Plugins.WorkflowVault,C=window.WFPProContract,store=window.WFPProTransferStore;
  if(typeof api?.tresorVerbinden!=='function'||typeof api.tresorUebergabe!=='function')return;
  const origins=new WeakMap();
  const encode=data=>{let s='';for(let i=0;i<data.length;i+=8192)s+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(s);};
  function decode(data){
    if(typeof data!=='string'||data.length>Math.ceil(C.MAX/3)*4)throw Error('PRO_BYTES_INVALID');
    return Uint8Array.from(atob(data),c=>c.charCodeAt(0));
  }
  function capture(files){
    for(const file of files||[]){
      if(!(file instanceof Blob)||origins.has(file))continue;
      const ids=window.__wfpdf?.ausgabeHerkunft?.(file)||[],S=window.__wfpdf?.S;
      const docs=ids.map(id=>S?.doc?.id===id?S.doc:S?.docs?.find(d=>d.id===id));
      origins.set(file,{scope:window.WFPNativeVault?.aktiv?.()?.id||'internal',ids:[...ids],
        receipts:docs.map(d=>d?.proEingang?.receipt||null)});
    }
  }
  const state=()=>api.tresorZustand({});
  async function connected(expected){
    const z=await state();
    if(!z.offen||!C.entry(z.kennung))throw Error('TRESOR_GESPERRT');
    if(expected&&z.kennung!==expected)throw Error('PRO_VAULT_CHANGED');
    return z;
  }
  const call=(vaultId,aktion,args={})=>api.tresorUebergabe({...args,vaultId,aktion});
  async function inbox(vaultId){
    await connected(vaultId);const r=await call(vaultId,'eingang');
    if(!Array.isArray(r?.items))throw Error('PRO_CONTRACT_INVALID');
    return r.items.map(row=>{
      if(!C.entry(row?.entryId))throw Error('PRO_CONTRACT_INVALID');
      try {if(row.fehler)throw Error(row.fehler);return {entryId:row.entryId,vertrag:C.contract(row.vertrag,C.APP)};}
      catch(error){return {entryId:row.entryId,fehler:String(error.message)};}
    });
  }
  async function receive(vaultId,entry){
    if(!C.entry(entry?.entryId))throw Error('PRO_CONTRACT_INVALID');
    const expected=C.contract(entry.vertrag,C.APP);
    return store.run(async ctx=>{
      await connected(vaultId);
      const read=await call(vaultId,'lesen',{entryId:entry.entryId}),m=C.contract(read?.vertrag,C.APP);
      if(read.entryId!==entry.entryId||JSON.stringify(m)!==JSON.stringify(expected))throw Error('PRO_IDENTITY_CONFLICT');
      const data=decode(read.dataBase64);
      if(data.length!==m.groesse||await store.hash(data)!==m.sha256)throw Error('PRO_BYTES_CHANGED');
      const saved=await WFPDurableImport.take(new File([data],m.name,{type:m.mime}),
        {kind:'pro',vaultId,source:m.quelle,transfer:m.id},{sha256:m.sha256,size:m.groesse,contract:m},ctx);
      const ack=await call(vaultId,'quittieren',{entryId:entry.entryId,sha256:m.sha256});
      if(ack?.stand!=='im-eingang')throw Error('PRO_RECEIPT_UNCONFIRMED');
      return saved;
    });
  }
  async function sourceOf(file,ctx){
    const proof=origins.get(file);
    if(!proof||proof.scope!==ctx.scope)throw Error('PRO_LIBRARY_CHANGED');
    let origin=null;
    if(proof.ids.length===1&&proof.receipts[0]){
      const receipt=await ctx.repo.get(proof.receipts[0]);
      if(receipt){const checked=await store.validate(receipt);
        if(checked.kind==='eingang'&&checked.docId===proof.ids[0]&&checked.stand==='gespeichert')origin=checked.vertrag||null;
      }
    }
    return {proof,origin};
  }
  async function prepare(ctx,vaultId,file,target){
    const {proof,origin}=await sourceOf(file,ctx),sha256=await store.hash(file);
    const dokumentId=origin?.dokumentId||(proof.ids.length===1?proof.ids[0]:'export-'+sha256);
    let m={vertrag:'familienakte-uebergabe/1',id:'pending',quelle:C.APP,ziel:target,dokumentId,
      name:file.name||'Dokument.pdf',mime:file.type||'application/octet-stream',groesse:file.size,sha256,...(origin?{bezug:origin.id}:{})};
    const id=await store.key(C.outgoingIdentity(vaultId,m));m=C.contract({...m,id:'wfp-'+id.slice('pro-transfer-'.length)},target);
    const old=await ctx.repo.get(id);
    if(old){const checked=await store.validate(old);if(checked.kind!=='ausgang'||JSON.stringify(checked.vertrag)!==JSON.stringify(m))throw Error('PRO_IDENTITY_CONFLICT');return checked;}
    const row={id,kind:'ausgang',vaultId,vertrag:m,payloadId:C.payloadId(sha256),stand:'vorbereitet',at:new Date().toISOString()};
    await store.writePayload(ctx,{payloadId:row.payloadId,sha256,groesse:file.size},file);
    await ctx.repo.put(row);return row;
  }
  async function releaseConfirmed(ctx,rows){
    const needed=new Set(rows.filter(r=>r.kind==='ausgang'&&r.stand!=='im-eingang').map(r=>r.payloadId));
    const done=new Set(rows.filter(r=>r.kind==='ausgang'&&r.stand==='im-eingang').map(r=>r.payloadId));let changed=false;
    for(const id of done)if(!needed.has(id)&&await ctx.db.get('files',id)){await ctx.db.del('files',id);changed=true;}
    if(changed)await ctx.flush();
  }
  async function confirmIn(ctx,row){
    if(!row.entryId)return row;
    const answer=await call(row.vaultId,'stand',{ziel:row.vertrag.ziel,entryId:row.entryId});
    if(typeof answer?.bestaetigt!=='boolean')throw Error('PRO_RECEIPT_UNCONFIRMED');
    if(answer.bestaetigt&&row.stand!=='im-eingang'){
      row={...row,stand:'im-eingang'};await ctx.repo.put(row);
    }
    if(row.stand==='im-eingang'){
      await releaseConfirmed(ctx,await store.snapshotIn(ctx));
    }
    return row;
  }
  async function sendIn(ctx,row){
    await connected(row.vaultId);
    if(row.stand==='im-eingang')return row;
    const m=row.vertrag,data=await store.readPayload(ctx,{payloadId:row.payloadId,sha256:m.sha256,groesse:m.groesse});
    const result=await call(row.vaultId,'senden',{vertrag:m,dataBase64:encode(data)});
    if(!C.entry(result?.id)||result.sha256!==m.sha256||result.groesse!==m.groesse||result.name!==m.name||result.art!==m.mime||
      result.schreiber!==C.APP||result.verschluesselung!=='fpt1'||typeof result.verweis!=='string'||!result.verweis.startsWith('Uebergaben/'+m.id+'/')||
      row.entryId&&row.entryId!==result.id)throw Error('PRO_SEND_UNCONFIRMED');
    row={...row,entryId:result.id,stand:'weitergegeben'};await ctx.repo.put(row);
    return confirmIn(ctx,row);
  }
  async function send(files,target,vaultId){
    if(!Array.isArray(files)||!files.length||files.some(file=>!C.accepts(target,file)))throw Error('PRO_FILE_TYPE_OR_SIZE');
    const z=await connected(vaultId);
    return store.run(async ctx=>{
      // Validate the whole selected batch before its first native send.
      for(const file of files)await sourceOf(file,ctx);
      const results=[];for(const file of files)results.push(await sendIn(ctx,await prepare(ctx,z.kennung,file,target)));
      return results;
    });
  }
  const outbox=()=>store.run(async ctx=>{
    const rows=await store.snapshotIn(ctx);
    // Resume a cleanup interrupted after the receipt committed. The completed
    // receipt survives; only its no-longer-needed temporary output is removed.
    await releaseConfirmed(ctx,rows);return rows.filter(r=>r.kind==='ausgang');
  });
  const retry=id=>store.run(async ctx=>{const row=await store.validate(await ctx.repo.get(id));if(row.kind!=='ausgang')throw Error('PRO_RECEIPT_INVALID');return sendIn(ctx,row);});
  const confirm=id=>store.run(async ctx=>{const row=await store.validate(await ctx.repo.get(id));if(row.kind!=='ausgang')throw Error('PRO_RECEIPT_INVALID');await connected(row.vaultId);return confirmIn(ctx,row);});
  window.WFPProTransfers=Object.freeze({capture,state,inbox,receive,send,outbox,retry,confirm});
})();
