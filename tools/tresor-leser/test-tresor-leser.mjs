// Probe des Tresor-Lesers (Klaus 2026-11-04): ein echter Testtresor, gebaut mit dem Paket de.familyprojekt.tresor (javac/java),
// wird im Browser über die Ordnerwahl geöffnet – wie von einer SD-Karte, Seite als file://.
// Geprüft: Ordner finden (auch eine Ebene höher), falsches Passwort, Liste je Fach, Ansehen/Herunterladen byte-gleich (auch über
// drei PBV1-Blöcke), „app“-Zeilen nur als Zeile, ein gekippter Bit wird erkannt, der Tresor bleibt byte-gleich.
// Braucht javac/java und Chromium (WFP_CHROMIUM). Nicht geprüft: echte SD-Karte, Handy-Browser (Ordnerwahl fehlt dort oft).
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readdirSync,readFileSync,writeFileSync,statSync,rmSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';

const hier=dirname(fileURLToPath(import.meta.url)),repo=resolve(hier,'../..');
const paket=join(repo,'android/app/src/main/java/de/familyprojekt/tresor');
const PW='Test-Passwort-fuer-den-Leser';
const sha=b=>createHash('sha256').update(b).digest('hex');
function abdruck(ordner){const out={};const lauf=(d,p)=>{for(const n of readdirSync(d).sort()){const f=join(d,n),r=p?p+'/'+n:n;if(statSync(f).isDirectory())lauf(f,r);else out[r]=sha(readFileSync(f));}};lauf(ordner,'');return out;}

test('Tresor-Leser öffnet einen echten Testtresor nur lesend',async t=>{
  const arbeit=mkdtempSync(join(tmpdir(),'tresor-leser-')),klassen=join(arbeit,'klassen'),sd=join(arbeit,'SD-Karte'),tresor=join(sd,'Family-Projekt'),klar=join(arbeit,'klar');
  mkdirSync(klassen);mkdirSync(tresor,{recursive:true});
  let browser;
  try{
    const quellen=readdirSync(paket).filter(n=>n.endsWith('.java')&&n!=='SafAblage.java').map(n=>join(paket,n));
    execFileSync('javac',['-encoding','UTF-8','-d',klassen,...quellen,join(hier,'Testtresor.java')],{stdio:'pipe'});
    execFileSync('java',['-cp',klassen,'Testtresor',tresor,PW,klar],{stdio:'pipe'});
    writeFileSync(join(sd,'Urlaub.jpg'),'kein Tresor');
    const vorher=abdruck(sd);

    browser=await chromium.launch(process.env.WFP_CHROMIUM?{executablePath:process.env.WFP_CHROMIUM}:{});
    const ctx=await browser.newContext({acceptDownloads:true,locale:'de-DE'}),page=await ctx.newPage(),fehler=[],netz=[];
    page.on('pageerror',e=>fehler.push(e.message));page.on('request',r=>{if(!/^(file|blob|data):/.test(r.url()))netz.push(r.url());});
    let alerts=[];page.on('dialog',d=>{alerts.push(d.message());d.dismiss();});
    await page.goto(pathToFileURL(join(hier,'tresor-leser.html')).href);

    await t.test('falscher Ordner: klare Meldung',async()=>{
      const leer=join(arbeit,'leer');mkdirSync(leer);writeFileSync(join(leer,'a.txt'),'x');
      await page.setInputFiles('#ordner',leer);
      assert.match(await page.locator('#ordnerStatus').innerText(),/kein „tresorordner\.json“/);
      assert.ok(await page.locator('#schritt2').isHidden());
    });
    await t.test('Ordner eine Ebene höher (die SD-Karte) wird angenommen',async()=>{
      await page.setInputFiles('#ordner',sd);
      assert.match(await page.locator('#ordnerStatus').innerText(),/Tresor gefunden: Family-Projekt/);
    });
    await t.test('falsches Passwort: Meldung, nichts offen',async()=>{
      await page.fill('#pw','ganz-falsches-Passwort');await page.click('#oeffnen');
      await page.waitForFunction(()=>/Passwort falsch/.test(document.getElementById('pwStatus').textContent),null,{timeout:60000});
      assert.ok(await page.locator('#schritt3').isHidden());
      assert.equal(await page.inputValue('#pw'),'','Passwortfeld wird geleert');
    });
    await t.test('richtiges Passwort: drei Fächer mit ihren Einträgen',async()=>{
      await page.fill('#pw',PW);await page.click('#oeffnen');
      await page.waitForSelector('#faecher [data-fach]',{timeout:60000});
      await page.waitForFunction(()=>document.querySelectorAll('#faecher tr[data-eintrag]').length===4);
      const faecher=await page.$$eval('#faecher [data-fach]',e=>e.map(x=>x.dataset.fach));
      assert.deepEqual(faecher,['private-brain','workflow-pdf-pro','familienakte']);
      const wpp=await page.locator('[data-fach="workflow-pdf-pro"]').innerText();
      assert.match(wpp,/Lange Notiz\.txt/);assert.match(wpp,/Rechnung Muster 2026\.pdf/);assert.match(wpp,/Rechnung Nr\. 42, erfunden/);
      const pb=await page.locator('[data-fach="private-brain"]').innerText();
      assert.match(pb,/Mail von Muster GmbH/);assert.match(pb,/nur in der App/);
      assert.equal(await page.locator('[data-fach="private-brain"] button').count(),0,'„app“-Zeile ohne Ansehen/Herunterladen');
    });
    await t.test('Ansehen: Text über drei Blöcke byte-gleich, Bild als Bild',async()=>{
      const zeile=page.locator('tr',{hasText:'Lange Notiz.txt'});
      await zeile.locator('[data-tun=ansehen]').click();
      await page.waitForSelector('#ansicht pre',{timeout:60000});
      const text=await page.locator('#ansicht pre').textContent();
      assert.equal(sha(Buffer.from(text,'utf8')),sha(readFileSync(join(klar,'Lange Notiz.txt'))));
      assert.ok(readFileSync(join(klar,'Lange Notiz.txt')).length>2*256*1024,'Probe hat wirklich mehrere Blöcke');
      await page.locator('tr',{hasText:'Punkt.png'}).locator('[data-tun=ansehen]').click();
      await page.waitForSelector('#ansicht img');
      assert.ok(await page.locator('#ansicht img').evaluate(i=>i.complete&&i.naturalWidth===1));
    });
    await t.test('Herunterladen: PDF byte-gleich mit dem Original',async()=>{
      const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('tr',{hasText:'Rechnung Muster 2026.pdf'}).locator('[data-tun=laden]').click()]);
      assert.equal(dl.suggestedFilename(),'Rechnung Muster 2026.pdf');
      assert.equal(sha(readFileSync(await dl.path())),sha(readFileSync(join(klar,'Rechnung Muster 2026.pdf'))));
    });
    await t.test('Sperren verwirft alles Entschlüsselte',async()=>{
      await page.click('#sperren');
      assert.ok(await page.locator('#schritt3').isHidden());assert.ok(await page.locator('#ansichtKasten').isHidden());
      assert.equal(await page.locator('#faecher tr').count(),0);
    });
    await t.test('nichts geht ins Netz, keine Seitenfehler, Tresor byte-gleich',async()=>{
      assert.deepEqual(netz,[]);assert.deepEqual(fehler,[]);
      assert.deepEqual(abdruck(sd),vorher);
    });
    await t.test('ein gekippter Bit in einer Datei wird erkannt',async()=>{
      const fach=join(tresor,'Workflow PDF Pro/Notizen'),datei=join(fach,readdirSync(fach).find(n=>n.endsWith('.fpt')));
      const b=readFileSync(datei);b[b.length-100]^=1;writeFileSync(datei,b);
      await page.reload();await page.setInputFiles('#ordner',sd);
      await page.fill('#pw',PW);await page.click('#oeffnen');
      await page.waitForFunction(()=>document.querySelectorAll('#faecher tr[data-eintrag]').length===4,null,{timeout:60000});
      alerts=[];
      await page.locator('tr',{hasText:'Lange Notiz.txt'}).locator('[data-tun=ansehen]').click();
      await page.waitForFunction(()=>!document.querySelector('tr[data-eintrag] button:disabled'));
      await page.waitForTimeout(200);
      assert.equal(alerts.length,1);assert.match(alerts[0],/beschädigt/);
      assert.ok(await page.locator('#ansichtKasten').isHidden());
    });
    await t.test('Englisch',async()=>{
      await page.click('#sprache');
      assert.equal(await page.locator('#s1t').innerText(),'1. Choose the vault folder');
      await page.waitForFunction(()=>/in the app only/.test(document.querySelector('[data-fach="private-brain"]')?.textContent||''));
    });
    await t.test('fremder Prüfwert im Kopf: „beschädigt“, nicht offen',async()=>{
      const kopf=join(tresor,'tresorordner.json'),k=JSON.parse(readFileSync(kopf,'utf8'));
      k.pruefung=(k.pruefung[0]==='0'?'1':'0')+k.pruefung.slice(1);writeFileSync(kopf,JSON.stringify(k));
      await page.reload();await page.setInputFiles('#ordner',sd);
      await page.fill('#pw',PW);await page.click('#oeffnen');
      await page.waitForFunction(()=>/beschädigt/.test(document.getElementById('pwStatus').textContent),null,{timeout:60000});
      assert.ok(await page.locator('#schritt3').isHidden());
    });
  }finally{await browser?.close();rmSync(arbeit,{recursive:true,force:true});}
});
