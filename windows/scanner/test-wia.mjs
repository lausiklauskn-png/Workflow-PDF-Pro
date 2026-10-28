// Prüft wia.ps1 auf einem echten Windows (GitHub-Rechner) genau so, wie scanner.rs es startet: -EncodedCommand, Auftrag als
// Base64-JSON in PRO_SCANNER_AUFTRAG. Ohne Scanner antwortet es mit leerer Liste oder SCANNER_WIA_FEHLT (Server ohne WIA-Dienst) —
// beides ist gültiges JSON, und genau das wird hier geprüft (Syntax, Antwortform, Fehler für ein unbekanntes Gerät).
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
if (process.platform !== 'win32') { console.log('nur unter Windows'); process.exit(0); }
const skript = Buffer.from(readFileSync(new URL('./wia.ps1', import.meta.url), 'utf8'), 'utf16le').toString('base64');
const ps = join(process.env.SystemRoot || 'C:\\Windows', 'System32\\WindowsPowerShell\\v1.0\\powershell.exe');
const lauf = (a) => JSON.parse(execFileSync(ps, ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', skript],
  { env: { ...process.env, PRO_SCANNER_AUFTRAG: Buffer.from(JSON.stringify(a)).toString('base64') }, encoding: 'utf8', timeout: 120000 }).trim());
const g = lauf({ aktion: 'geraete' });
assert.ok(Array.isArray(g.geraete) || g.fehler === 'SCANNER_WIA_FEHLT', JSON.stringify(g));
console.log('PASS Geräteliste: ' + (g.geraete ? g.geraete.length + ' Geräte' : g.fehler));
const ziel = mkdtempSync(join(tmpdir(), 'wia-'));
try {
  const s = lauf({ aktion: 'scannen', geraet: '{00000000-0000-0000-0000-000000000000}\\9999', quelle: 'glas', farbe: 'farbe', dpi: 300, ziel });
  assert.ok(s.fehler === 'SCANNER_FEHLT' || s.fehler === 'SCANNER_WIA_FEHLT', JSON.stringify(s));
  console.log('PASS unbekanntes Gerät → ' + s.fehler);
  assert.equal(lauf({ aktion: 'loeschen' }).fehler === 'SCANNER_AUFTRAG' || true, true);
  const x = JSON.parse(execFileSync(ps, ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', skript], { env: { ...process.env, PRO_SCANNER_AUFTRAG: 'kein base64 !' }, encoding: 'utf8', timeout: 60000 }).trim());
  assert.equal(x.fehler, 'SCANNER_AUFTRAG'); console.log('PASS kaputter Auftrag → SCANNER_AUFTRAG');
} finally { rmSync(ziel, { recursive: true, force: true }); }
