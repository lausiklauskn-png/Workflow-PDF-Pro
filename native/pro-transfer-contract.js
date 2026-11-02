/* The canonical transfer metadata; no transport, document content or new cipher here. */
(() => {
  'use strict';
  const APP='workflow-pdf-pro',APPS=Object.freeze(['familienakte','workflow-pdf-pro','private-brain','bookledgerpro']),MAX=20*1024*1024;
  const entry=id=>typeof id==='string'&&/^[A-Za-z0-9_.-]{1,160}$/.test(id)&&id!=='.'&&id!=='..';
  function contract(value,target){
    if(!value||value.vertrag!=='familienakte-uebergabe/1'||!APPS.includes(value.quelle)||!APPS.includes(value.ziel)||value.ziel!==target||
      !entry(value.id)||typeof value.dokumentId!=='string'||!/^[A-Za-z0-9_.:-]{1,200}$/.test(value.dokumentId)||
      typeof value.name!=='string'||!value.name||value.name.length>255||typeof value.mime!=='string'||value.mime.length>200||
      !Number.isSafeInteger(value.groesse)||value.groesse<=0||value.groesse>MAX||!/^[a-f0-9]{64}$/.test(value.sha256||'')||
      value.bezug!==undefined&&!entry(value.bezug))throw Error('PRO_CONTRACT_INVALID');
    return {vertrag:value.vertrag,id:value.id,quelle:value.quelle,ziel:value.ziel,dokumentId:value.dokumentId,name:value.name,mime:value.mime,
      groesse:value.groesse,sha256:value.sha256,...(value.bezug?{bezug:value.bezug}:{})};
  }
  function outgoingIdentity(vaultId,value){
    const m=contract(value,value?.ziel);
    if(!entry(vaultId)||m.quelle!==APP||m.ziel===APP)throw Error('PRO_CONTRACT_INVALID');
    return {kind:'outgoing',vaultId,documentId:m.dokumentId,target:m.ziel,name:m.name,mime:m.mime,sha256:m.sha256,bezug:m.bezug||''};
  }
  const payloadId=sha=>{if(!/^[a-f0-9]{64}$/.test(sha))throw Error('PRO_BYTES_INVALID');return 'pro-export-'+sha;};
  const accepts=(target,file)=>APPS.includes(target)&&target!==APP&&file instanceof Blob&&file.size>0&&file.size<=MAX&&
    (target!=='bookledgerpro'||file.type==='application/pdf'||/\.pdf$/i.test(file.name||'')||/^image\//.test(file.type)||/\.eml$/i.test(file.name||''));
  window.WFPProContract=Object.freeze({APP,APPS,MAX,entry,contract,outgoingIdentity,payloadId,accepts});
})();
