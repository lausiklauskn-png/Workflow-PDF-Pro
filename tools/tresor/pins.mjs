#!/usr/bin/env node
// Pins des gemeinsamen Pakets de.familyprojekt.tresor (Quelle: dieses Repo).
//   node tools/tresor/pins.mjs            prüft (Rückgabe 1 bei Abweichung)
//   node tools/tresor/pins.mjs --schreiben schreibt tools/tresor/tresor-pins.json neu
// Prüft außerdem: VaultCrypto im gemeinsamen Paket ist bis auf die package-Zeile byte-gleich
// mit dem VaultCrypto der App (PBV1 bleibt ein Schloss).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const paket = 'android/app/src/main/java/de/familyprojekt/tresor';
const probe = 'android/app/src/test/java/de/familyprojekt/tresor';
const appCrypto = 'android/app/src/main/java/de/familyprojekt/workflowpdf/pro/VaultCrypto.java';
const pinsDatei = join(repo, 'tools/tresor/tresor-pins.json');
const sha = b => createHash('sha256').update(b).digest('hex');
const rumpf = text => text.slice(text.indexOf('\n') + 1);

const dateien = {};
for (const ordner of [paket, probe])
  for (const n of readdirSync(join(repo, ordner)).sort()) if (n.endsWith('.java')) dateien[`${ordner}/${n}`] = sha(readFileSync(join(repo, ordner, n)));
const vc = readFileSync(join(repo, paket, 'VaultCrypto.java'), 'utf8');
const stand = {
  format: 'familyprojekt-tresor-pins', version: 1, paket: 'de.familyprojekt.tresor', ordnerFormat: 'familyprojekt-tresorordner/1',
  vaultCryptoRumpf: sha(rumpf(vc)), dateien,
};
const fehler = [];
if (!vc.startsWith('package de.familyprojekt.tresor;\n')) fehler.push('VaultCrypto: package-Zeile');
if (sha(rumpf(readFileSync(join(repo, appCrypto), 'utf8'))) !== stand.vaultCryptoRumpf) fehler.push('VaultCrypto weicht vom App-VaultCrypto ab (PBV1)');
if (process.argv.includes('--schreiben')) {
  if (fehler.length) { console.error(fehler.join('\n')); process.exit(1); }
  writeFileSync(pinsDatei, JSON.stringify(stand, null, 2) + '\n');
  console.log(`geschrieben: ${Object.keys(dateien).length} Dateien`);
  process.exit(0);
}
const pins = JSON.parse(readFileSync(pinsDatei, 'utf8'));
for (const [p, h] of Object.entries(pins.dateien)) if (dateien[p] !== h) fehler.push(`geändert oder fehlt: ${p}`);
for (const p of Object.keys(dateien)) if (!(p in pins.dateien)) fehler.push(`nicht gepinnt: ${p}`);
if (pins.vaultCryptoRumpf !== stand.vaultCryptoRumpf) fehler.push('VaultCrypto-Rumpf weicht vom Pin ab');
if (fehler.length) { console.error('ROT:\n' + fehler.join('\n') + '\nGewollte Änderung? node tools/tresor/pins.mjs --schreiben'); process.exit(1); }
console.log(`Tresor-Paket gepinnt und gleich: ${Object.keys(dateien).length} Dateien, VaultCrypto-Rumpf ${stand.vaultCryptoRumpf.slice(0, 12)}…`);
