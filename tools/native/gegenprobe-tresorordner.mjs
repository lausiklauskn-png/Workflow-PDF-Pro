#!/usr/bin/env node
// Gegenprobe für Schritt D1 (Einzug in den Tresorordner): baut je einen Fehler in eine Wegwerf-Kopie ein und verlangt,
// dass die zuständige Probe rot wird. JVM-Fälle brauchen javac/java und TRESOR_JARS (junit-4.13.2.jar, hamcrest-core-1.3.jar);
// Browser-Fälle WFP_CHROMIUM wie test-tresorordner.mjs. NUR_FALL=<Teil des Titels> für einen Fall.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const J = 'android/app/src/main/java/de/familyprojekt/';
const faelle = [
  // Kontrollen ohne Fehler: müssen GRÜN bleiben, sonst wäre jeder Fall aus dem falschen Grund rot.
  ['jvm', 'Kontrolle JVM (ohne Fehler)', J + 'workflowpdf/pro/TresorEinzug.java', 'final class TresorEinzug {', 'final class TresorEinzug {'],
  ['web', 'Kontrolle Browser (ohne Fehler)', 'native/native-tresorordner.js', "'use strict';", "'use strict';"],
  ['jvm', 'Kennung des Tresors nicht geprüft', J + 'workflowpdf/pro/TresorEinzug.java', 'return tresorId != null && tresorId.equals(kopf.get("id")) ? "PASST" : "FREMDER_TRESOR";', 'return "PASST";'],
  ['jvm', 'Fach-Ordner selbst wird angenommen', J + 'workflowpdf/pro/TresorEinzug.java', 'if (a.gibtEs(TRESOR_KOPF)) return "IST_FACH";', ''],
  ['jvm', 'Einzug schreibt in „Workflow PDF Pro/“', J + 'workflowpdf/pro/TresorEinzug.java', '        t.fachAnlegen(EINGANG);\n', '        t.fachAnlegen(EINGANG);\n        t.ablegen(FACH, "", "spur", "text/plain", 0, new java.io.ByteArrayInputStream(new byte[1]), "");\n'],
  ['jvm', 'Verzeichnis wird jedes Mal neu geschrieben', J + 'workflowpdf/pro/TresorEinzug.java', '        if (gleich) return false;\n', ''],
  ['jvm', 'Schreiber/Format kommen von außen', J + 'workflowpdf/pro/TresorEinzug.java', 'm.put("schreiber", APP); m.put("verschluesselung", "app");', 'm.put("schreiber", z.getOrDefault("schreiber", APP)); m.put("verschluesselung", z.getOrDefault("verschluesselung", "app"));'],
  ['web', 'Abschnitt nicht im Tresor-Kasten', 'native/native-vault.js', 'if(active&&window.WFPTresorordner)void WFPTresorordner.abschnitt(', 'if(false)void WFPTresorordner.abschnitt('],
  ['web', 'Zeile trägt den ganzen Seitentext', 'native/native-tresorordner.js', "auszug:text,verweis:'docs/'+d.id,sha256});", "auszug:text,verweis:'docs/'+d.id,sha256,text:JSON.stringify(await db.get('texte',d.id))});"],
  ['web', 'Hintergrund schreibt in fremden Ordner', 'native/native-tresorordner.js', "if(!(z.offen&&z.eingezogen&&z.pruefung==='PASST'))return null;", "if(!(z.offen&&z.eingezogen))return null;"],
  ['web', 'Auszug fehlt', 'native/native-tresorordner.js', 'let text=\'\';try{text=auszug(', 'let text=\'\';try{void(auszug,'],
];

const nur = process.env.NUR_FALL;
let gefangen = 0, durch = 0;
for (const [art, titel, datei, alt, neu] of faelle) {
  if (nur && !titel.includes(nur)) continue;
  const tmp = mkdtempSync(join(tmpdir(), 'tresor-d1-gp-'));
  try {
    for (const teil of ['android/app/src', 'native', 'tools', 'upstream', 'docs', 'package.json']) cpSync(join(repo, teil), join(tmp, teil), { recursive: true });
    symlinkSync(join(repo, 'node_modules'), join(tmp, 'node_modules'));
    const text = readFileSync(join(tmp, datei), 'utf8');
    if (!text.includes(alt)) { console.log(`TOTER ANKER    ${titel}`); durch++; continue; }
    writeFileSync(join(tmp, datei), text.replace(alt, neu));
    let rot = false;
    try {
      if (art === 'jvm') {
        const jars = process.env.TRESOR_JARS; if (!jars) { console.error('TRESOR_JARS fehlt'); process.exit(2); }
        const cp = [join(jars, 'junit-4.13.2.jar'), join(jars, 'hamcrest-core-1.3.jar')].join(':');
        const a = join(tmp, 'jvm/a'), b = join(tmp, 'jvm/b'), cls = join(tmp, 'jvm/cls');
        for (const d of [a, b, cls]) mkdirSync(d, { recursive: true });
        for (const n of readdirSync(join(tmp, J, 'tresor'))) if (n !== 'SafAblage.java') cpSync(join(tmp, J, 'tresor', n), join(a, n));
        for (const n of ['TresorEinzug.java', 'VaultCrypto.java']) cpSync(join(tmp, J, 'workflowpdf/pro', n), join(b, n));
        cpSync(join(tmp, 'android/app/src/test/java/de/familyprojekt/workflowpdf/pro/TresorEinzugTest.java'), join(b, 'TresorEinzugTest.java'));
        const quellen = [...readdirSync(a).map(n => join(a, n)), ...readdirSync(b).map(n => join(b, n))];
        execFileSync('javac', ['-d', cls, '-cp', cp, ...quellen], { stdio: 'pipe' });
        execFileSync('java', ['-cp', cls + ':' + cp, 'org.junit.runner.JUnitCore', 'de.familyprojekt.workflowpdf.pro.TresorEinzugTest'], { stdio: 'pipe' });
      } else {
        execFileSync('node', [join(tmp, 'tools/native/prepare-web.mjs')], { stdio: 'pipe', cwd: tmp });
        execFileSync('node', ['--test', join(tmp, 'tools/native/test-tresorordner.mjs')], { stdio: 'pipe', cwd: tmp, timeout: 240000 });
      }
    } catch { rot = true; }
    if (titel.startsWith('Kontrolle')) { console.log(`${rot ? 'KONTROLLE ROT ' : 'KONTROLLE GRÜN'} ${titel}`); if (rot) durch++; continue; }
    console.log(`${rot ? 'GEFANGEN      ' : 'DURCHGERUTSCHT'} ${titel}`);
    rot ? gefangen++ : durch++;
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
console.log(`\n${gefangen} gefangen · ${durch} durchgerutscht`);
process.exit(durch ? 1 : 0);
