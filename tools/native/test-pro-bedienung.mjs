// Probe der gemeinsamen Bedien-Bausteine (native/pro-bedienung.js/.css), Quelle für alle Pro-Apps.
// Läuft gleich in jeder App, die die Dateien byte-gleich trägt: Pfad der Dateien über PRO_BEDIENUNG_DIR (Vorgabe native/).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const dir = resolve(process.env.PRO_BEDIENUNG_DIR || 'native');
const js = readFileSync(resolve(dir, 'pro-bedienung.js'), 'utf8'), css = readFileSync(resolve(dir, 'pro-bedienung.css'), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
let count = 0; const ok = (name, value) => { assert.ok(value, name); console.log('✓ ' + name); count++; };

const pinPfad = resolve(dir, 'pro-bedienung-herkunft.json');
ok('Pin vorhanden', existsSync(pinPfad));
const pin = JSON.parse(readFileSync(pinPfad, 'utf8'));
ok('Dateien byte-gleich mit dem Pin (nie von Hand ändern; Quelle Private Brain Pro)', pin.dateien?.['pro-bedienung.js'] === sha(js) && pin.dateien?.['pro-bedienung.css'] === sha(css));
// Fassung 2: auch die Hintergrundaufgabe (JS-Hülle + Android-Dienst) gehört zum gepinnten Satz.
const wurzel = resolve(dir, '..');
const hjs = readFileSync(resolve(dir, 'pro-hintergrund.js'), 'utf8');
ok('Fassung ≥ 2 nennt alle Bausteine samt Android-Dienst', pin.fassung >= 2 && ['pro-hintergrund.js', 'ProHintergrundPlugin.java', 'ProHintergrundDienst.java'].every(n => pin.dateien?.[n]));
ok('Jeder Baustein byte-gleich mit dem Pin', (pin.pfade || []).length === Object.keys(pin.dateien || {}).length && pin.pfade.every(p => existsSync(resolve(wurzel, p)) && sha(readFileSync(resolve(wurzel, p))) === pin.dateien[p.split('/').pop()]));
const javaDienst = readFileSync(resolve(wurzel, 'android/app/src/main/java/de/familyprojekt/hintergrund/ProHintergrundDienst.java'), 'utf8');
const javaPlugin = readFileSync(resolve(wurzel, 'android/app/src/main/java/de/familyprojekt/hintergrund/ProHintergrundPlugin.java'), 'utf8');
ok('Dienst: Vordergrund „dataSync“, Abbrechen in der Mitteilung, hält bei 6-h-Grenze und beim Wegwischen an', /FOREGROUND_SERVICE_TYPE_DATA_SYNC/.test(javaDienst) && /addAction\(/.test(javaDienst) && /onTimeout\(int startId, int fgsType\)/.test(javaDienst) && /onTaskRemoved/.test(javaDienst));
ok('Plugin ruft nie stopService (vor startForeground beendete Android die App)', !/stopService\(/.test(javaPlugin) && /setRendererPriorityPolicy\(WebView\.RENDERER_PRIORITY_IMPORTANT, !hoch\)/.test(javaPlugin));
ok('Keine Emojis, kein Netz in der Hintergrund-Hülle', !/\p{Extended_Pictographic}/u.test(hjs + javaDienst + javaPlugin) && !/fetch\(|XMLHttpRequest|WebSocket|indexedDB|localStorage/.test(hjs));
ok('Keine Emojis in den gemeinsamen Dateien (Strichgrafiken)', !/\p{Extended_Pictographic}/u.test(js + css));
ok('Kein Netz, kein fremder Speicher außer dem ⓘ-Merker', !/fetch\(|XMLHttpRequest|WebSocket|indexedDB/.test(js) && (js.match(/localStorage\./g) || []).length === 2);

const browser = await chromium.launch({ executablePath: process.env.CB_CHROMIUM || process.env.WFP_CHROMIUM || undefined, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 700 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // Echte Adresse statt about:blank: dort gibt es keinen localStorage, das Merken wäre nicht messbar.
  await page.route('https://pro-bedienung.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="de"><head><style>' + css + '</style></head><body><main id="m"></main></body></html>' }));
  await page.goto('https://pro-bedienung.test/');
  await page.addScriptTag({ content: js });
  const r = await page.evaluate(() => {
    const P = window.ProBedienung, m = document.getElementById('m');
    const k = P.kasten('tresor', 'Tresor & Ablage', { erklaerung: 'Der Tresor umschließt die Ablagen aller Pro-Apps. Ein Passwort für alle.' });
    m.append(k.element);
    const a = P.knopf('Entsperren', { haupt: true, name: 'a' }), b = P.knopf('Anderer Ordner', { name: 'b' });
    const reihe = document.createElement('div'); reihe.className = 'pro-knoepfe'; reihe.append(a, b); k.rumpf.append(P.ordnerZeile('SD-Karte/Privat Brain Pro Hauptablageordner', () => {}), P.zustand(false), reihe);
    const f = P.fortschritt(k.rumpf, { text: 'Einzug' });
    return {
      infoZu: k.info.inhalt.hidden, ariaZu: k.info.knopf.getAttribute('aria-expanded'),
      haupt: k.element.querySelectorAll('.pro-knopf[data-pro-haupt]').length,
      hoehe: a.getBoundingClientRect().height, farbig: getComputedStyle(a).backgroundColor !== getComputedStyle(b).backgroundColor,
      zustand: k.element.querySelector('.pro-zustand').textContent,
      oeffnen: k.element.querySelector('[data-pro-knopf="in-dateien"]')?.textContent,
      laeuft: f.element.textContent.includes('du kannst weiterarbeiten'),
      breit: document.documentElement.scrollWidth <= innerWidth
    };
  });
  ok('ⓘ ist anfangs zugeklappt (Leitfaden § 1.2)', r.infoZu && r.ariaZu === 'false');
  ok('Genau ein farbiger Knopf (der nächste Schritt)', r.haupt === 1 && r.farbig);
  ok('Knopf flach: 28–34 px hoch', r.hoehe >= 28 && r.hoehe <= 34);
  ok('Zustand sagt ● Gesperrt', r.zustand === 'Gesperrt');
  ok('Ordnerzeile mit „In Dateien öffnen“', r.oeffnen === 'In Dateien öffnen');
  ok('Fortschritt sagt „läuft – du kannst weiterarbeiten“', r.laeuft);
  ok('Nichts läuft bei 360 px quer hinaus', r.breit);

  await page.click('[data-pro-info="tresor"]');
  ok('ⓘ öffnet per Tipp', await page.evaluate(() => !document.querySelector('[data-pro-info-inhalt="tresor"]').hidden));
  await page.reload(); await page.addScriptTag({ content: js });
  ok('Offen/zu wird gemerkt (auch nach Neuladen)', await page.evaluate(() => { const i = ProBedienung.info('tresor', 'x'); return i.inhalt.hidden === false; }));

  const z = await page.evaluate(() => {
    const P = window.ProBedienung, host = document.body;
    const f = P.fortschritt(host); f.schritt(3, 10); const mitte = [f.element.querySelector('.pro-balken').hidden, f.element.querySelector('.pro-balken-fuell').style.width, f.element.querySelector('.pro-fortschritt-text').textContent];
    f.fertig(); const ende = [f.element.dataset.proFortschritt, f.element.querySelector('.pro-fortschritt-text').textContent];
    const g = P.fortschritt(host); g.abgebrochen();
    const box = document.createElement('div'); const x = P.knopf('x', { haupt: true }), y = P.knopf('y'); box.append(x, y); P.hauptSetzen(box, y);
    return { mitte, ende, ab: g.element.querySelector('.pro-fortschritt-text').textContent, wechsel: !('proHaupt' in x.dataset) && 'proHaupt' in y.dataset,
      versAkt: P.versionSatz('1.0.41', '1.0.41'), versNeu: P.versionSatz('1.0.41', '1.0.42'),
      schl: [P.istOeffentlicherSchluessel('A'.repeat(64)), P.istOeffentlicherSchluessel('PB1-xyz'), P.istOeffentlicherSchluessel('a'.repeat(64), ['b'.repeat(64)])] };
  });
  ok('Balken mit Zahl: „Schritt 3 von 10“, 30 %', z.mitte[0] === false && parseFloat(z.mitte[1]) === 30 && z.mitte[2] === 'Schritt 3 von 10');
  ok('Ende: Fertig / Abgebrochen', z.ende[0] === 'fertig' && z.ende[1] === 'Fertig' && z.ab === 'Abgebrochen');
  ok('hauptSetzen: der neue farbige Knopf nimmt dem alten die Farbe', z.wechsel);
  ok('Version: „aktuell“ ohne neue, „Neu: … (du hast …)“ mit neuer', z.versAkt === 'Du verwendest die aktuelle Version 1.0.41.' && z.versNeu === 'Neu: 1.0.42 (du hast 1.0.41)');
  ok('Öffentlicher Schlüssel wird erkannt, Code nicht', z.schl[0] === true && z.schl[1] === false && z.schl[2] === false);

  await page.evaluate(() => { document.documentElement.lang = 'en'; });
  ok('Spricht nach <html lang> (EN)', await page.evaluate(() => ProBedienung.zustand(true).textContent === 'Unlocked' && ProBedienung.schritt(1, 2) === 'Step 1 of 2'));
  await page.evaluate(() => { document.documentElement.lang = 'xx'; });
  ok('Unbekannte Sprache fällt auf Deutsch', await page.evaluate(() => ProBedienung.zustand(true).textContent === 'Entsperrt'));
  ok('Keine Seitenfehler', errors.length === 0);

  // ---------- Hintergrundaufgabe: ohne Brücke läuft die Arbeit einfach, mit gestellter Brücke wie in der App ----------
  const leer = pg => pg.route('https://pro-bedienung.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="de"><body></body></html>' }));
  const ohne = await browser.newPage(); await leer(ohne); await ohne.goto('https://pro-bedienung.test/'); await ohne.addScriptTag({ content: hjs });
  ok('Ohne Android-Brücke: Arbeit läuft, nichts behauptet (geschuetzt false)', await ohne.evaluate(async () => {
    let lief = false; const r = await ProHintergrund.lauf({ art: 'sichern', titel: 'x' }, async a => { lief = true; a.stand('1 von 2', 1, 2); return a.geschuetzt; });
    return lief && r === false && ProHintergrund.verfuegbar() === false && ProHintergrund.aktiv() === 0;
  }));
  const mit = await browser.newPage(); await leer(mit); await mit.goto('https://pro-bedienung.test/');
  await mit.evaluate(() => {
    const log = window.__log = [];
    let hoerer = null;
    window.Capacitor = { isNativePlatform: () => true, Plugins: { ProHintergrund: {
      aufraeumen: async () => { log.push(['aufraeumen']); },
      erlauben: async () => { log.push(['erlauben']); return { mitteilung: true }; },
      beginnen: async o => { log.push(['beginnen', o.id, o.titel]); return { geschuetzt: true }; },
      stand: async o => { log.push(['stand', o.text, o.i, o.n]); },
      ende: async o => { log.push(['ende', o.id]); },
      addListener: (name, fn) => { hoerer = fn; log.push(['hoert', name]); return { remove() {} }; }
    } } };
    window.__abbruch = id => hoerer({ id, grund: 'mitteilung' });
  });
  await mit.addScriptTag({ content: hjs });
  const h = await mit.evaluate(async () => {
    // Playwright zählt evaluate als Tipp: „kein Tipp“ hier ausdrücklich nachstellen (wie ein Start aus einer Schleife).
    const echt = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userActivation');
    Object.defineProperty(navigator, 'userActivation', { configurable: true, get: () => ({ isActive: false }) });
    const a = await ProHintergrund.beginnen({ art: 'pruefen', titel: 'Prüfen läuft' });
    for (let i = 1; i <= 5; i++) a.stand(i + ' von 5', i, 5);       // schnell hintereinander: höchstens einmal je Sekunde
    const sofort = __log.filter(e => e[0] === 'stand').length;
    await new Promise(r => setTimeout(r, 1200));
    const spaeter = __log.filter(e => e[0] === 'stand');
    window.__abbruch(a.id); const abgebrochen = a.signal.aborted && a.grund === 'mitteilung';
    a.ende(); a.ende();
    const zweite = await ProHintergrund.lauf({ art: 'sichern', titel: 'Sicherung läuft' }, async () => { throw new Error('kaputt'); }).catch(e => e.message);
    delete navigator.userActivation; if (echt) Object.defineProperty(Navigator.prototype, 'userActivation', echt);
    return { log: __log, sofort, spaeter, abgebrochen, zweite, geschuetzt: a.geschuetzt, aktiv: ProHintergrund.aktiv() };
  });
  ok('Beim Laden räumt die Seite alte Aufgaben ab (Neuladen meldet kein Ende)', h.log[0][0] === 'aufraeumen');
  ok('Ohne Tipp keine Frage nach der Mitteilung; beginnen mit Titel', h.log.filter(e => e[0] === 'erlauben').length === 0 && h.log.some(e => e[0] === 'beginnen' && e[2] === 'Prüfen läuft') && h.geschuetzt === true);
  await mit.evaluate(() => { const b = document.createElement('button'); b.id = 'los'; b.textContent = 'los'; b.onclick = () => { window.__p = ProHintergrund.beginnen({ art: 'einordnen', titel: 'y' }).then(a => a.ende()); }; document.body.append(b); });
  await mit.click('#los'); await mit.evaluate(() => window.__p);
  await mit.click('#los'); await mit.evaluate(() => window.__p);
  ok('Aus einem Tipp: genau einmal nach der Mitteilung gefragt', await mit.evaluate(() => __log.filter(e => e[0] === 'erlauben').length === 1));
  ok('Stand gedrosselt: sofort einer, danach der letzte („5 von 5“)', h.sofort === 1 && h.spaeter.length === 2 && h.spaeter[1][1] === '5 von 5' && h.spaeter[1][2] === 5);
  ok('„Abbrechen“ in der Mitteilung bricht die Aufgabe ab (signal)', h.abgebrochen);
  ok('ende genau einmal; lauf meldet ende auch bei Fehler', h.log.filter(e => e[0] === 'ende').length === 2 && h.zweite === 'kaputt' && h.aktiv === 0);

  // ---------- Gerätecheck (pro-geraet.js): Stufe und Urteil aus gestellten Messwerten, Nachfrage bei „nicht empfohlen“ ----------
  const gjs = readFileSync(resolve(dir, 'pro-geraet.js'), 'utf8');
  ok('Gerätecheck: kein Netz, keine Emojis, nur eigener Merker', !/fetch\(|XMLHttpRequest|WebSocket|indexedDB/.test(gjs) && !/\p{Extended_Pictographic}/u.test(gjs) && (gjs.match(/localStorage\./g) || []).length === 2);
  const geraet = async (mess) => { const pg = await browser.newPage(); await leer(pg); await pg.goto('https://pro-bedienung.test/');
    await pg.evaluate(m => { window.__mess = 0; window.Capacitor = { isNativePlatform: () => true, Plugins: { ProDevice: { measure: async () => { __mess++; return m; } } } }; }, mess);
    await pg.addScriptTag({ content: gjs }); return pg; };
  const stark = await geraet({ platform: 'windows', ramBytes: 32 * 2 ** 30, cores: 16, cpu: 'Testprozessor', gpu: [{ name: 'Testgrafik', vramBytes: 8 * 2 ** 30 }], freeBytes: 200 * 2 ** 30 });
  const g1 = await stark.evaluate(async () => { const m = await ProGeraet.messen(); const v = await ProGeraet.vorDemLaden('bedeutung', { fragen: () => { throw new Error('darf nicht fragen'); } });
    const zweite = await ProGeraet.messen(); return { stufe: m.stufe, quelle: m.quelle, ram: m.ramGB, gpu: m.gpu[0], satz: v.satz, weiter: v.weiter, bild: ProGeraet.urteil(m, 'bild').stand, ki: ProGeraet.urteil(m, 'kiGross').stand, gemerkt: __mess === 1 && zweite.zeit === m.zeit }; });
  ok('Starker Rechner (32 GB, 16 Kerne, 8 GB Grafik): Stufe Groß, Bedeutungssuche und Bildbeschreibung passen', g1.stufe === 'gross' && g1.quelle === 'windows' && g1.ram === 32 && g1.weiter && g1.bild === 'passt');
  ok('Satz nennt Werte, Stufe, Modell und Urteil', /32 GB Arbeitsspeicher/.test(g1.satz) && /16 Kerne/.test(g1.satz) && /Testgrafik \(8 GB\)/.test(g1.satz) && /Stufe Groß/.test(g1.satz) && /e5-small/.test(g1.satz) && /passt\.$/.test(g1.satz));
  ok('Noch nicht Gebautes heißt so (lokale KI: „geplant“), und die Messung wird gemerkt', g1.ki === 'geplant' && g1.gemerkt);
  const schwach = await geraet({ platform: 'android', ramBytes: 2 * 2 ** 30, cores: 4, freeBytes: 20 * 2 ** 30, gpu: [] });
  const g2 = await schwach.evaluate(async () => { let gefragt = ''; const v = await ProGeraet.vorDemLaden('bild', { fragen: t => { gefragt = t; return false; } });
    const m = v.messung; return { stufe: m.stufe, weiter: v.weiter, gefragt, bed: ProGeraet.urteil(m, 'bedeutung').stand }; });
  ok('Schwaches Gerät (2 GB): Stufe Klein, Bildbeschreibung „nicht empfohlen“ fragt nach, Nein hält an', g2.stufe === 'klein' && g2.weiter === false && /nicht empfohlen/.test(g2.gefragt) && /Trotzdem laden\?/.test(g2.gefragt));
  ok('… die Bedeutungssuche (klein) bleibt dort erlaubt', g2.bed !== 'nein');
  const voll = await geraet({ platform: 'windows', ramBytes: 16 * 2 ** 30, cores: 8, freeBytes: 0.1 * 2 ** 30, gpu: [] });
  ok('Kein Platz: „nicht empfohlen“ trotz starker Werte', await voll.evaluate(async () => ProGeraet.urteil(await ProGeraet.messen(), 'bedeutung').stand === 'nein'));
  const ohneB = await browser.newPage(); await leer(ohneB); await ohneB.goto('https://pro-bedienung.test/'); await ohneB.addScriptTag({ content: gjs });
  ok('Ohne Brücke (PWA): misst im Browser, sagt „Stufe“ nie „Groß“ ohne Speicherwert', await ohneB.evaluate(async () => { const m = await ProGeraet.messen({ neu: true }); return m.quelle === 'browser' && m.probeMs >= 0 && (m.ramGB == null) && m.stufe !== 'gross'; }));
} finally { await browser.close(); }
console.log(count + ' Proben der gemeinsamen Bausteine (Bedienung + Hintergrund) bestanden.');
