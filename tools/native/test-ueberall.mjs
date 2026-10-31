// „Überall suchen“ und Kopf (Pro-Umbau 12) in Workflow PDF Pro: gemeinsamer Kasten (native/pro-ueberall.js, Quelle Private Brain Pro)
// unter der Bibliothekssuche, diese App = Bibliothek (echte Datenbank des Kerns), Tresorordner = WorkflowVault.tresorFach (gestellt),
// Netz = Modul 23 (gestellt); dazu „A··A“ vor dem Zahnrad und die Version klein neben dem Namen. Läuft gegen das gebaute www/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { chromium } from 'playwright-core';
import { root } from './prepare-web.mjs';

test('Überall suchen und Kopf in Workflow PDF Pro', async t => {
  const base = join(root, 'www');
  const server = createServer(async (req, res) => { try {
    const path = resolve(base, '.' + new URL(req.url, 'http://localhost').pathname); if (path !== base && !path.startsWith(base + '/')) throw Error();
    const file = path === base ? join(path, 'index.html') : path;
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json' })[extname(file)] || 'application/octet-stream'); res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end(); } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.WFP_CHROMIUM || process.env.CB_CHROMIUM || undefined, args: ['--no-sandbox'] });
  try {
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    async function seite({ mitTresor = true, breite = 1280 } = {}) {
      const page = await browser.newPage({ viewport: { width: breite, height: 900 } }), fehler = [];
      page.on('pageerror', e => fehler.push(e.message));
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
      if (mitTresor) await page.addInitScript(() => {
        const faecher = {
          'workflow-pdf-pro': [{ id: 'w0', name: 'Mietvertrag (eigenes Fach)', datum: 1 }],
          'private-brain': [{ id: 'p1', name: 'Mietvertrag Garage.pdf', auszug: 'Mietvertrag Garage Hauptstraße', datum: 4, verschluesselung: 'app' }],
          'bookledgerpro': [{ id: 'b1', name: 'Beleg Miete Oktober', auszug: 'Mietvertrag Büro', datum: 6, verschluesselung: 'fpt1' }]
        };
        window.__tresor = { offen: true, gelesen: [] };
        // Nicht „nativ“: Tresor-Gate und Ablage des Kerns bleiben im Browser-Weg; nur die Brücke zum Tresorordner ist da.
        window.Capacitor = { isNativePlatform: () => false, Plugins: { WorkflowVault: {
          tresorZustand: async () => ({ gewaehlt: true, offen: window.__tresor.offen }),
          tresorFach: async ({ fach }) => { window.__tresor.gelesen.push(fach); return { fach, eintraege: faecher[fach] || [] }; }
        } } };
      });
      await page.goto(url);
      await page.waitForFunction(() => window.WFP?.DB && window.ProUeberall && document.getElementById('wppUeberall'));
      return { page, fehler };
    }
    const gruppen = page => page.evaluate(() => [...document.querySelectorAll('#wppUeberall [data-pro-ue-gruppe]')].map(g => g.dataset.proUeGruppe + ':' + g.querySelectorAll('li').length));
    const { page, fehler } = await seite();
    await t.test('Kasten steht unter der Bibliothekssuche, nutzt deren Feld, Netz ab Werk aus', async () => {
      const r = await page.evaluate(() => { const k = document.getElementById('wppUeberall'), f = document.getElementById('bibForm');
        return { nach: !!(f.compareDocumentPosition(k) & Node.DOCUMENT_POSITION_FOLLOWING), feld: !k.querySelector('input[type=search]'), titel: k.querySelector('h3').textContent,
          haken: [...k.querySelectorAll('[data-pro-ue-quelle]')].map(c => c.dataset.proUeQuelle + '=' + c.checked).join(), infoZu: k.querySelector('[data-pro-info-inhalt]').hidden }; });
      assert.ok(r.nach && r.feld && r.titel === 'Überall suchen' && r.infoZu, JSON.stringify(r));
      assert.equal(r.haken, 'app=true,tresor=true,netz=false');
    });
    await page.evaluate(async () => {
      await WFP.DB.put('docs', { id: 'd1', name: 'Mietvertrag Wohnung', folderId: null, createdAt: '2026-10-01', updatedAt: '2026-10-01', pages: [] });
      await WFP.DB.put('texte', { id: 'd1', seiten: [[['Mietvertrag', 0, 0, 1, 1], ['Lindenweg', 0, 0, 1, 1]]] });
      await WFP.DB.put('docs', { id: 'd2', name: 'Urlaub', folderId: null, createdAt: '2026-07-01', updatedAt: '2026-07-01', pages: [] });
      window.SbkimRendezvous = window.SbkimRendezvous || {}; window.__netz = 0;
      window.SbkimRendezvous.discover = async () => ({ ok: true, cards: [{ nodeName: 'Büro-PC' }] });
      window.SbkimRendezvous.askNode = async () => { window.__netz++; return { ok: true, results: [{ label: 'Mietvertrag Lager', anchorId: 'n1' }] }; };
    });
    await page.fill('#bibSuche', 'Lindenweg Mietvertrag');
    await page.click('#wppUeberall [data-pro-knopf="ueberall-suchen"]');
    await page.waitForFunction(() => /Treffer|Nichts/.test(document.querySelector('#wppUeberall [data-pro-ue-status]').textContent));
    await t.test('Bibliothek: Treffer über den Seitentext (UND über alle Wörter)', async () => assert.equal((await gruppen(page)).join(), 'app:1'));
    await page.fill('#bibSuche', 'Mietvertrag');
    await page.click('#wppUeberall [data-pro-knopf="ueberall-suchen"]');
    await page.waitForFunction(() => document.querySelectorAll('#wppUeberall [data-pro-ue-gruppe]').length >= 2);
    await t.test('Liste mit Herkunft: Bibliothek, Private Brain, BookLedgerPro; eigenes Fach nicht gelesen, Netz nicht gefragt', async () => {
      assert.equal((await gruppen(page)).join(), 'app:1,tresor:private-brain:1,tresor:bookledgerpro:1');
      assert.ok(await page.evaluate(() => !window.__tresor.gelesen.includes('workflow-pdf-pro') && window.__netz === 0));
    });
    await t.test('Fremdes App-Format sagt, wo es sich öffnet; nur Bibliothekszeilen sind Knöpfe', async () => {
      const r = await page.evaluate(() => ({ pb: document.querySelector('[data-pro-ue-gruppe="tresor:private-brain"] .pro-ue-stelle').textContent,
        knopf: document.querySelector('[data-pro-ue-gruppe="app"] .pro-ue-name').tagName, fremd: document.querySelector('[data-pro-ue-gruppe="tresor:bookledgerpro"] .pro-ue-name').tagName }));
      assert.ok(/öffnen in Private Brain Pro/.test(r.pb) && r.knopf === 'BUTTON' && r.fremd === 'SPAN', JSON.stringify(r));
    });
    await page.evaluate(() => { window.__tresor.offen = false; });
    await page.click('#wppUeberall [data-pro-knopf="ueberall-suchen"]');
    await page.waitForFunction(() => /gesperrt/.test(document.querySelector('#wppUeberall [data-pro-ue-status]').textContent));
    await t.test('Tresorordner gesperrt: Bibliothek bleibt, ruhiger Hinweis', async () => assert.equal((await gruppen(page)).join(), 'app:1'));
    await page.evaluate(() => { window.__tresor.offen = true; });
    // Modul 23 lädt der Kern nach (Kette in sbkim-init.js); den Stub erst danach setzen.
    await page.waitForFunction(() => (window.WFP_KETTE || []).every(src => [...document.scripts].some(s => s.src.includes(src))), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(() => { const r = window.SbkimRendezvous || (window.SbkimRendezvous = {});
      r.discover = async () => ({ ok: true, cards: [{ nodeName: 'Büro-PC' }] });
      r.askNode = async () => { window.__netz++; return { ok: true, results: [{ label: 'Mietvertrag Lager', anchorId: 'n1' }] }; }; });
    await page.check('#wppUeberall [data-pro-ue-quelle="netz"]');
    await page.click('#wppUeberall [data-pro-knopf="ueberall-suchen"]');
    await page.waitForFunction(() => document.querySelector('#wppUeberall [data-pro-ue-gruppe="netz"]'));
    await t.test('Mit Haken „Netz“: Modul 23 gefragt, Zeile nennt den Knoten', async () =>
      assert.ok(await page.evaluate(() => window.__netz === 1 && /von Büro-PC/.test(document.querySelector('[data-pro-ue-gruppe="netz"] .pro-ue-stelle').textContent))));
    await t.test('A··A steht vor dem Zahnrad und vergrößert nur die Schrift', async () => {
      const r = await page.evaluate(() => { const a = document.querySelector('header.kopf .pro-schrift'), e = document.getElementById('btnEinst');
        const hoehe = e.getBoundingClientRect().height; ProBedienung.schriftSetzen(130); const groesser = document.documentElement.style.fontSize === '130%'; const hoehe2 = e.getBoundingClientRect().height; ProBedienung.schriftSetzen(100);
        return { vor: !!a && a.nextElementSibling === e, groesser, gleich: Math.abs(hoehe - hoehe2) < 1 }; });
      assert.ok(r.vor && r.groesser && r.gleich, JSON.stringify(r));
    });
    await t.test('Version klein neben dem Namen, sobald die App ihre Nummer kennt', async () => {
      const v = await page.evaluate(() => { document.querySelector('meta[name="wfp-version"]').content = '1.0.10'; document.dispatchEvent(new Event('wfp-version'));
        const b = document.getElementById('wppKopfVersion'); return b && b.textContent + '|' + (b.previousElementSibling?.className || ''); });
      assert.equal(v, 'v1.0.10|marke-name');
    });
    await t.test('Android: Schriftzoom 100 %, Brücke tresorFach liest nur (fachLesen, Sperr-Regel wie beim Eingang)', async () => {
      const main = await readFile(join(root, 'android/app/src/main/java/de/familyprojekt/workflowpdf/pro/MainActivity.java'), 'utf8');
      const tr = await readFile(join(root, 'android/app/src/main/java/de/familyprojekt/workflowpdf/pro/ProTresorordner.java'), 'utf8');
      const pl = await readFile(join(root, 'android/app/src/main/java/de/familyprojekt/workflowpdf/pro/ProVaultPlugin.java'), 'utf8');
      assert.ok(/getSettings\(\)\.setTextZoom\(100\);/.test(main));
      assert.ok(/JSONObject fachLesen\(String slug\) throws Exception \{\s*TresorOrdner t = offenOderGemerkt\(\);\s*Fach\.nachSlug\(slug\);/.test(tr));
      assert.ok(/public void tresorFach\(PluginCall call\)\{work\(call,\(\)->tresor\.fachLesen\(call\.getString\("fach"\)\)\);\}/.test(pl));
    });
    // Pro-Umbau 13: Chefcode (gemeinsamer Baustein pro-chefcode.js) in den Einstellungen, gegen das echte Modul 23 des Kerns.
    await page.click('#btnEinst');
    await page.waitForFunction(() => document.getElementById('wppChefcode') && typeof window.SbkimRendezvous?.saveNetwork === 'function', null, { timeout: 15000 });
    await t.test('Chefcode steht in den Einstellungen unter Sicherung/Tresor, ab Werk öffentliches Netz, ohne Code-Feld (Fassung 2)', async () => {
      const r = await page.evaluate(() => { const k = document.getElementById('wppChefcode'), s = document.getElementById('stSicherung');
        return { nach: !!(s.compareDocumentPosition(k) & Node.DOCUMENT_POSITION_FOLLOWING), titel: k.querySelector('h3').textContent, lage: k.querySelector('[data-pro-cc-lage]').dataset.proCcLage,
          feld: !!k.querySelector('[data-pro-cc-feld]'), chef: !!k.querySelector('[data-pro-knopf="chefcode-chef"]'), zettel: !!k.querySelector('[data-pro-knopf="chefcode-zettel"]') }; });
      assert.ok(r.nach && r.titel === 'Chefcode' && r.lage === 'oeffentlich' && !r.feld && r.chef && r.zettel, JSON.stringify(r));
    });
    const ccWert = (sel, v) => page.$eval('#wppChefcode ' + sel, (f, x) => { f.value = x; }, v);
    const ccTipp = n => page.$eval(`#wppChefcode [data-pro-knopf="${n}"]`, b => b.click());
    await ccTipp('chefcode-chef');
    await page.waitForSelector('#wppChefcode [data-pro-cc-pin2]', { state: 'attached' });
    await ccWert('[data-pro-cc-pin]', '583920'); await ccWert('[data-pro-cc-pin2]', '583920'); await ccWert('[data-pro-cc-feld]', 'WERKSTATT-2026-XQ7');
    await ccTipp('chefcode-uebernehmen');
    await page.waitForFunction(() => document.querySelector('[data-pro-cc-lage]').dataset.proCcLage === 'eigen', null, { timeout: 30000 });
    await t.test('Chef richtet ein (PIN + Code): Modul 23 im eigenen Netz, weder Code noch PIN im Bild', async () => {
      const r = await page.evaluate(() => ({ netz: SbkimRendezvous._meta.network, rolle: document.getElementById('wppChefcode').dataset.proCcRolle, sichtbar: /WERKSTATT-?2026|583920/.test(document.body.innerHTML + document.body.innerText), felder: [...document.querySelectorAll('input')].filter(i => /WERKSTATT|583920/i.test(i.value)).map(i => i.id || i.className).join() }));
      assert.ok(r.netz === 'eigen' && r.rolle === 'chef' && !r.sichtbar && !r.felder, JSON.stringify(r));
    });
    await ccTipp('chefcode-sperren');
    await page.waitForFunction(() => document.getElementById('wppChefcode').dataset.proCcOffen === 'nein');
    await t.test('Gesperrt: kein Code-Feld, kein Entfernen', async () => assert.ok(await page.evaluate(() => !document.querySelector('#wppChefcode [data-pro-cc-feld]') && !document.querySelector('#wppChefcode [data-pro-knopf="chefcode-entfernen"]'))));
    await ccWert('[data-pro-cc-pin]', '583920'); await ccTipp('chefcode-entsperren');
    await page.waitForFunction(() => document.getElementById('wppChefcode').dataset.proCcOffen === 'ja', null, { timeout: 30000 });
    await ccTipp('chefcode-entfernen');
    await page.waitForFunction(() => document.querySelector('[data-pro-cc-lage]').dataset.proCcLage === 'oeffentlich', null, { timeout: 30000 });
    await t.test('Mit Chef-PIN entsperrt → Entfernen: zurück ins öffentliche Netz', async () => assert.equal(await page.evaluate(() => SbkimRendezvous._meta.network), 'oeffentlich'));
    await t.test('Keine Seitenfehler', async () => assert.deepEqual(fehler, []));
    await page.close();
    const B = await seite({ mitTresor: false, breite: 360 });
    await t.test('Ohne Tresor-Brücke (PWA, Windows): kein Haken „Tresorordner“; 360 px ohne Querlauf', async () => {
      const r = await B.page.evaluate(() => { document.querySelector('meta[name="wfp-version"]').content = '1.0.10'; document.dispatchEvent(new Event('wfp-version'));
        return { haken: [...document.querySelectorAll('#wppUeberall [data-pro-ue-quelle]')].map(c => c.dataset.proUeQuelle).join(), breit: document.documentElement.scrollWidth <= innerWidth,
          kopf: (() => { const k = document.querySelector('header.kopf'); return k.scrollWidth <= k.clientWidth + 1; })() }; });
      assert.ok(r.haken === 'app,netz' && r.breit && r.kopf, JSON.stringify(r));
      assert.deepEqual(B.fehler, []);
    });
  } finally { await browser.close(); server.close(); }
});
