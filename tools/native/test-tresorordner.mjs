import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {chromium} from 'playwright-core';
import {root} from './prepare-web.mjs';
import {PDFDocument,StandardFonts} from 'pdf-lib';

test('Tresorordner D1: Abschnitt im Tresor-Kasten, Einzug, Inhaltsverzeichnis aus der echten Bibliothek',async t=>{
  const base=join(root,'www');
  const server=createServer(async(req,res)=>{try{
    const path=resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(path!==base&&!path.startsWith(base+'/'))throw Error();
    const file=path===base?join(path,'index.html'):path;
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  const fixture={eingang:[],marken:[],eingangDaten:new Map(),eingangTickets:new Map(),log:[],zeilen:null,einzugFehler:null,tresor:{gewaehlt:false,ordner:'',gemerkt:false,offen:false,eingezogen:false},records:new Map(),batch:null,primary:null,migration:null,unlocked:true,failRead:false,tickets:new Map()};
  const key=(store,id)=>JSON.stringify([store,id]);
  const state=()=>fixture.primary?{configured:true,location:'target',id:'vault',folder:'Internal chosen folder',unlocked:fixture.unlocked,reachable:true,problem:'VAULT_LOCKED'}:{configured:false,internal:true};
  const candidate=()=>({configured:true,location:'target',id:'vault',folder:'Internal chosen folder',unlocked:fixture.unlocked,reachable:true,problem:'VAULT_LOCKED'});
  async function call(method,a={}){
    const view=()=>fixture.batch||fixture.records;
    if(method==='state')return a.location?candidate():state();
    if(method==='migration')return {location:fixture.migration};
    if(method==='choose')return {state:candidate(),location:'target',created:true};
    if(method==='unlock'){fixture.unlocked=true;return {unlocked:true};}
    if(method==='lock'){fixture.unlocked=false;return candidate();}
    if(method==='prepareMigration'){fixture.migration='target';return {saved:true};}
    if(method==='completeMigration'){fixture.primary='target';fixture.migration=null;return state();}
    if(method==='cancelMigration'){fixture.migration=null;return {saved:true};}
    if(method==='beginBatch'){fixture.batch=new Map(fixture.records);return {started:true};}
    if(method==='abortBatch'){fixture.batch=null;return {aborted:true};}
    if(method==='commitBatch'){fixture.records=fixture.batch;fixture.batch=null;return {saved:true};}
    if(method==='begin'){const ticket=randomUUID();fixture.tickets.set(ticket,{store:a.store,id:a.id,data:Buffer.alloc(0)});return {ticket};}
    if(method==='append'){const item=fixture.tickets.get(a.ticket);assert.equal(item.data.length,a.offset);item.data=Buffer.concat([item.data,Buffer.from(a.data,'base64')]);return {ok:true};}
    if(method==='finish'){const item=fixture.tickets.get(a.ticket);assert.equal(item.data.length,a.size);item.hash=createHash('sha256').update(item.data).digest('hex');view().set(key(item.store,item.id),item);fixture.tickets.delete(a.ticket);return {saved:true,size:item.data.length,hash:item.hash};}
    if(method==='abort'){fixture.tickets.delete(a.ticket);return {};}
    if(method==='info'){if(fixture.failRead)throw Error('VAULT_FOLDER_UNAVAILABLE');const item=view().get(key(a.store,a.id));return item?{exists:true,size:item.data.length,hash:item.hash}:{exists:false};}
    if(method==='read'){if(fixture.failRead)throw Error('VAULT_FOLDER_UNAVAILABLE');const item=view().get(key(a.store,a.id));assert.equal(a.hash,item.hash);return {data:item.data.subarray(a.offset,a.offset+262144).toString('base64')};}
    if(method==='list')return {ids:[...view().keys()].map(k=>JSON.parse(k)).filter(k=>k[0]===a.store).map(k=>k[1])};
    if(method==='remove'){view().delete(key(a.store,a.id));return {saved:true};}
    if(method==='tresorZustand'){fixture.log.push(['tresorZustand',a]);return {...fixture.tresor};}
    if(method==='tresorEinziehen'){fixture.log.push(['tresorEinziehen',a]);if(fixture.einzugFehler){const e=fixture.einzugFehler;fixture.einzugFehler=null;throw Error(e);}
      fixture.tresor={gewaehlt:true,ordner:'Tresor-Probe',gemerkt:true,offen:true,eingezogen:true,erreichbar:true,vorhanden:true,pruefung:'PASST',eintraege:0};return {...fixture.tresor,eingezogenJetzt:true,angelegt:true};}
    if(method==='tresorVerzeichnis'){fixture.log.push(['tresorVerzeichnis',a]);const neu=JSON.stringify(a.zeilen)!==JSON.stringify(fixture.zeilen);fixture.zeilen=a.zeilen;fixture.tresor.eintraege=a.zeilen.length;return {geschrieben:neu,eintraege:a.zeilen.length};}
    if(method==='tresorSperren'){fixture.log.push(['tresorSperren',a]);fixture.tresor={...fixture.tresor,offen:false,eingezogen:false};return {...fixture.tresor};}
    // Übergabefach „Eingang-WorkflowPDF“ (Pro-Umbau 5), Stücke zu 500 Byte (Java: 192 KB) — so wird mehrfach gelesen
    if(method==='tresorEingang'){fixture.log.push(['tresorEingang',a]);return {ordner:'Eingang-WorkflowPDF',eintraege:fixture.eingang,marken:fixture.marken};}
    if(method==='tresorEingangOeffnen'){fixture.log.push(['tresorEingangOeffnen',a]);const e=fixture.eingang.find(x=>x.id===a.id);if(!e)throw Error('TRESOR_EINTRAG_FEHLT');const ticket=randomUUID();fixture.eingangTickets.set(ticket,{data:fixture.eingangDaten.get(a.id),pos:0});return {ticket,groesse:e.groesse,name:e.name,art:e.art};}
    if(method==='tresorEingangTeil'){const tk=fixture.eingangTickets.get(a.ticket);const teil=tk.data.subarray(tk.pos,tk.pos+500);tk.pos+=teil.length;fixture.log.push(['tresorEingangTeil',teil.length]);const fertig=teil.length<500;if(fertig)fixture.eingangTickets.delete(a.ticket);return {data:teil.toString('base64'),fertig};}
    if(method==='tresorEingangMarkieren'){fixture.log.push(['tresorEingangMarkieren',a]);fixture.marken.push(a.id);return {markiert:true};}
    throw Error('Unknown bridge method '+method);
  }
  const tresorMethoden=['tresorZustand','tresorEinziehen','tresorVerzeichnis','tresorSperren','tresorEingang','tresorEingangOeffnen','tresorEingangTeil','tresorEingangMarkieren'];
  const methoden=['state','migration','choose','unlock','lock','prepareMigration','completeMigration','cancelMigration','beginBatch','abortBatch','commitBatch','begin','append','finish','abort','info','read','list','remove'];
  async function seite(mitTresor){
    const page=await browser.newPage();await page.exposeFunction('__vaultCall',call);
    await page.addInitScript(names=>{
      const vault={};for(const method of names)vault[method]=a=>__vaultCall(method,a);
      const files={};for(const method of ['begin','append','finish','abort','save','share','print','openLink'])files[method]=async()=>({});
      window.Capacitor={isNativePlatform:()=>true,Plugins:{WorkflowFiles:files,WorkflowVault:vault}};
    },mitTresor?[...methoden,...tresorMethoden]:methoden);
    await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>window.WFPNativeVault&&!WFPNativeVault.gate.blocked&&window.__wfpdf&&window.PDFLib);
    return page;
  }
  const knopf=(page,text)=>page.locator('#nativeTresorordner button').filter({hasText:text});
  try{
    browser=await chromium.launch(process.env.WFP_CHROMIUM?{executablePath:process.env.WFP_CHROMIUM}:{});
    const page=await seite(true);
    let id;
    await t.test('ohne Dokumenttresor (nur Gerätespeicher) kein Tresorordner-Abschnitt',async()=>{
      id=await page.evaluate(async()=>{
        const pdf=await PDFLib.PDFDocument.create();const p=pdf.addPage();const f=await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
        p.drawText('Rechnung Nr. 4711 Musterfirma Zahlbar bis Ende Mai',{x:40,y:700,size:14,font:f});
        const bytes=await pdf.save();
        const [doc]=await __wfpdf.importDateien([new File([bytes],'Probe.pdf',{type:'application/pdf'})],null,{still:true});
        __wfpdf.dlg.einstellungen();return doc.id;
      });
      await page.waitForSelector('#stNativeVault');await page.click('#stNativeVault');
      await page.waitForSelector('.native-vault-dialog');
      assert.equal(await page.locator('#nativeTresorordner').count(),0);
      assert.equal(fixture.log.length,0);
      await page.locator('.native-vault-dialog button').filter({hasText:'Ordner wählen'}).click();
      await page.locator('.native-vault-dialog button').filter({hasText:'Übernahme starten'}).click();
      await page.waitForFunction(()=>window.WFPNativeVault&&!WFPNativeVault.gate.blocked&&window.__wfpdf?.S.docs.some(d=>d.name==='Probe'));
      await page.waitForFunction(()=>!document.querySelector('.native-vault-dialog'));
      assert.equal(fixture.primary,'target');
    });
    const oeffnen=async()=>{
      await page.evaluate(()=>{document.querySelector('.native-vault-dialog')?.remove();__wfpdf.dlg.einstellungen();});
      await page.waitForSelector('#stNativeVault');await page.click('#stNativeVault');
      await page.waitForSelector('#nativeTresorordner[data-zustand]');
    };
    await t.test('Knopf „In den Tresorordner einziehen“ im Tresor-Kasten, Erklärung nennt Probe-Kopie, kein Passwortfeld',async()=>{
      await page.waitForFunction(id=>WFP.DB.get('texte',id).then(r=>!!r),id);
      await oeffnen();
      assert.equal(await page.getAttribute('#nativeTresorordner','data-zustand'),'neu');
      // Die lange Erklärung steht hinter ⓘ (zugeklappt, Leitfaden § 1.2); die Zeile sagt kurz, wo es steht.
      assert.match(await page.textContent('#nativeTresorordnerZeile'),/noch nicht im Tresor/);
      assert.match(await page.textContent('#nativeTresorordnerInfo'),/Kopie davon.*„Workflow PDF Pro“ bleibt, wie es ist/);
      assert.equal(await knopf(page,'In den Tresorordner einziehen').count(),1);
      assert.equal(await page.locator('.native-vault-dialog input').count(),0);
    });
    await t.test('falscher Ordner (Fach selbst gewählt): klare Meldung, nichts geschrieben',async()=>{
      fixture.einzugFehler='TRESOR_ORDNER_IST_FACH';
      await knopf(page,'In den Tresorordner einziehen').click();
      await page.waitForFunction(()=>/Ebene darüber/.test(document.querySelector('#nativeTresorordnerHinweis')?.textContent||''));
      assert.equal(fixture.log.some(([m])=>m==='tresorVerzeichnis'),false);
      assert.equal(await page.getAttribute('#nativeTresorordner','data-zustand'),'neu');
    });
    await t.test('Einzug: danach Inhaltsverzeichnis aus der Bibliothek (Name, Größe, Fingerabdruck, Auszug), ohne Inhalt und Passwort',async()=>{
      fixture.log.length=0;
      await knopf(page,'In den Tresorordner einziehen').click();
      await page.waitForFunction(()=>document.querySelector('#nativeTresorordner')?.dataset.zustand==='verbunden');
      const einzug=fixture.log.find(([m])=>m==='tresorEinziehen')[1];
      assert.equal(einzug.location,'target');assert.equal(einzug.neuWaehlen,undefined);
      const v=fixture.log.filter(([m])=>m==='tresorVerzeichnis');assert.equal(v.length,1);
      const [z]=v[0][1].zeilen;assert.equal(v[0][1].zeilen.length,1);
      const datei=fixture.records.get(JSON.stringify(['files',id]));
      assert.equal(z.id,id);assert.equal(z.name,'Probe.pdf');assert.equal(z.art,'application/pdf');assert.equal(z.verweis,'docs/'+id);
      assert.equal(z.groesse,datei.data.length);assert.equal(z.sha256,datei.hash);
      assert.match(z.auszug,/Rechnung Nr\. 4711 Musterfirma/);assert.ok(z.auszug.length<=1000);assert.ok(z.datum>1.6e12);
      assert.deepEqual(Object.keys(z).sort(),['art','auszug','datum','groesse','id','name','sha256','verweis']);
      assert.equal(JSON.stringify(fixture.log).includes('passw'),false);
      assert.match(await page.textContent('#nativeTresorordnerHinweis'),/Eingezogen/);
      assert.match(await page.textContent('#nativeTresorordnerZeile'),/verbunden: Tresor-Probe · Einträge im Inhaltsverzeichnis: 1/);
    });
    await t.test('Eingang-WorkflowPDF: neue Datei anderer Pro-Apps steht da, „Übernehmen“ liest sie ein und markiert erst danach',async()=>{
      const pdf=await PDFDocument.create();const f=await pdf.embedFont(StandardFonts.Helvetica);
      for(let i=0;i<3;i++)pdf.addPage([400,500]).drawText('Beleg 4711 von BookLedgerPro, Seite '+(i+1),{x:20,y:400,size:12,font:f});
      const bytes=Buffer.from(await pdf.save());
      fixture.eingang=[{id:'e-4711',name:'Beleg 4711.pdf',art:'application/pdf',datum:Date.now(),groesse:bytes.length,schreiber:'bookledgerpro'},{id:'e-alt',name:'Schon da.pdf',art:'application/pdf',datum:1,groesse:10,schreiber:'bookledgerpro'}];
      fixture.marken=['e-alt'];fixture.eingangDaten.set('e-4711',bytes);fixture.log.length=0;
      await page.evaluate(()=>WFPTresorordner.eingangHinweis());
      await page.waitForSelector('#nativeEingangHinweis');
      assert.match(await page.textContent('#nativeEingangHinweis'),/Neu im Eingang: 1/);
      await page.evaluate(()=>document.querySelectorAll('.dlg-grund').forEach(g=>g.remove()));
      await oeffnen();
      await page.waitForSelector('#nativeTresorEingang [data-eingang-zeile]');
      assert.match(await page.textContent('#nativeTresorEingang'),/Neu im Eingang: 1/);
      assert.equal(await page.locator('#nativeTresorEingang [data-eingang-eintrag]').count(),1,'schon übernommene Einträge stehen nicht da');
      assert.match(await page.textContent('#nativeTresorEingang [data-eingang-eintrag]'),/Beleg 4711\.pdf/);
      assert.equal(await page.locator('#nativeTresorEingang [data-eingang-uebernehmen]').count(),1);
      await page.click('#nativeTresorEingang [data-eingang-uebernehmen]');
      await page.waitForFunction(()=>__wfpdf.S.docs.some(d=>d.name==='Beleg 4711'),null,{timeout:30000});
      await page.waitForFunction(()=>/Übernommen: 1/.test(document.querySelector('#nativeTresorEingang [data-eingang-zeile]')?.textContent||''));
      const reihe=fixture.log.map(([m])=>m);
      assert.ok(reihe.filter(m=>m==='tresorEingangTeil').length>1,'in Stücken gelesen');
      assert.ok(reihe.lastIndexOf('tresorEingangTeil')<reihe.indexOf('tresorEingangMarkieren'),'erst gelesen, dann markiert');
      assert.deepEqual(fixture.marken,['e-alt','e-4711']);
      const doc=await page.evaluate(()=>{const d=__wfpdf.S.docs.find(x=>x.name==='Beleg 4711');return {seiten:d.pages.length,quelle:d.quelle,pruefung:!!d.pruefung};});
      assert.deepEqual(doc,{seiten:3,quelle:'pdf',pruefung:false},'wie eine eingelesene Datei: ungeprüft, Prüfen auf Knopfdruck');
      await page.evaluate(()=>WFPTresorordner.eingangHinweis());
      await page.waitForFunction(()=>!document.getElementById('nativeEingangHinweis'));
      // Das übernommene Dokument gehört jetzt zur Bibliothek: Inhaltsverzeichnis nachziehen (die nächste Probe erwartet „aktuell“)
      await page.evaluate(()=>WFPTresorordner.aktualisieren(true));
    });
    await t.test('„jetzt schreiben“ ohne Änderung meldet aktuell; Sperren zeigt gesperrt',async()=>{
      await knopf(page,'Inhaltsverzeichnis jetzt schreiben').click();
      await page.waitForFunction(()=>/aktuell/.test(document.querySelector('#nativeTresorordnerHinweis')?.textContent||''));
      await knopf(page,'Tresorordner sperren').click();
      await page.waitForFunction(()=>document.querySelector('#nativeTresorordner')?.dataset.zustand==='gesperrt');
      assert.match(await page.textContent('#nativeTresorordnerZeile'),/gesperrt: Tresor-Probe/);
      assert.equal(await knopf(page,'Tresorordner entsperren').count(),1);
      assert.ok(fixture.log.some(([m])=>m==='tresorSperren'));
    });
    await t.test('Hintergrund: verborgen schreibt nur bei offenem, eingezogenem Ordner',async()=>{
      fixture.log.length=0;
      await page.evaluate(()=>WFPTresorordner.aktualisieren(true));
      assert.equal(fixture.log.some(([m])=>m==='tresorVerzeichnis'),false);
      fixture.tresor={...fixture.tresor,offen:true,eingezogen:true,pruefung:'FREMDER_TRESOR'};
      await page.evaluate(()=>WFPTresorordner.aktualisieren(true));
      assert.equal(fixture.log.some(([m])=>m==='tresorVerzeichnis'),false);
      fixture.tresor={...fixture.tresor,pruefung:'PASST'};
      await page.evaluate(()=>WFPTresorordner.aktualisieren(true));
      assert.equal(fixture.log.filter(([m])=>m==='tresorVerzeichnis').length,1);
    });
    await page.close();
    await t.test('ohne Tresorordner-Brücke (z. B. Windows/ältere Hülle) bleibt alles wie bisher',async()=>{
      const alt=await seite(false);
      assert.equal(await alt.evaluate(()=>typeof window.WFPTresorordner),'undefined');
      await alt.close();
    });
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});

// Tablet-Probe 2026-10-28: „Tresorordner sperren“ öffnete sofort wieder, weil zustand() den gemerkten Schlüssel nahm
// (dieselbe Lücke wie BookLedgerPro #382). Die Java-Seite läuft hier nicht; geprüft wird die Regel im Quelltext.
test('Sperren von Hand bleibt gesperrt: zustand() und Inhaltsverzeichnis öffnen nicht mit dem gemerkten Schlüssel',async()=>{
  const java=await readFile(join(root,'android/app/src/main/java/de/familyprojekt/workflowpdf/pro/ProTresorordner.java'),'utf8');
  const plugin=await readFile(join(root,'android/app/src/main/java/de/familyprojekt/workflowpdf/pro/ProVaultPlugin.java'),'utf8');
  assert.match(java,/if \(!vonHandGesperrt\) gemerktEntsperren\(\);/,'zustand() öffnet nach Sperren nicht wieder');
  assert.match(java,/offen == null && \(vonHandGesperrt \|\| !gemerktEntsperren\(\)\)\) throw new IOException\("TRESOR_GESPERRT"\)/,'Hintergrund-Verzeichnis öffnet nicht wieder');
  assert.match(java,/void sperren\(boolean vergessen\) \{\s*schliessen\(\);\s*vonHandGesperrt = true;/,'sperren() merkt sich das');
  assert.match(java,/schliessen\(\);\s*vonHandGesperrt = false;\s*offen = t;/,'Passwort öffnet wieder');
  assert.match(plugin,/tresorWeiter\(PluginCall call,DocumentVault v\)throws Exception\{\s*tresor\.entsperrenGewuenscht\(\);/,'„Entsperren“ von Hand darf den gemerkten Schlüssel nehmen');
  // Pro-Umbau 5: das Eingangsfach liest über offenOderGemerkt() — dieselbe Regel wie das Inhaltsverzeichnis
  assert.match(java,/private TresorOrdner offenOderGemerkt\(\) throws IOException \{\s*if \(offen == null && \(vonHandGesperrt \|\| !gemerktEntsperren\(\)\)\) throw new IOException\("TRESOR_GESPERRT"\);/,'Eingang öffnet nach Sperren nicht wieder');
  assert.equal((java.match(/gemerktEntsperren\(\)/g)||[]).length,4,'keine weitere Stelle, die still entsperrt');
});
