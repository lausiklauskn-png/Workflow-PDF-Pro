/* An explicit portable preference allowlist. Secrets, provider consents,
   SBKIM identities, transient share caches and model downloads stay local. */
((g)=>{
  'use strict';
  const allow={
    wfpdf_einst_v1:['anbieter','modell','uebModell','linien','sortierung','bedeutung','bedMsStueck','ueVon','ueNach','ueRueck','ueBilder','ueMsSeite'],
    wfpdf_scan_v1:['filter','format','qualitaet','durchsuchbar','sprache'],
    wfpdf_sprache_v1:['lang','tipps']
  };
  const backup='wfpdf_sicherung_zuletzt';
  function select(value,keys){
    const result={};if(!value||typeof value!=='object'||Array.isArray(value))return result;
    for(const key of keys)if(Object.hasOwn(value,key))result[key]=structuredClone(value[key]);
    return result;
  }
  function snapshot(storage=localStorage){
    const values={};for(const [key,keys]of Object.entries(allow)){
      const text=storage.getItem(key);if(text!==null)values[key]=select(JSON.parse(text),keys);
    }
    const date=storage.getItem(backup);if(date!==null)values[backup]=date;
    return {id:'workflow-preferences-v1',version:1,values};
  }
  function restore(record,storage=localStorage){
    if(record?.id!=='workflow-preferences-v1'||record.version!==1||!record.values)throw Error('VAULT_PREFERENCES_DAMAGED');
    for(const [key,keys]of Object.entries(allow))if(Object.hasOwn(record.values,key)){
      const current=JSON.parse(storage.getItem(key)||'{}');
      storage.setItem(key,JSON.stringify({...current,...select(record.values[key],keys)}));
    }
    if(typeof record.values[backup]==='string')storage.setItem(backup,record.values[backup]);
  }
  g.WFPVaultPreferences=Object.freeze({snapshot,restore,keys:Object.freeze([...Object.keys(allow),backup])});
})(globalThis);
