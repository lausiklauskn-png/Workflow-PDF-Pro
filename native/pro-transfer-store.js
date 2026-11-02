/* Receipts belong to the selected library. Internal storage uses committed IDB
   transactions; a configured vault uses its existing binary record transport
   and encrypted settings store. No new cipher or core database schema. */
(() => {
  'use strict';
  const PREFIX='pro-transfer-',hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
  const bytes=async value=>value instanceof Blob?new Uint8Array(await value.arrayBuffer()):value instanceof ArrayBuffer?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):(()=>{throw Error('PRO_BYTES_INVALID');})();
  const hash=async value=>hex(await crypto.subtle.digest('SHA-256',await bytes(value)));
  const key=async value=>PREFIX+await hash(new TextEncoder().encode(JSON.stringify(value)));
  let connection,tail=Promise.resolve();
  function open(){return connection||=new Promise((resolve,reject)=>{
    const q=indexedDB.open('WorkflowProTransfers1',1);
    q.onupgradeneeded=()=>q.result.createObjectStore('receipts',{keyPath:'key'});
    q.onsuccess=()=>{q.result.onversionchange=()=>{q.result.close();connection=null;};resolve(q.result);};
    q.onerror=()=>{connection=null;reject(q.error);};
    q.onblocked=()=>{connection=null;reject(Error('PRO_RECEIPT_BLOCKED'));};
  });}
  async function local(scope,method,value){const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction('receipts',method==='put'?'readwrite':'readonly'),s=tx.objectStore('receipts');let result;
    tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||Error('PRO_RECEIPT_ABORTED'));tx.onerror=()=>reject(tx.error);
    const q=method==='all'?s.getAll():method==='get'?s.get(scope+':'+value):s.put({key:scope+':'+value.id,scope,record:structuredClone(value)});
    q.onsuccess=()=>{result=method==='all'?q.result.filter(r=>r.scope===scope).map(r=>r.record):method==='get'?q.result?.record:q.result;};
  });}
  async function session(work){
    const within=async ctx=>{
      const scope=ctx.state?.id||'internal';
      const repo={
        async get(id){
          if(!/^pro-transfer-[a-f0-9]{64}$/.test(id))throw Error('PRO_RECEIPT_INVALID');
          if(!ctx.journal)return local(scope,'get',id);
          return ctx.journal.read(async()=>{
            const info=await Capacitor.Plugins.WorkflowVault.info({location:ctx.state.location,store:'settings',id});
            if(info.exists===false)return undefined;
            return (await ctx.records.load(ctx.state.location,'settings',id,info.hash)).record;
          });
        },
        async put(record){
          if(!/^pro-transfer-[a-f0-9]{64}$/.test(record?.id||''))throw Error('PRO_RECEIPT_INVALID');
          const snapshot=structuredClone(record);
          if(ctx.journal)await ctx.journal.enqueue(async()=>{
            await ctx.journal.check();const info=await ctx.records.save(ctx.state.location,'settings',snapshot);
            await ctx.records.load(ctx.state.location,'settings',snapshot.id,info.hash);
          });
          await local(scope,'put',snapshot);
        },
        async all(){
          if(!ctx.journal)return local(scope,'all');
          return ctx.journal.read(async()=>{
            const {ids}=await Capacitor.Plugins.WorkflowVault.list({location:ctx.state.location,store:'settings'});
            if(!Array.isArray(ids))throw Error('PRO_RECEIPT_INVALID');
            const rows=[];for(const id of ids.filter(id=>/^pro-transfer-[a-f0-9]{64}$/.test(id)))rows.push((await ctx.records.load(ctx.state.location,'settings',id)).record);
            return rows;
          });
        }
      };
      return work({...ctx,scope,repo});
    };
    return window.WFPNativeVault?WFPNativeVault.withStorage(within):within({db:WFP.DB,state:null,flush:async()=>{}});
  }
  function run(work){const locked=()=>navigator.locks?navigator.locks.request('workflow-pro-transfers-v1',()=>session(work)):session(work);
    const result=tail.then(locked);tail=result.catch(()=>{});return result;}
  async function validate(row){
    if(row?.kind==='ausgang')return validateOutgoing(row);
    const source=row?.source;
    const identity=source?.kind==='native'?{kind:'native',batch:source.batch,item:source.item}:
      source?.kind==='pro'?{kind:'pro',vaultId:source.vaultId,source:source.source,transfer:source.transfer}:null;
    if(!identity||Object.values(identity).some(v=>typeof v!=='string'||!v||v.length>180||/[\u0000-\u001f]/.test(v)))throw Error('PRO_RECEIPT_INVALID');
    const id=await key(identity);
    if(row.id!==id||row.kind!=='eingang'||!['vorbereitet','gespeichert'].includes(row.stand)||row.docId!=='pro-'+id.slice(PREFIX.length)||
      !/^[a-f0-9]{64}$/.test(row.sha256)||!Number.isSafeInteger(row.size)||row.size<=0||row.size>200*1024*1024||
      typeof row.name!=='string'||!row.name||row.name.length>1024||typeof row.at!=='string'||!Number.isFinite(Date.parse(row.at))||
      row.pdfHash!==undefined&&!/^[a-f0-9]{64}$/.test(row.pdfHash)||row.stand==='gespeichert'&&!row.pdfHash)throw Error('PRO_RECEIPT_INVALID');
    const contract=row.vertrag?window.WFPProContract.contract(row.vertrag,window.WFPProContract.APP):null;
    if(contract&&(source.kind!=='pro'||contract.quelle!==source.source||contract.id!==source.transfer||contract.sha256!==row.sha256||contract.groesse!==row.size||contract.name!==row.name))throw Error('PRO_RECEIPT_INVALID');
    return {id,kind:'eingang',stand:row.stand,docId:row.docId,source:identity,sha256:row.sha256,size:row.size,name:row.name,at:row.at,...(row.pdfHash?{pdfHash:row.pdfHash}:{}),...(contract?{vertrag:contract}:{})};
  }
  async function validateOutgoing(row){
    const C=window.WFPProContract,m=C.contract(row.vertrag,row.vertrag?.ziel),identity=C.outgoingIdentity(row.vaultId,m),id=await key(identity);
    if(row.id!==id||m.id!=='wfp-'+id.slice(PREFIX.length)||row.payloadId!==C.payloadId(m.sha256)||
      !['vorbereitet','weitergegeben','im-eingang'].includes(row.stand)||typeof row.at!=='string'||!Number.isFinite(Date.parse(row.at))||
      row.entryId!==undefined&&!C.entry(row.entryId)||row.stand!=='vorbereitet'&&!row.entryId)throw Error('PRO_RECEIPT_INVALID');
    return {id,kind:'ausgang',vaultId:row.vaultId,vertrag:m,payloadId:row.payloadId,stand:row.stand,at:row.at,...(row.entryId?{entryId:row.entryId}:{})};
  }
  const snapshotIn=async({repo})=>Promise.all((await repo.all()).map(validate));
  const snapshot=()=>run(snapshotIn);
  function payloadMeta(value){
    if(!value||value.payloadId!==window.WFPProContract.payloadId(value.sha256)||!Number.isSafeInteger(value.groesse)||value.groesse<=0||value.groesse>window.WFPProContract.MAX)throw Error('PRO_BYTES_INVALID');
    return {payloadId:value.payloadId,sha256:value.sha256,groesse:value.groesse};
  }
  const pendingPayloads=rows=>[...new Map(rows.filter(r=>r.kind==='ausgang'&&r.stand!=='im-eingang').map(r=>[r.payloadId,payloadMeta({payloadId:r.payloadId,sha256:r.vertrag.sha256,groesse:r.vertrag.groesse})])).values()];
  async function readPayload(ctx,value){
    const meta=payloadMeta(value),row=await ctx.db.get('files',meta.payloadId);
    if(!row)throw Error('PRO_PAYLOAD_MISSING');
    const data=await bytes(row.bytes);
    if(data.byteLength!==meta.groesse||await hash(data)!==meta.sha256)throw Error('PRO_BYTES_CHANGED');
    return data;
  }
  async function writePayload(ctx,value,data){
    const meta=payloadMeta(value),content=await bytes(data);
    if(content.byteLength!==meta.groesse||await hash(content)!==meta.sha256)throw Error('PRO_BYTES_CHANGED');
    const old=await ctx.db.get('files',meta.payloadId);
    if(!old){await ctx.db.put('files',{id:meta.payloadId,bytes:content});await ctx.flush();}
    await readPayload(ctx,meta);
    return !old;
  }
  async function restoreIn(rows,ctx){
    if(!Array.isArray(rows)||rows.length>100000)throw Error('PRO_RECEIPT_INVALID');
    const checked=await Promise.all(rows.map(validate));if(new Set(checked.map(r=>r.id)).size!==checked.length)throw Error('PRO_RECEIPT_INVALID');
    const {repo}=ctx;
      const plan=[];
      for(const row of checked){
        const old=await repo.get(row.id);
        if(row.kind==='ausgang'){
          if(old){await validate(old);if(old.kind!==row.kind||old.vaultId!==row.vaultId||JSON.stringify(old.vertrag)!==JSON.stringify(row.vertrag)||old.entryId&&row.entryId&&old.entryId!==row.entryId)throw Error('PRO_IDENTITY_CONFLICT');}
          const rank={vorbereitet:0,weitergegeben:1,'im-eingang':2};
          if(!old||rank[row.stand]>rank[old.stand]){
            if(row.stand!=='im-eingang')await readPayload(ctx,{payloadId:row.payloadId,sha256:row.vertrag.sha256,groesse:row.vertrag.groesse});
            plan.push(row);
          }
          continue;
        }
        if(old){await validate(old);if(old.kind!==row.kind||old.sha256!==row.sha256||old.size!==row.size||old.name!==row.name||old.pdfHash&&row.pdfHash&&old.pdfHash!==row.pdfHash||JSON.stringify(old.vertrag||null)!==JSON.stringify(row.vertrag||null))throw Error('PRO_IDENTITY_CONFLICT');}
        if(!old||old.stand!=='gespeichert'&&row.stand==='gespeichert')plan.push(row);
        else if(old.stand==='vorbereitet'&&!old.pdfHash&&row.pdfHash)plan.push({...old,pdfHash:row.pdfHash});
      }
      for(const row of plan)await repo.put(row);
  }
  const restore=rows=>run(ctx=>restoreIn(rows,ctx));
  // Called only by the storage adapter after its gate has drained all imports.
  // The selected library is still authoritative during migration preparation.
  async function snapshotFor(state,records){
    if(!state?.configured)return local('internal','all');
    const {ids}=await Capacitor.Plugins.WorkflowVault.list({location:state.location,store:'settings'});
    if(!Array.isArray(ids))throw Error('PRO_RECEIPT_INVALID');
    const rows=[];for(const id of ids.filter(id=>/^pro-transfer-[a-f0-9]{64}$/.test(id)))rows.push((await records.load(state.location,'settings',id)).record);
    return rows;
  }
  window.WFPProTransferStore=Object.freeze({run,hash,key,bytes,snapshot,snapshotIn,restore,restoreIn,snapshotFor,validate,pendingPayloads,readPayload,writePayload});
})();
