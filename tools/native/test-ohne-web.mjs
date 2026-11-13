// Leitfaden § 4 (Klaus 2026-10-28): keine Web-Reste in der Pro-App. Öffnet im App-Modus (Brücke gestellt) jede Ansicht und jeden
// Dialog des Kerns und schlägt an bei sichtbaren Wörtern wie „Browser“, „installieren“, „localStorage“, „dauerhafter Speicher“.
// Dazu: Kasten „Tresor & Ablage“ (Ablage + Tresor, ● Zustand, Pfad + In Dateien öffnen, ein farbiger Knopf) und „Auf Updates prüfen“
// mit Version. Gegenprobe: dieselbe Seite als PWA (ohne Capacitor) zeigt die Browser-Sätze — dort stimmen sie.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {chromium} from 'playwright-core';
import {root} from './prepare-web.mjs';

const WEB=/\b(Browser\w*|browser\w*|installier\w*|Installier\w*|localStorage|Browserdaten|dauerhafte[rn]? Speicher\w*|Dauerhaft speichern|persistent storage|install)\b|браузер\w*|المتصفح/;
test('Pro-App: keine Web-Reste, Tresor & Ablage, Updates mit Version',async t=>{
  const base=join(root,'www');
  const server=createServer(async(req,res)=>{try{
    const path=resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(path!==base&&!path.startsWith(base+'/'))throw Error();
    const file=path===base?join(path,'index.html'):path;
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  const fx={geoeffnet:[],updates:{status:'available',version:'1.0.7',installiert:'1.0.6',tag:'v1.0.7'},laden:0,records:new Map(),batch:null,primary:null,migration:null,unlocked:true,tickets:new Map(),
    tresor:{gewaehlt:true,ordner:'Privat Brain Pro Hauptablageordner',pfad:'Privat Brain Pro Hauptablageordner',speicher:'karte',gemerkt:true,offen:false,eingezogen:false,erreichbar:true,vorhanden:true,pruefung:'PASST'}};
  const key=(store,id)=>JSON.stringify([store,id]);
  const cand=()=>({configured:true,location:'target',id:'vault',folder:'Workflow PDF Pro',pfad:'Privat Brain Pro Hauptablageordner/Workflow PDF Pro',speicher:'karte',unlocked:fx.unlocked,reachable:true,problem:'VAULT_LOCKED'});
  const state=()=>fx.primary?cand():{configured:false,internal:true};
  async function call(method,a={}){
    const view=()=>fx.batch||fx.records;
    if(method==='state')return a.location?cand():state();
    if(method==='migration')return {location:fx.migration};
    if(method==='choose')return {state:cand(),location:'target',created:true};
    if(method==='unlock'){fx.unlocked=true;return {unlocked:true};}
    if(method==='lock'){fx.unlocked=false;return cand();}
    if(method==='prepareMigration'){fx.migration='target';return {saved:true};}
    if(method==='completeMigration'){fx.primary='target';fx.migration=null;return state();}
    if(method==='cancelMigration'){fx.migration=null;return {saved:true};}
    if(method==='beginBatch'){fx.batch=new Map(fx.records);return {started:true};}
    if(method==='abortBatch'){fx.batch=null;return {aborted:true};}
    if(method==='commitBatch'){fx.records=fx.batch;fx.batch=null;return {saved:true};}
    if(method==='begin'){const ticket=randomUUID();fx.tickets.set(ticket,{store:a.store,id:a.id,data:Buffer.alloc(0)});return {ticket};}
    if(method==='append'){const item=fx.tickets.get(a.ticket);item.data=Buffer.concat([item.data,Buffer.from(a.data,'base64')]);return {ok:true};}
    if(method==='finish'){const item=fx.tickets.get(a.ticket);item.hash=createHash('sha256').update(item.data).digest('hex');view().set(key(item.store,item.id),item);fx.tickets.delete(a.ticket);return {saved:true,size:item.data.length,hash:item.hash};}
    if(method==='abort'){fx.tickets.delete(a.ticket);return {};}
    if(method==='info'){const item=view().get(key(a.store,a.id));return item?{exists:true,size:item.data.length,hash:item.hash}:{exists:false};}
    if(method==='read'){const item=view().get(key(a.store,a.id));return {data:item.data.subarray(a.offset,a.offset+262144).toString('base64')};}
    if(method==='list')return {ids:[...view().keys()].map(k=>JSON.parse(k)).filter(k=>k[0]===a.store).map(k=>k[1])};
    if(method==='remove'){view().delete(key(a.store,a.id));return {saved:true};}
    if(method==='recoveryInfo')return {exists:false};
    if(method==='ordnerOeffnen'){fx.geoeffnet.push(a.welcher);return {};}
    if(method==='tresorZustand')return {...fx.tresor};
    if(method==='tresorEinziehen'){fx.tresor={...fx.tresor,offen:true,eingezogen:true,eintraege:0};return {...fx.tresor,eingezogenJetzt:true};}
    if(method==='tresorVerzeichnis')return {geschrieben:true,eintraege:a.zeilen.length};
    if(method==='tresorSperren'){fx.tresor={...fx.tresor,offen:false,eingezogen:false};return {...fx.tresor};}
    if(method==='check'){fx.fragen=(fx.fragen||0)+1;if(fx.ohneNetz)throw Error('UPDATE_UNAVAILABLE');return {...fx.updates};}
    if(method==='openDownload'){fx.laden++;return {};}
    if(method==='install'){fx.installiert=(fx.installiert||0)+1;return fx.installAntwort||{gestartet:true};}
    throw Error('Unknown bridge method '+method);
  }
  const vaultM=['state','migration','choose','unlock','lock','prepareMigration','completeMigration','cancelMigration','beginBatch','abortBatch','commitBatch','begin','append','finish','abort','info','read','list','remove','recoveryInfo','createRecovery','ordnerOeffnen','tresorZustand','tresorEinziehen','tresorVerzeichnis','tresorSperren'];
  async function seite(app,lang='de',breite=1100){
    const page=await browser.newPage({viewport:{width:breite,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('__vaultCall',call);
    await page.addInitScript(([app,names,lang])=>{
      if(lang!=='de')localStorage.setItem('wfpdf_sprache_v1',JSON.stringify({lang}));
      if(!app)return;
      const wrap=list=>Object.fromEntries(list.map(m=>[m,async a=>{try{return await __vaultCall(m,a);}catch(e){throw{code:String(e?.message||e).match(/[A-Z][A-Z_]{3,}/)?.[0]||'UNKNOWN'};}}]));
      const files={};for(const m of ['begin','append','finish','abort','save','share','print','openLink'])files[m]=async()=>({});
      files.appInfo=async()=>({version:'1.0.6'});
      window.Capacitor={isNativePlatform:()=>true,Plugins:{WorkflowFiles:files,WorkflowVault:wrap(names),WorkflowUpdates:wrap(['check','openDownload','install'])}};
    },[app,vaultM,lang]);
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(app=>window.__wfpdf&&window.PDFLib&&(!app||window.WFPNativeVault&&!WFPNativeVault.gate.blocked),app);
    return {page,errors};
  }
  // Sichtbarer Text ohne SBKIM-Fenster, ohne Verborgenes; je Fund das Wort und der Satzanfang.
  const sichtbar=page=>page.evaluate(src=>{const re=new RegExp(src),out=[],w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
    while((n=w.nextNode())){const v=n.nodeValue;if(!re.test(v))continue;const e=n.parentElement;if(!e||e.closest('[id^="sbkim-"],[class^="sbkim-"],[hidden],script,style,[data-m="html"]'))continue;   // HTML-Ausgabe: öffnet sich wirklich im Browser
      const r=e.getBoundingClientRect(),cs=getComputedStyle(e);if(r.width<=1||r.height<=1||cs.visibility==='hidden'||cs.display==='none'||!e.getClientRects().length)continue;
      out.push((v.match(re)||[''])[0]+' «'+v.trim().slice(0,60)+'»');}
    for(const e of document.querySelectorAll('[placeholder]')){const v=e.getAttribute('placeholder');if(re.test(v)&&e.getClientRects().length)out.push('placeholder «'+v+'»');}
    return out;},WEB.source);
  const zu=page=>page.evaluate(()=>{document.querySelectorAll('.dlg-grund').forEach(g=>g.remove());document.querySelectorAll('dialog.native-vault-dialog').forEach(d=>{d.close();d.remove();});});
  async function rundgang(page){
    const funde={};
    const id=await page.evaluate(async()=>{
      const pdf=await PDFLib.PDFDocument.create();const p=pdf.addPage();const f=await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
      p.drawText('Rechnung Nr. 4711 Musterfirma',{x:40,y:700,size:14,font:f});
      const [doc]=await __wfpdf.importDateien([new File([await pdf.save()],'Probe.pdf',{type:'application/pdf'})],null,{still:true});return doc.id;});
    const schritte={
      bibliothek:async()=>{},
      einstellungen:async()=>page.evaluate(()=>__wfpdf.dlg.einstellungen()),
      sicherung:async()=>page.evaluate(()=>__wfpdf.dlg.sicherungDialog()),
      hilfe:async()=>page.evaluate(()=>__wfpdf.dlg.hilfe()),
      bedeutung:async()=>page.evaluate(()=>__wfpdf.bedeutung&&document.querySelector('[data-bed-an], #bedEin')?.click()),
      loeschen:async()=>page.evaluate(id=>{void __wfpdf.dlg.loeschen(id);},id),
      export:async()=>page.evaluate(async id=>{await __wfpdf.oeffneDok(id);__wfpdf.dlg.exportDialog();},id),
      speichern:async()=>page.evaluate(async()=>{await __wfpdf.dlg.speichernDialog();}),
      uebersetzen:async()=>page.evaluate(async id=>{document.querySelector('#edZurueck, [data-zurueck]')?.click();await __wfpdf.dlg.uebersetzenDialog([id]);},id)
    };
    for(const [name,schritt] of Object.entries(schritte)){
      await zu(page);await schritt().catch(e=>{funde[name]=['(Schritt scheiterte: '+e.message+')'];});
      await page.waitForTimeout(500);
      const f=await sichtbar(page);if(f.length)funde[name]=(funde[name]||[]).concat(f);
    }
    await zu(page);
    return funde;
  }
  try{
    browser=await chromium.launch(process.env.WFP_CHROMIUM?{executablePath:process.env.WFP_CHROMIUM}:{});
    await t.test('Gegenprobe: als PWA (ohne App-Brücke) stehen die Browser-Sätze da — dort stimmen sie',async()=>{
      const {page}=await seite(false);const f=await rundgang(page);await page.close();
      assert.ok(Object.keys(f).length>=3,'die Probe sieht nichts: '+JSON.stringify(f));
    });
    for(const lang of ['de','en']){
      await t.test('App ('+lang+'): keine sichtbaren Web-Reste in Bibliothek, Einstellungen, Sicherung, Hilfe, Löschen, Ausgabe, Speichern, Übersetzen',async()=>{
        const {page,errors}=await seite(true,lang);
        const f=await rundgang(page);
        assert.deepEqual(f,{},'noch da: '+JSON.stringify(f,null,1));
        // Kein Hin und Her mit der Sprachschicht des Kerns: offenes Fenster, danach keine DOM-Änderungen mehr.
        await page.evaluate(()=>__wfpdf.dlg.einstellungen());await page.waitForTimeout(600);
        const unruhe=await page.evaluate(()=>new Promise(r=>{let n=0;const m=new MutationObserver(l=>{n+=l.length;});m.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});setTimeout(()=>{m.disconnect();r(n);},1200);}));
        assert.equal(unruhe,0,'DOM ändert sich weiter ('+unruhe+')');
        assert.deepEqual(errors,[]);
        await page.close();
      });
    }
    await t.test('Tresor & Ablage: Kasten, ● Zustand, ganzer Pfad, In Dateien öffnen, ein farbiger Knopf',async()=>{
      const {page,errors}=await seite(true);
      // ohne Ordner: nur Gerätespeicher, „Ordner wählen“ ist der farbige nächste Schritt
      await page.evaluate(()=>__wfpdf.dlg.einstellungen());
      assert.equal(await page.textContent('#stNativeVault'),'Tresor & Ablage');
      assert.match(await page.textContent('#stSpeicher'),/Gerätespeicher/);
      await page.click('#stNativeVault');await page.waitForSelector('.native-vault-dialog');
      assert.equal(await page.textContent('.native-vault-dialog h2'),'Tresor & Ablage');
      assert.equal(await page.textContent('#nativeAblage h3'),'Ablage von Workflow PDF Pro');
      assert.equal(await page.locator('.native-vault-dialog [data-pro-haupt]').count(),1);
      assert.match(await page.textContent('.native-vault-dialog [data-pro-haupt]'),/Ordner wählen/);
      assert.equal(await page.locator('.native-vault-dialog button',{hasText:'Ablage sperren'}).count(),0,'kein Sperren ohne offene Ablage');
      assert.equal(await page.locator('#pro-info-wpp-tresor-ablage-1, [data-pro-info-inhalt="wpp-tresor-ablage"]').first().isHidden(),true,'Erklärung zugeklappt');
      await page.locator('.native-vault-dialog button',{hasText:'Ordner wählen'}).click();
      await page.locator('.native-vault-dialog button',{hasText:'Übernahme starten'}).click();
      await page.waitForFunction(()=>!document.querySelector('.native-vault-dialog')&&window.WFPNativeVault?.aktiv?.());
      await page.waitForFunction(()=>window.WFPNativeVault&&!WFPNativeVault.gate.blocked&&window.__wfpdf);
      await page.evaluate(()=>__wfpdf.dlg.einstellungen());
      assert.equal(await page.textContent('#stSpeicher'),'Ablage von Workflow PDF Pro: SD-Karte/Privat Brain Pro Hauptablageordner/Workflow PDF Pro');
      await page.click('#stNativeVault');await page.waitForSelector('#nativeTresorordner[data-zustand]');
      const ort=await page.evaluate(()=>({a:document.querySelector('#nativeAblageOrt .pro-zustand')?.textContent,ap:document.querySelector('#nativeAblageOrt .pro-pfad')?.textContent,
        h:document.querySelector('#nativeTresorordner h3')?.textContent,t:document.querySelector('#nativeTresorordnerOrt .pro-zustand')?.textContent,tp:document.querySelector('#nativeTresorordnerOrt .pro-pfad')?.textContent,
        haupt:[...document.querySelectorAll('.native-vault-dialog [data-pro-haupt]')].map(b=>b.textContent)}));
      assert.deepEqual(ort,{a:'Entsperrt',ap:'SD-Karte/Privat Brain Pro Hauptablageordner/Workflow PDF Pro',h:'Tresor (alle Pro-Apps)',t:'Gesperrt',tp:'SD-Karte/Privat Brain Pro Hauptablageordner',haupt:['Tresorordner entsperren …']});
      assert.equal(await page.locator('.native-vault-dialog button',{hasText:'Ablage sperren'}).count(),1);
      await page.click('#nativeAblageOrt [data-pro-knopf="in-dateien"]');await page.click('#nativeTresorordnerOrt [data-pro-knopf="in-dateien"]');
      await page.waitForFunction(()=>true);await page.waitForTimeout(200);
      assert.deepEqual(fx.geoeffnet,['ablage','tresor']);
      await page.locator('#nativeTresorordner button',{hasText:'Tresorordner entsperren'}).click();
      await page.waitForFunction(()=>document.querySelector('#nativeTresorordner')?.dataset.zustand==='verbunden');
      assert.equal(await page.textContent('#nativeTresorordnerOrt .pro-zustand'),'Entsperrt');
      assert.equal(await page.locator('.native-vault-dialog [data-pro-haupt]').count(),0,'verbunden: kein farbiger Knopf nötig');
      await page.locator('#nativeTresorordner button',{hasText:'Tresorordner sperren'}).click();
      await page.waitForFunction(()=>document.querySelector('#nativeTresorordner')?.dataset.zustand==='gesperrt');
      assert.equal(await page.locator('#nativeTresorordner button',{hasText:'Tresorordner sperren'}).count(),0,'gesperrt: kein „sperren“');
      assert.deepEqual(errors,[]);
      await page.close();
    });
    // Update-Fähnchen (Klaus 2026-11-13): erscheint von selbst neben der Version, Tipp = vorhandener Weg; aktuell/ohne Netz: nichts.
    const fahne=page=>page.evaluate(()=>{const b=document.getElementById('wppUpdateFahne'),v=document.getElementById('wppKopfVersion');
      if(!b)return null;const r=b.getBoundingClientRect();
      return {text:b.textContent,vor:b.previousElementSibling?.id||'',sichtbar:r.width>1&&r.height>1,titel:b.title,version:v?getComputedStyle(v).display:'',
        kurz:getComputedStyle(b.querySelector('.wpp-fahne-kurz')).display,lang:getComputedStyle(b.querySelector('.wpp-fahne-lang')).display};});
    const gefragt=(page,n)=>page.waitForFunction(()=>true).then(async()=>{const bis=Date.now()+15000;while((fx.fragen||0)<n){if(Date.now()>bis)throw Error('stille Prüfung blieb aus: '+(fx.fragen||0)+' von '+n);await page.waitForTimeout(100);}});
    await t.test('Update-Fähnchen: erscheint ohne Tipp neben der Version; Tipp lädt direkt (nicht die Einstellungen)',async()=>{
      fx.updates={status:'available',version:'1.0.7',installiert:'1.0.6',tag:'v1.0.7',apk:'Workflow-PDF-Pro-1.0.7.apk',groesse:1000};fx.fragen=0;fx.ohneNetz=false;fx.laden=0;fx.installiert=0;fx.installAntwort=null;
      const {page,errors}=await seite(true);
      await page.waitForSelector('#wppUpdateFahne',{timeout:15000});
      const f=await fahne(page);
      assert.deepEqual({text:f.text,vor:f.vor,sichtbar:f.sichtbar,version:f.version!=='none',lang:f.lang!=='none',kurz:f.kurz},{text:'↑Update 1.0.7',vor:'wppKopfVersion',sichtbar:true,version:true,lang:true,kurz:'none'});
      assert.match(f.titel,/Update 1\.0\.7 steht bereit/);
      assert.equal(fx.fragen,1,'genau eine stille Anfrage beim Start');
      assert.equal(await page.locator('.dlg-grund').count(),0,'die stille Prüfung öffnet nichts');
      // Zurückholen innerhalb der Stunde: keine zweite Anfrage.
      await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForTimeout(400);
      assert.equal(fx.fragen,1,'höchstens stündlich');
      await page.click('#wppUpdateFahne');
      await page.waitForFunction(()=>true);const bis=Date.now()+5000;while(fx.installiert<1&&Date.now()<bis)await page.waitForTimeout(50);
      assert.equal(fx.installiert,1,'Tipp aufs Fähnchen lädt und installiert direkt');
      assert.equal(await page.locator('#stUpdatesKasten').count(),0,'die Einstellungen gehen nicht auf');
      assert.equal(fx.fragen,1,'kein zweites Fragen, das Ergebnis der stillen Prüfung gilt');
      // Tipp auf die Versionsnummer: derselbe Weg.
      await page.click('#wppKopfVersion');const bis2=Date.now()+5000;while(fx.installiert<2&&Date.now()<bis2)await page.waitForTimeout(50);
      assert.equal(fx.installiert,2,'Tipp auf die Version lädt ebenfalls direkt');
      assert.equal(await page.locator('#stUpdatesKasten').count(),0,'auch die Version öffnet die Einstellungen nicht');
      // Ohne Erlaubnis „Apps installieren“: kurze Meldung.
      fx.installAntwort={erlaubnis:true};await page.click('#wppUpdateFahne');
      await page.waitForFunction(()=>/Apps installieren/.test(document.getElementById('wppUpdateMeldung')?.textContent||''));
      assert.deepEqual(errors,[]);await page.close();fx.installAntwort=null;
    });
    await t.test('Versionsnummer bei aktueller Fassung: kurze Meldung, keine Einstellungen, kein Laden',async()=>{
      fx.updates={status:'current',version:'1.0.6',installiert:'1.0.6'};fx.fragen=0;fx.installiert=0;fx.laden=0;
      const {page,errors}=await seite(true);
      await gefragt(page,1);await page.waitForTimeout(300);
      await page.click('#wppKopfVersion');
      await page.waitForFunction(()=>/Aktuelle Version 1\.0\.6/.test(document.getElementById('wppUpdateMeldung')?.textContent||''));
      assert.equal(await page.locator('#stUpdatesKasten').count(),0,'die Einstellungen gehen nicht auf');
      assert.equal(fx.installiert+fx.laden,0,'nichts geladen');
      assert.deepEqual(errors,[]);await page.close();
    });
    await t.test('Update-Fähnchen: aktuelle Fassung und ohne Netz – kein Fähnchen, keine Meldung; nach einer Stunde neu gefragt',async()=>{
      fx.updates={status:'current',version:'1.0.6',installiert:'1.0.6'};fx.fragen=0;fx.ohneNetz=false;
      const {page,errors}=await seite(true);
      await gefragt(page,1);await page.waitForTimeout(300);
      assert.equal(await fahne(page),null,'aktuell: kein Fähnchen');
      assert.equal(await page.locator('.dlg-grund, .toast.an, #stUpdatesStand, #windowsUpdates').count(),0,'aktuell: keine Meldung');
      // Eine Stunde später (gemerkte Zeit zurückgestellt) steht ein Update bereit: Zurückholen fragt neu und zeigt es.
      fx.updates={status:'available',version:'1.0.8',installiert:'1.0.6',tag:'v1.0.8'};
      await page.evaluate(()=>{const g=JSON.parse(localStorage.getItem('wpp_update_still_v1'));g.zeit-=61*60*1000;localStorage.setItem('wpp_update_still_v1',JSON.stringify(g));document.dispatchEvent(new Event('visibilitychange'));});
      await page.waitForSelector('#wppUpdateFahne[data-update="1.0.8"]',{timeout:15000});assert.equal(fx.fragen,2);
      // Dieselbe Fassung wie die laufende App (nach dem Update): Fähnchen weg.
      await page.evaluate(()=>{document.querySelector('meta[name="wfp-version"]').content='1.0.8';document.dispatchEvent(new Event('wfp-version'));});
      assert.equal(await fahne(page),null,'nach dem Update ist das Fähnchen weg');
      assert.deepEqual(errors,[]);await page.close();
      fx.fragen=0;fx.ohneNetz=true;
      const o=await seite(true);
      await gefragt(o.page,1);await o.page.waitForTimeout(300);
      assert.equal(await fahne(o.page),null,'ohne Netz: kein Fähnchen');
      assert.equal(await o.page.locator('.dlg-grund, .toast.an, #stUpdatesStand, #windowsUpdates').count(),0,'ohne Netz: keine Meldung');
      assert.deepEqual(o.errors,[]);await o.page.close();fx.ohneNetz=false;
    });
    await t.test('Update-Fähnchen: schmal (360 px) steht es kurz an Stelle der Version, der Kopf wird nicht höher',async()=>{
      fx.updates={status:'current',version:'1.0.6',installiert:'1.0.6'};fx.fragen=0;
      const a=await seite(true,'de',360);await gefragt(a.page,1);await a.page.waitForTimeout(300);
      const ohne=await a.page.evaluate(()=>({h:document.querySelector('header.kopf').getBoundingClientRect().height,quer:document.documentElement.scrollWidth-innerWidth}));await a.page.close();
      fx.updates={status:'available',version:'1.0.7',installiert:'1.0.6',tag:'v1.0.7'};
      const b=await seite(true,'de',360);await b.page.waitForSelector('#wppUpdateFahne',{timeout:15000});
      const mit=await b.page.evaluate(()=>({h:document.querySelector('header.kopf').getBoundingClientRect().height,quer:document.documentElement.scrollWidth-innerWidth}));
      const f=await fahne(b.page);
      assert.deepEqual({version:f.version,lang:f.lang,kurz:f.kurz!=='none',sichtbar:f.sichtbar},{version:'none',lang:'none',kurz:true,sichtbar:true});
      assert.ok(mit.h<=ohne.h+0.5&&mit.quer<=Math.max(0,ohne.quer),JSON.stringify({ohne,mit}));
      assert.deepEqual(b.errors,[]);await b.page.close();
    });
    await t.test('Auf Updates prüfen nennt die Version (neu und aktuell); Herunterladen öffnet die Seite',async()=>{
      fx.updates={status:'available',version:'1.0.7',installiert:'1.0.6',tag:'v1.0.7'};fx.laden=0;
      const {page,errors}=await seite(true);
      await page.evaluate(()=>__wfpdf.dlg.einstellungen());
      await page.click('#stUpdates');
      await page.waitForFunction(()=>/Neu: 1\.0\.7 \(du hast 1\.0\.6\)/.test(document.getElementById('stUpdatesStand')?.textContent||''));
      assert.match(await page.getAttribute('#stUpdatesLaden','data-pro-haupt')??'x',/^$/);
      await page.click('#stUpdatesLaden');assert.equal(fx.laden,1);
      fx.updates={status:'current',version:'1.0.6',installiert:'1.0.6'};
      await page.click('#stUpdates');
      await page.waitForFunction(()=>/Du verwendest die aktuelle Version 1\.0\.6\./.test(document.getElementById('stUpdatesStand')?.textContent||''));
      assert.equal(await page.locator('#stUpdatesLaden').count(),0);
      assert.deepEqual(errors,[]);
      await page.close();
    });
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
