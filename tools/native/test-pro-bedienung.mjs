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
ok('Kein Netz, kein fremder Speicher außer dem ⓘ-Merker und der Schriftgröße', !/fetch\(|XMLHttpRequest|WebSocket|indexedDB/.test(js) && (js.match(/localStorage\./g) || []).length === 4);

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

  // ---------- Schriftgröße „A··A“ (Leitfaden § 1.8): Regler 85–150 %, gemerkt, Knöpfe bleiben gleich hoch ----------
  await page.evaluate(() => { document.documentElement.lang = 'de'; localStorage.removeItem('pro_schrift_v1'); document.documentElement.style.fontSize = ''; delete document.documentElement.dataset.proSchrift; });
  const s1 = await page.evaluate(() => {
    const P = window.ProBedienung, kopf = document.createElement('header'); kopf.style.cssText = 'display:flex;justify-content:flex-end';
    const a = P.schriftKnopf(); kopf.append(a); document.body.prepend(kopf);
    const probe = P.knopf('Probe'); document.body.append(probe); const p = document.createElement('p'); p.style.fontSize = '1rem'; p.textContent = 'Text'; document.body.append(p);
    const vorher = { text: parseFloat(getComputedStyle(p).fontSize), knopf: probe.getBoundingClientRect().height };
    a.querySelector('[data-pro-schrift-knopf]').click();
    const feld = a.querySelector('.pro-schrift-feld'), offen = !feld.hidden;
    const r = feld.querySelector('input[type=range]'); r.value = '130'; r.dispatchEvent(new Event('input'));
    const nachher = { text: parseFloat(getComputedStyle(p).fontSize), knopf: probe.getBoundingClientRect().height, zahl: feld.querySelector('.pro-schrift-zahl').textContent };
    const box = feld.getBoundingClientRect();
    return { knopfText: a.querySelector('[data-pro-schrift-knopf]').textContent, offen, vorher, nachher, gemerkt: localStorage.getItem('pro_schrift_v1'), imBild: box.left >= 0 && box.right <= innerWidth };
  });
  ok('A··A öffnet den Regler, ganz im Bild', s1.knopfText === 'A··A' && s1.offen && s1.imBild);
  ok('Regler 130 %: Schrift wächst, Knopf bleibt gleich hoch, Zahl und Merker stimmen', Math.abs(s1.nachher.text - s1.vorher.text * 1.3) < 0.6 && Math.abs(s1.nachher.knopf - s1.vorher.knopf) < 0.5 && s1.nachher.zahl === '130 %' && s1.gemerkt === '130');
  await page.reload(); await page.addScriptTag({ content: js });
  ok('Nach Neuladen gilt die gemerkte Größe sofort', await page.evaluate(() => document.documentElement.style.fontSize === '130%' && document.documentElement.dataset.proSchrift === '130'));
  ok('„Zurück auf 100 %“ und Grenzen 85–150', await page.evaluate(() => { const P = ProBedienung; const a = P.schriftKnopf(); document.body.append(a); a.querySelector('[data-pro-schrift-knopf]').click();
    a.querySelector('[data-pro-knopf="schrift-100"]').click(); const zurueck = document.documentElement.style.fontSize === '' && localStorage.getItem('pro_schrift_v1') === '100';
    return zurueck && P.schriftSetzen(300) === 150 && P.schriftSetzen(10) === 85 && P.schriftSetzen('x') === 100; }));
  await page.evaluate(() => { localStorage.removeItem('pro_schrift_v1'); document.documentElement.style.fontSize = ''; });

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

  // ---------- Überall suchen (pro-ueberall.js/.css, Fassung 4): Liste mit Herkunft aus App, Tresorordner und Netz ----------
  const ujs = readFileSync(resolve(dir, 'pro-ueberall.js'), 'utf8'), ucss = readFileSync(resolve(dir, 'pro-ueberall.css'), 'utf8');
  ok('Überall suchen: Fassung ≥ 4 pinnt beide Dateien', pin.fassung >= 4 && pin.dateien?.['pro-ueberall.js'] === sha(ujs) && pin.dateien?.['pro-ueberall.css'] === sha(ucss));
  ok('Überall suchen: kein eigenes Netz, kein fremder Speicher, keine Emojis, Text nur über textContent',
    !/fetch\(|XMLHttpRequest|WebSocket|indexedDB|innerHTML/.test(ujs) && (ujs.match(/localStorage\./g) || []).length === 2 && !/\p{Extended_Pictographic}/u.test(ujs + ucss));
  ok('Überall suchen: Farben nur aus --pro-* (Design der jeweiligen App)', !/#[0-9a-f]{3,6}\b|rgb\(/i.test(ucss));
  const ue = await browser.newPage({ viewport: { width: 360, height: 760 } }); const ueFehler = []; ue.on('pageerror', e => ueFehler.push(e.message));
  await ue.route('https://pro-bedienung.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="de"><head><style>' + css + ucss + '</style></head><body><main id="m"></main></body></html>' }));
  await ue.goto('https://pro-bedienung.test/'); await ue.evaluate(() => localStorage.clear());
  await ue.addScriptTag({ content: js }); await ue.addScriptTag({ content: ujs });
  const u = await ue.evaluate(async () => {
    const U = window.ProUeberall;
    const logik = {
      norm: U.normalisieren('Bürobedarf 3.9.2026, Straße'), woerter: U.suchwoerter('Büro büro a'),
      liste: U.listeSuchen([{ id: 1, t: 'Rechnung Bürobedarf März' }, { id: 2, t: 'Urlaub' }], 'buro rechnung', { text: e => e.t, name: e => e.t, id: e => e.id }),
      tresor: U.tresorSuchen([{ fach: 'workflow-pdf-pro', eintraege: [{ id: 'a', name: 'Scan Mietvertrag.pdf', auszug: 'Mietvertrag Wohnung', datum: 1, verschluesselung: 'app' }, { id: 'b', name: 'Rezept', datum: 2 }] },
        { fach: 'private-brain', eintraege: [{ id: 'c', name: 'Mietvertrag alt', datum: 3 }] }, { fach: 'fremd', eintraege: [{ id: 'd', name: 'Mietvertrag' }] }], 'mietvertrag', { ohne: ['private-brain'] }),
      gruppen: U.gruppieren([{ herkunft: 'netz', typ: 'knoten' }, { herkunft: 'tresor', typ: 'eingang-workflowpdf' }, { herkunft: 'app' }, { herkunft: 'tresor', typ: 'workflow-pdf-pro' }]).map(g => g.schluessel),
      netzZeilen: U.netzZeilen([{ ok: true, nodeName: 'Büro-PC', results: [{ label: 'Rechnung 12', anchorId: 'x' }, { label: '' }] }, { ok: false }])
    };
    // Gestellte Brücke zum Tresorordner und gestelltes Modul 23.
    const faecher = { 'workflow-pdf-pro': [{ id: 'w1', name: 'Scan Mietvertrag.pdf', auszug: 'Mietvertrag Wohnung Hauptstraße', datum: 5, verschluesselung: 'fpt1' }],
      'bookledgerpro': [{ id: 'b1', name: 'Beleg Mietvertrag Garage', auszug: '', datum: 9, verschluesselung: 'app' }], 'private-brain': [{ id: 'p1', name: 'Mietvertrag (eigenes Fach)', datum: 1 }] };
    let offen = false, netzGefragt = 0;
    const bruecke = { zustand: async () => ({ gewaehlt: true, offen }), fach: async f => ({ eintraege: faecher[f] || [] }) };
    const rdv = { discover: async () => ({ ok: true, cards: [{ nodeName: 'Büro-PC' }] }), askNode: async (c, q) => { netzGefragt++; return { ok: true, bestaetigt: false, results: [{ label: 'Mietvertrag Lager · 2025', anchorId: 'n1' }] }; } };
    const geoeffnet = [];
    const k = U.kasten({ appName: 'Private Brain Pro', app: f => U.listeSuchen([{ id: 'k1', name: 'Mietvertrag Wohnung.pdf' }], f, { text: e => e.name, name: e => e.name, id: e => e.id }),
      tresor: () => bruecke, tresorOhne: ['private-brain'], netz: () => rdv, oeffnen: z => geoeffnet.push(z.herkunft + ':' + z.id) });
    document.getElementById('m').append(k.element);
    const haupt = k.element.querySelectorAll('.pro-knopf[data-pro-haupt]').length;
    const infoZu = k.element.querySelector('[data-pro-info-inhalt="ueberall"]').hidden;
    const quellen = [...k.element.querySelectorAll('[data-pro-ue-quelle]')].map(c => c.dataset.proUeQuelle + '=' + c.checked);
    k.eingabe.value = 'Mietvertrag';
    await k.suchen();
    const gesperrt = { status: k.element.querySelector('[data-pro-ue-status]').textContent, gruppen: [...k.element.querySelectorAll('[data-pro-ue-gruppe]')].map(g => g.dataset.proUeGruppe) };
    offen = true; await k.suchen();
    const offenErg = { gruppen: [...k.element.querySelectorAll('[data-pro-ue-gruppe]')].map(g => g.dataset.proUeGruppe + ':' + g.querySelectorAll('li').length),
      titel: [...k.element.querySelectorAll('.pro-ue-gruppe-titel')].map(h => h.textContent), stellen: [...k.element.querySelectorAll('.pro-ue-stelle')].map(s => s.textContent), netzGefragt };
    k.element.querySelector('[data-pro-ue-quelle="netz"]').click();
    await k.suchen();
    const mitNetz = { netzGruppe: !!k.element.querySelector('[data-pro-ue-gruppe="netz"] li'), netzName: k.element.querySelector('[data-pro-ue-gruppe="netz"] .pro-ue-name')?.tagName,
      netzStelle: k.element.querySelector('[data-pro-ue-gruppe="netz"] .pro-ue-stelle')?.textContent, info: k.element.querySelector('[data-pro-ue-netzinfo]')?.textContent, netzGefragt,
      gemerkt: JSON.parse(localStorage.getItem('pro_ueberall_quellen_v1')).netz };
    k.element.querySelector('[data-pro-ue-gruppe="app"] button.pro-ue-name').click();
    k.eingabe.value = 'a'; await k.suchen();
    const kurz = k.element.querySelector('[data-pro-ue-status]').textContent;
    return { logik, haupt, infoZu, quellen, gesperrt, offenErg, mitNetz, geoeffnet, kurz, breit: document.documentElement.scrollWidth <= innerWidth };
  });
  ok('Wortsuche: Umlaute gefaltet, Daten als JJJJMMTT, Wörter entdoppelt (≥ 2 Zeichen)', u.logik.norm === 'burobedarf 20260903 strasse' && u.logik.woerter.join() === 'buro');
  ok('Wortsuche über eine App-Liste: UND über alle Wörter, Fundstelle um das Wort', u.logik.liste.length === 1 && u.logik.liste[0].id === '1' && /Bürobedarf/.test(u.logik.liste[0].stelle));
  ok('Tresorordner: eigenes und unbekanntes Fach bleiben draußen, neueste zuerst', u.logik.tresor.length === 1 && u.logik.tresor[0].id === 'a' && u.logik.tresor[0].typ === 'workflow-pdf-pro' && u.logik.tresor[0].oeffenbar === false);
  ok('Gruppen in fester Reihenfolge: App, Fächer (wie FAECHER), Netz', u.logik.gruppen.join() === 'app,tresor:workflow-pdf-pro,tresor:eingang-workflowpdf,netz');
  ok('Netz-Antworten: nur Zeilen mit Titel, Knoten genannt', u.logik.netzZeilen.length === 1 && u.logik.netzZeilen[0].knoten === 'Büro-PC');
  ok('Kasten: ⓘ zu, genau ein farbiger Knopf, Netz ab Werk aus', u.infoZu && u.haupt === 1 && u.quellen.join() === 'app=true,tresor=true,netz=false');
  ok('Tresorordner gesperrt: App-Treffer da, ruhiger Hinweis statt Fehler', u.gesperrt.gruppen.join() === 'app' && /Tresorordner gesperrt/.test(u.gesperrt.status) && /1 Treffer/.test(u.gesperrt.status));
  ok('Tresorordner offen: Fächer der anderen Pro-Apps mit Herkunft, eigenes Fach nicht doppelt', u.offenErg.gruppen.join() === 'app:1,tresor:workflow-pdf-pro:1,tresor:bookledgerpro:1'
    && u.offenErg.titel.join('|') === 'Private Brain Pro · 1|Tresorordner · Workflow PDF Pro · 1|Tresorordner · BookLedgerPro · 1');
  ok('Fremdes App-Format sagt „nur im Inhaltsverzeichnis – öffnen in …“', u.offenErg.stellen.some(s => /öffnen in BookLedgerPro/.test(s)) && !u.offenErg.stellen.some(s => /öffnen in Workflow PDF Pro/.test(s)));
  ok('Ohne Haken wird das Netz nie gefragt', u.offenErg.netzGefragt === 0);
  ok('Mit Haken: Netz gefragt, Zeile ohne Öffnen-Knopf, Knoten und „nicht bestätigt“ genannt, Haken gemerkt',
    u.mitNetz.netzGruppe && u.mitNetz.netzName === 'SPAN' && /von Büro-PC · nicht bestätigt/.test(u.mitNetz.netzStelle) && /1 Arbeitsplätze gefragt, 1 Zeilen/.test(u.mitNetz.info) && u.mitNetz.netzGefragt === 1 && u.mitNetz.gemerkt === true);
  ok('Tipp auf eine Zeile ruft das Öffnen der App', u.geoeffnet.join() === 'app:k1');
  ok('Zu kurzes Suchwort: Hinweis, keine Suche', /mindestens zwei Zeichen/.test(u.kurz));
  ok('Überall suchen: nichts läuft bei 360 px quer hinaus, keine Seitenfehler', u.breit && ueFehler.length === 0);
  await ue.evaluate(() => { document.documentElement.lang = 'en'; });
  ok('Überall suchen spricht nach <html lang> (EN)', await ue.evaluate(() => ProUeberall.wort('titel') === 'Search everywhere'));
} finally { await browser.close(); }
console.log(count + ' Proben der gemeinsamen Bausteine (Bedienung, Hintergrund, Gerät, Überall suchen) bestanden.');
