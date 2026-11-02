/* Normal core import, durable reservation and byte-exact readback. The caller
   owns acknowledgement; returning from a file-input event is never a receipt. */
(() => {
  'use strict';
  const store=window.WFPProTransferStore;
  function identity(value){
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('PRO_IDENTITY_INVALID');
    const out=value.kind==='native'?{kind:'native',batch:value.batch,item:value.item}:
      value.kind==='pro'?{kind:'pro',vaultId:value.vaultId,source:value.source,transfer:value.transfer}:null;
    if(!out||Object.values(out).some(v=>typeof v!=='string'||!v||v.length>180||/[\u0000-\u001f]/.test(v)))throw Error('PRO_IDENTITY_INVALID');
    return out;
  }
  async function take(file,who,expected={},session=null){
    if(!(file instanceof File)||file.size<=0||file.size>200*1024*1024)throw Error('PRO_FILE_INVALID');
    const source=identity(who),id=await store.key(source),sha256=await store.hash(file);
    if(expected.sha256!==undefined&&expected.sha256!==sha256||expected.size!==undefined&&expected.size!==file.size)throw Error('PRO_BYTES_CHANGED');
    const work=async({db,repo,flush})=>{
      let receipt=await repo.get(id);
      if(receipt&&(receipt.id!==id||receipt.kind!=='eingang'||!['vorbereitet','gespeichert'].includes(receipt.stand)||receipt.docId!=='pro-'+id.slice('pro-transfer-'.length)||receipt.sha256!==sha256||receipt.size!==file.size||receipt.name!==file.name||JSON.stringify(receipt.source)!==JSON.stringify(source)))throw Error('PRO_IDENTITY_CONFLICT');
      // A durable completed receipt also survives deliberate later editing or
      // deletion of the document. Repeating must never replace those changes.
      if(receipt?.stand==='gespeichert')return {id:receipt.docId,repeated:true};
      if(!receipt){receipt={id,kind:'eingang',stand:'vorbereitet',docId:'pro-'+id.slice('pro-transfer-'.length),source,sha256,size:file.size,name:file.name,at:new Date().toISOString()};await repo.put(receipt);}
      let doc=await db.get('docs',receipt.docId);
      if(doc){
        // A moved library or restored backup still carries the document's
        // reservation. Rebuild the local receipt only after fresh byte checks.
        if(!receipt.pdfHash&&doc.proEingang?.receipt===id){receipt={...receipt,pdfHash:doc.proEingang.pdfHash};await repo.put(receipt);}
        if(doc.proEingang?.receipt!==id||doc.proEingang.sha256!==sha256||doc.proEingang.size!==file.size||JSON.stringify(doc.proEingang.source)!==JSON.stringify(source)||!receipt.pdfHash||await store.hash(await db.getFile(doc.id))!==receipt.pdfHash)throw Error('PRO_PARTIAL_CONFLICT');
      }else{
        const result=await __wfpdf.importDateien([file],null,{still:true,async vorSpeichern(d,{bytes}){
          // The reservation and normalized PDF fingerprint are committed before
          // the core writes any document bytes. A crash can resume the same ID.
          receipt={...receipt,pdfHash:await store.hash(bytes)};await repo.put(receipt);
          d.id=receipt.docId;d.proEingang={receipt:id,source,sha256,size:file.size,pdfHash:receipt.pdfHash};
        }});
        if(result.length!==1||result[0].id!==receipt.docId)throw Error('PRO_IMPORT_FAILED');
      }
      await flush();doc=await db.get('docs',receipt.docId);
      if(!doc||doc.proEingang?.receipt!==id||doc.proEingang.sha256!==sha256||await store.hash(await db.getFile(doc.id))!==receipt.pdfHash)throw Error('PRO_IMPORT_UNCONFIRMED');
      // Preserve JSON working states and PDFs as well as photo originals, using
      // the existing original slot carried by the ordinary backup formats.
      const original=await db.get('files',doc.id+'~original');
      if(original){if(await store.hash(original.bytes)!==sha256)throw Error('PRO_ORIGINAL_CONFLICT');}
      else await db.put('files',{id:doc.id+'~original',name:file.name,bytes:new Uint8Array(await file.arrayBuffer())});
      await flush();
      const saved=await db.get('files',doc.id+'~original');
      if(!saved||await store.hash(saved.bytes)!==sha256||(await store.bytes(saved.bytes)).byteLength!==file.size)throw Error('PRO_ORIGINAL_UNCONFIRMED');
      await repo.put({...receipt,stand:'gespeichert'});
      return {id:receipt.docId,repeated:false};
    };
    return session?work(session):store.run(work);
  }
  const takeMany=items=>store.run(async session=>{
    const results=[];for(const item of items)results.push(await take(item.file,item.identity,item.expected,session));return results;
  });
  window.WFPDurableImport=Object.freeze({take,takeMany});
})();
