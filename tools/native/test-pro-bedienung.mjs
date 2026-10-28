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
} finally { await browser.close(); }
console.log(count + ' Proben der gemeinsamen Bedien-Bausteine bestanden.');
