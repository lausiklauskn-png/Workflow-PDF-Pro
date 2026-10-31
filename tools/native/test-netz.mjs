// „Im Netz antworten“ (native/native-netz.js, Pro-Umbau 14 A3, Klaus' Antwort 5): echtes Modul 04 des Kerns, Sprachmodell gestellt
// (Wort-Hash, 384 Stellen), Modul 23 auf das Nötige gestellt (kein Relais). Die Datenbank WorkflohPDF1 legt die Probe an wie der Kern
// (Fächer docs und vektoren, Blöcke zu 64 Abschnitten). Geprüft:
//   1 öffentlich: der Korpus trägt nur Dateinamen, nie Seitentext; „Meier“ (nur im Text) wird nicht gefunden, der Dateiname schon
//   2 eigenes Netz + Ausschnitt: ein langer Brief (130 Abschnitte, „Hans Meier“ nur im letzten) wird gefunden, eine Zeile je Dokument,
//     der Ausschnitt zeigt „Meier“, ≤ 200 Zeichen
//   3 ein neues Dokument nach dem Einschalten wird ohne Aus/An gefunden (Korpus als Funktion, nach enableAnswering gesetzt)
//   4 wechselt das Netz auf öffentlich, antwortet der Ausschnitt-Filter nichts
//   5 die Datenbank des Kerns bleibt auf ihrer Version (kein Versionssprung von außen)
// Rückgabe 0 grün · 1 ROT.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(process.env.WURZEL || join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
let gruen = 0, rot = 0;
const ok = (n, c, info) => { if (c) { gruen++; console.log('✓ ' + n); } else { rot++; console.log('✗ ROT: ' + n + (info ? '  — ' + info : '')); } };

const SEITE = `<!doctype html><html lang="de"><head><meta charset="utf-8"></head><body>
<script src="/upstream/workflow-pdf/vendor/sbkim/04_match.js"></script>
<script>
(function () {
  const vec = s => { const v = new Float32Array(384); for (const w of String(s).toLowerCase().normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').match(/[a-z0-9]{3,}/g) || []) {
    let h = 7; for (const c of w) h = (h * 31 + c.charCodeAt(0)) >>> 0; v[h % 384] += 1; } const n = Math.hypot(...v) || 1; for (let i = 0; i < 384; i++) v[i] /= n; return v; };
  window.__vec = vec; window.__eingebettet = [];
  window.SbkimEmbedding = { init: async () => {}, isReady: () => true, embedPassage: async s => { window.__eingebettet.push(s); return vec(s); }, embedQuery: async s => vec(s) };
  const meta = { network: 'eigen', answering: false };
  window.SbkimRendezvous = { _meta: meta, _prep: null, _match: null,
    configure(o) { if ('prepareCorpus' in o) this._prep = o.prepareCorpus; if ('match' in o) this._match = o.match; },
    connectAndAnnounce: async () => ({ ok: true }),
    // wie der Kanon (ensureAnswerCorpus): einmal eine feste Liste aus prepareCorpus ablegen
    enableAnswering: async function () { if (this._prep) window.SbkimMatch.setLocalCorpus(await this._prep()); meta.answering = true; return { ok: true }; },
    disableAnswering() { meta.answering = false; },
    // so beantwortet Modul 23 eine fremde Frage: match = cfg.match || SbkimMatch
    frage: async function (q) { const m = this._match || window.SbkimMatch; return m.queryLocal(q, 5); } };
})();
</script>
<script src="/native/native-netz.js"></script>
</body></html>`;

const server = createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/probe.html') { res.setHeader('Content-Type', 'text/html'); return res.end(SEITE); }
  try { const f = resolve(root, '.' + p); if (!f.startsWith(root)) throw Error(); res.setHeader('Content-Type', ({ '.js': 'text/javascript' })[extname(f)] || 'application/octet-stream'); res.end(await readFile(f)); }
  catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.WFP_CHROMIUM || process.env.CB_CHROMIUM || undefined, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage(), fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  await page.goto('http://127.0.0.1:' + server.address().port + '/probe.html');
  await page.waitForFunction(() => window.WPPNetz && window.SbkimMatch);
  // Datenbank wie der Kern (Version 3, Fächer docs und vektoren; Blöcke zu 64).
  await page.evaluate(async () => {
    const db = await new Promise((ok, no) => { const r = indexedDB.open('WorkflohPDF1', 3); r.onupgradeneeded = () => { for (const n of ['folders', 'docs', 'files', 'texte', 'vektoren']) r.result.createObjectStore(n, { keyPath: 'id' }); }; r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
    const put = (n, v) => new Promise(ok => { const t = db.transaction(n, 'readwrite'); t.objectStore(n).put(v); t.oncomplete = ok; });
    window.__put = put; window.__db = db;
    window.__dok = async (id, name, saetze, createdAt) => {
      await put('docs', { id, name, createdAt, pages: [{}] });
      const st = saetze.map((t, i) => ({ page: 0, text: t, box: null, v: window.__vec(t) }));
      await put('vektoren', { id, sig: 'z2:probe', n: st.length, fertig: st.length });
      for (let b = 0; b * 64 < st.length; b++) await put('vektoren', { id: id + '#' + String(b).padStart(5, '0'), st: st.slice(b * 64, (b + 1) * 64) });
    };
    const fuell = n => Array.from({ length: n }, (_, i) => 'Absatz ' + (i + 1) + ' wir bestätigen den Eingang der Unterlagen und prüfen die Lieferung.');
    await window.__dok('d1', 'Schreiben Lieferung.pdf', ['Sehr geehrte Damen und Herren', ...fuell(128), 'Mit freundlichen Grüßen Hans Meier'], 3);
    for (let i = 1; i <= 8; i++) await window.__dok('r' + i, 'Rechnung ' + i + '.pdf', ['Rechnung Nr. ' + i, ...fuell(5), 'Ihre Buchhaltung'], 2);
    await window.__dok('m1', 'Mietvertrag Garage.pdf', ['Mietvertrag Garage Hauptstraße', ...fuell(3)], 1);
    db.close();
  });
  const frage = q => page.evaluate(q => window.SbkimRendezvous.frage(q), q);
  const version = () => page.evaluate(async () => (await indexedDB.databases()).find(d => d.name === 'WorkflohPDF1').version);

  // 1 öffentlich
  await page.evaluate(() => { window.SbkimRendezvous._meta.network = 'oeffentlich'; });
  let r = await page.evaluate(() => window.WPPNetz.an({ mitAusschnitt: false }));
  ok('Öffentlich: Antworten lässt sich einschalten', r.ok, JSON.stringify(r));
  ok('Öffentlich: Mit Ausschnitt wird außerhalb des eigenen Netzes abgewiesen', !(await page.evaluate(() => window.WPPNetz.an({ mitAusschnitt: true }))).ok);
  r = await page.evaluate(() => window.WPPNetz.an({ mitAusschnitt: false }));
  const eingebettet = await page.evaluate(() => window.__eingebettet.slice());
  ok('Öffentlich: eingebettet werden nur Dateinamen (nie Seitentext)', eingebettet.length > 0 && eingebettet.every(s => /^Dokument · /.test(s) && !/Absatz|Meier|Hauptstraße/.test(s)), JSON.stringify(eingebettet.slice(0, 3)));
  let h = await frage('Mietvertrag Garage');
  ok('Öffentlich: der Dateiname wird gefunden', h.some(x => /Mietvertrag Garage/.test(x.label)), JSON.stringify(h.map(x => x.label)));
  ok('Öffentlich: keine Antwortzeile trägt Seitentext', h.every(x => !/Absatz|Hauptstraße/.test(x.label)));
  h = await frage('freundlichen Grüßen Hans Meier');
  ok('Öffentlich: „Hans Meier“ (nur im Text) findet den Brief nicht', !h.some(x => /Schreiben Lieferung/.test(x.label)), JSON.stringify(h.map(x => x.label)));

  // 2 eigenes Netz mit Ausschnitt
  await page.evaluate(() => { window.SbkimRendezvous._meta.network = 'eigen'; });
  r = await page.evaluate(() => window.WPPNetz.an({ mitAusschnitt: true }));
  ok('Eigenes Netz: mit Ausschnitt eingeschaltet', r.ok && r.mitAusschnitt, JSON.stringify(r));
  const korpusText = await page.evaluate(async () => { const k = await window.WPPNetz.korpusMitAusschnitt((await window.WPPNetz.lesen()).docs, (await window.WPPNetz.lesen()).stuecke); return { n: k.eintraege.filter(e => e.anchorId === 'dok:d1').length, letzter: k.eintraege.filter(e => e.anchorId === 'dok:d1').some(e => /Hans Meier/.test(e.text)), vek: k.eintraege.every(e => e.passageVec instanceof Float32Array) }; });
  ok('Langer Brief: höchstens 60 Abschnitte, das Briefende ist dabei, alle Vektoren Float32Array', korpusText.n <= 60 && korpusText.letzter && korpusText.vek, JSON.stringify(korpusText));
  // Mit dem gestellten Wort-Hash-Modell muss die Frage dem Briefende ähneln (Modul 04 hat eine Mindest-Nähe); gemessen wird die Auswahl.
  h = await frage('freundlichen Grüßen Hans Meier');
  ok('Eigenes Netz: „Hans Meier“ am Briefende findet den Brief', h.length && /Schreiben Lieferung/.test(h[0].label), JSON.stringify(h.map(x => x.label)));
  ok('Eigenes Netz: der Ausschnitt zeigt „Meier“, ≤ 200 Zeichen', h.length && /Meier/.test(h[0].label) && h[0].label.length <= 200, h[0] && h[0].label);
  ok('Eigenes Netz: eine Zeile je Dokument', new Set(h.map(x => x.anchorId)).size === h.length);

  // 3 neues Dokument nach dem Einschalten
  await page.evaluate(async () => {
    const db = await new Promise(ok => { const r = indexedDB.open('WorkflohPDF1'); r.onsuccess = () => ok(r.result); });
    const put = (n, v) => new Promise(ok => { const t = db.transaction(n, 'readwrite'); t.objectStore(n).put(v); t.oncomplete = ok; });
    const t = 'Kaufvertrag Wohnmobil Seeblick'; await put('docs', { id: 'n1', name: 'Neu.pdf', createdAt: 9, pages: [{}] });
    await put('vektoren', { id: 'n1', sig: 'z2:x', n: 1, fertig: 1 }); await put('vektoren', { id: 'n1#00000', st: [{ page: 0, text: t, v: window.__vec(t) }] }); db.close();
  });
  h = await frage('Kaufvertrag Wohnmobil');
  ok('Neues Dokument nach dem Einschalten wird ohne Aus/An gefunden', h.some(x => /Neu/.test(x.label)), JSON.stringify(h.map(x => x.label)));

  // 4 Netz wechselt auf öffentlich: Ausschnitt-Filter schweigt
  await page.evaluate(() => { window.SbkimRendezvous._meta.network = 'oeffentlich'; });
  h = await frage('freundlichen Grüßen Hans Meier');
  ok('Netz auf öffentlich gewechselt: der Ausschnitt-Filter antwortet nichts', h.length === 0, JSON.stringify(h));

  // 5 keine Versionssprünge
  ok('Die Datenbank des Kerns bleibt auf Version 3', (await version()) === 3);
  await page.evaluate(() => window.WPPNetz.aus());
  ok('Aus: Modul 23 antwortet nicht mehr', !(await page.evaluate(() => window.SbkimRendezvous._meta.answering)));
  ok('Keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
} finally { await browser.close(); server.close(); }
console.log(`${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
