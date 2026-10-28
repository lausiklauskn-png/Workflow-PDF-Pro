#!/usr/bin/env node
// Scanner-Baustein der Pro-Apps (Pro-Umbau 5): hier in Workflow PDF Pro gepflegt, byte-gleich nach BookLedgerPro
// (dort tools/native/scanner-nachziehen.mjs --quelle ../Workflow-PDF-Pro). Nach jeder Änderung: --schreiben.
//   node tools/native/scanner-pins.mjs            prüfen (Rückgabe 1 bei Abweichung)
//   node tools/native/scanner-pins.mjs --schreiben Pins neu setzen
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PFADE = ['native/pro-scanner.js', 'native/pro-scanner.css', 'windows/scanner/scanner.rs', 'windows/scanner/wia.ps1', 'windows/scanner/test-wia.mjs', 'tools/native/test-pro-scanner.mjs'];
const PIN = join(root, 'native/pro-scanner-herkunft.json');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const jetzt = () => Object.fromEntries(PFADE.map((p) => [p, sha(readFileSync(join(root, p)))]));
if (process.argv.includes('--schreiben')) {
  writeFileSync(PIN, JSON.stringify({ _: 'Scanner und Kamera der Pro-Apps unter Windows. Quelle: Workflow PDF Pro. In Kopien nie von Hand ändern.', quelle: 'lausiklauskn-png/Workflow-PDF-Pro', fassung: 1, pfade: PFADE, dateien: jetzt() }, null, 2) + '\n');
  console.log('Pins geschrieben: ' + PFADE.length + ' Dateien');
}
const pin = existsSync(PIN) ? JSON.parse(readFileSync(PIN, 'utf8')) : null;
const fehler = !pin ? ['native/pro-scanner-herkunft.json fehlt'] : PFADE.filter((p) => pin.dateien[p] !== jetzt()[p]).map((p) => 'weicht vom Pin ab: ' + p);
if (fehler.length) { console.error('ROT:\n' + fehler.join('\n')); process.exit(1); }
console.log('Scanner-Baustein stimmt mit seinem Pin überein.');
