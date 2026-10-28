#!/usr/bin/env node
// Gemeinsame Bausteine der Pro-Apps (Bedienung native/pro-bedienung.js/.css und seit Fassung 2 die Hintergrundaufgabe
// native/pro-hintergrund.js + android/…/de/familyprojekt/hintergrund/*.java) byte-gleich aus Private Brain Pro übernehmen.
// Gepflegt werden sie dort (Klaus 2026-10-28); hier NIE von Hand ändern. Derselbe Satz steht in Workflow PDF Pro und BookLedgerPro.
// Welche Dateien dazugehören, sagt der Pin der Quelle (`pfade`); ältere Pins ohne `pfade` heißen die zwei Bedien-Dateien.
//   node tools/native/bedienung-nachziehen.mjs --quelle ../privat-brain-pro   kopieren + Herkunft pinnen
//   node tools/native/bedienung-nachziehen.mjs                                 prüfen (Rückgabe 1 bei Abweichung)
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ALT = ['native/pro-bedienung.js', 'native/pro-bedienung.css'];
const PROBE = 'tools/native/test-pro-bedienung.mjs';
const herkunftDatei = join(root, 'native/pro-bedienung-herkunft.json');
const sha = b => createHash('sha256').update(b).digest('hex');
const pfadeVon = pin => Array.isArray(pin?.pfade) && pin.pfade.length ? pin.pfade : ALT;

export function pruefen() {
  if (!existsSync(herkunftDatei)) return ['native/pro-bedienung-herkunft.json fehlt'];
  const h = JSON.parse(readFileSync(herkunftDatei, 'utf8')), fehler = [];
  for (const p of pfadeVon(h)) {
    const name = p.split('/').pop();
    if (!existsSync(join(root, p))) { fehler.push('fehlt: ' + p); continue; }
    if (sha(readFileSync(join(root, p))) !== h.dateien?.[name]) fehler.push('von Hand geändert: ' + p);
  }
  if (h.probe && (!existsSync(join(root, PROBE)) || sha(readFileSync(join(root, PROBE))) !== h.probe)) fehler.push('Probe weicht ab: ' + PROBE);
  return fehler;
}

const direkt = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
const i = direkt ? process.argv.indexOf('--quelle') : -1;
if (i > 0) {
  const quelle = process.argv[i + 1];
  const pin = JSON.parse(readFileSync(join(quelle, 'native/pro-bedienung-herkunft.json'), 'utf8'));
  const pfade = pfadeVon(pin);
  const sauber = execFileSync('git', ['-C', quelle, 'status', '--porcelain', '--', ...pfade, 'native/pro-bedienung-herkunft.json', PROBE]).toString().trim() === '';
  if (!sauber) { console.error('Quelle hat ungesicherte Änderungen an den Bausteinen — erst dort committen.'); process.exit(1); }
  for (const p of pfade) {
    const b = readFileSync(join(quelle, p));
    if (sha(b) !== pin.dateien[p.split('/').pop()]) { console.error('Quelle weicht von ihrem Pin ab: ' + p); process.exit(1); }
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), b);
  }
  const probe = readFileSync(join(quelle, PROBE)); writeFileSync(join(root, PROBE), probe);
  const commit = execFileSync('git', ['-C', quelle, 'rev-parse', 'HEAD']).toString().trim();
  writeFileSync(herkunftDatei, JSON.stringify({ ...pin, commit, probe: sha(probe) }, null, 2) + '\n');
  console.log(`übernommen: Pro-Bausteine (Fassung ${pin.fassung}, ${pfade.length} Dateien) aus ${commit.slice(0, 7)}`);
}
if (direkt) {
  const f = pruefen();
  if (f.length) { console.error('ROT:\n' + f.join('\n')); process.exit(1); }
  console.log('Pro-Bausteine byte-gleich mit der Herkunft (Private Brain Pro).');
}
