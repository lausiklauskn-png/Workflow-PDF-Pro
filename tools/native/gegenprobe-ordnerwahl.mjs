#!/usr/bin/env node
// Gegenprobe Ordnerwahl und Tresor-Schutz (Klaus 2026-11-03, gemeinsamer Tresor-Plan): je Korrektur wird sie in einer
// Wegwerf-Kopie zurückgenommen, die zuständige Probe muss dann rot werden. JVM-Fälle brauchen javac/java und TRESOR_JARS
// (junit-4.13.2.jar, hamcrest-core-1.3.jar); Web-Fälle WFP_CHROMIUM wie test-tresorordner.mjs. NUR_FALL=<Teil des Titels>.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const J = 'android/app/src/main/java/de/familyprojekt/';
const OW = J + 'workflowpdf/pro/OrdnerWahl.java';
const faelle = [
  ['jvm', 'Kontrolle JVM (ohne Fehler)', OW, 'final class OrdnerWahl {', 'final class OrdnerWahl {'],
  ['web', 'Kontrolle Web (ohne Fehler)', 'native/native-wo-liegt-was.js', "'use strict';", "'use strict';"],
  // 1 Ordnerwahl
  ['jvm', 'alte Verschachtelung „Workflow PDF Pro/Workflow PDF Pro“', OW, 'if (!leer) throw new IOException("VAULT_ORDNER_" + NEIN_FACH_OHNE_KOPF);\n        return false;', 'return true;'],
  ['jvm', 'Verwaltung „Tresorordner“ als Ablage angenommen', OW, 'if (VERWALTUNG.equals(name) || verwaltungInhalt(a)) return NEIN_VERWALTUNG;', ''],
  ['jvm', 'fremdes Fach als Ablage angenommen', OW, 'if (fremdesFach(name)) return NEIN_FREMDES_FACH;', ''],
  ['jvm', 'Ordner ohne Tresor ohne Rückfrage', OW, '        return FRAGEN_NEU;\n    }', '        return TRESOR_NEUE_ABLAGE;\n    }'],
  ['jvm', 'Hauptablageordner öffnet nicht das Fach darin', OW, 'if (a.gibtEs(FACH_ORDNER + "/" + ABLAGE_KOPF)) return ABLAGE_DARIN;', ''],
  ['jvm', 'App-Ordner gilt als Tresor', OW, 'if (FACH_ORDNER.equals(name) || fremdesFach(name) || a.gibtEs(ABLAGE_KOPF)) return TRESOR_APP_ORDNER;', ''],
  ['web', 'Ablage: Ablehnung landet im Sperrbildschirm', 'native/native-vault.js', 'const m=window.WFPWoLiegtWas?.meldung(error);if(m){note.textContent=m;return;}throw error;', 'throw error;'],
  ['web', 'Ablage: „Anderen Ordner wählen“ fragt nicht neu', 'native/native-vault.js', 'if(answer.cancelled){if(answer.andererOrdner)continue;return;}', 'if(answer.cancelled)return;'],
  ['web', 'Tresor: Code statt Klartext', 'native/native-tresorordner.js', ":window.WFPWoLiegtWas?.meldung(code)||t('failed')+code;};", ":t('failed')+code;};"],
  ['web', 'Tresor: Ebene darüber verschwiegen', 'native/native-tresorordner.js', "          if(r?.ebeneHoeher&&window.WFPWoLiegtWas)", "          if(false)"],
  ['web', 'Java: Abgelehntes erst nach inspect', J + 'workflowpdf/pro/ProVaultPlugin.java', 'if(OrdnerWahl.abgelehnt(art))throw new java.io.IOException("VAULT_ORDNER_"+art);\n', ''],
  ['web', 'Java: Verschachtelung in DocumentVault zurück', J + 'workflowpdf/pro/DocumentVault.java', 'if (OrdnerWahl.unterordnerAnlegen(displayName(candidate, candidate.root), children(candidate, candidate.root).isEmpty()))', 'if (!FOLDER.equals(displayName(candidate, candidate.root)) || !children(candidate, candidate.root).isEmpty())'],
  ['verbund', 'Pro-Apps: Code statt Klartext', 'native/native-pro-verbund.js', ":window.WFPWoLiegtWas?.meldung(error)||t('failed')", ":t('failed')"],
  // 2 Keine offenen Dateien in den Tresor
  ['jvm', 'Nachbarordner mit gleichem Anfang gilt als Tresor', OW, 'return dp.equals(bp) || dp.startsWith(bp + "/");', 'return dp.startsWith(bp);'],
  ['jvm', 'fremder Anbieter verglichen', OW, 'if (!baumAnbieter.equals(dokAnbieter) || !EXTERN.equals(baumAnbieter)) return false;', ''],
  ['web', 'Speichern: Hinweis fehlt', 'native/native-files.js', "else if (result.imTresor) notify(window.WFPWoLiegtWas?.text('imTresor') || t('fail'));", ''],
  // Ein Schritt und Sperre (Klaus 2026-11-04)
  ['web', 'Java: Speichern unter ohne Sperrhinweis', J + 'workflowpdf/pro/ProFilesPlugin.java', 'TresorSchutz.gesperrt(getActivity(), call.getString("language", "de"), () -> {});', ''],
  ['web', 'Java: ganze Freigabe statt Tresor gesperrt', J + 'workflowpdf/pro/TresorSchutz.java', 'for (String ordner : OrdnerWahl.oberordner(wurzel, dok))', 'for (String ordner : java.util.List.of(wurzel))'],
  ['web', 'Java: Einrichten legt an, bevor das Passwort geprüft ist', J + 'workflowpdf/pro/ProVaultPlugin.java', '        de.familyprojekt.tresor.Hauptordner.ablage(s,e,name); // legt bei ANLEGEN_DARIN den Ordner an, sonst nichts\n', ''],
  ['jvm', 'Lies-mich überschreibt eine vorhandene', J + 'tresor/Hauptordner.java', '        if (haupt.gibtEs(LIES_MICH)) return false;\n', ''],
  ['web', 'Java: Speichern schreibt ohne Frage', J + 'workflowpdf/pro/ProFilesPlugin.java', 'if (TresorSchutz.imTresor(getContext(), uri)) {', 'if (false) {'],
  // 3 Hilfe-Seite
  ['web', 'Hilfe: Knopf fehlt im Kasten', 'native/native-vault.js', "      window.WFPWoLiegtWas?.knopf(fuss);\n", ''],
  ['web', 'Hilfe: Original speichern fehlt', 'native/native-wo-liegt-was.js', "orig.dataset.woOriginal='';orig.textContent=text('original');", "orig.dataset.woOriginal='';"],
  ['verbund', 'Hilfe: Knopf fehlt bei den Pro-Apps', 'native/native-pro-verbund.js', 'window.WFPWoLiegtWas?.knopf(footer);', ''],
];

const nur = process.env.NUR_FALL;
let gefangen = 0, durch = 0;
for (const [art, titel, datei, alt, neu] of faelle) {
  if (nur && !titel.includes(nur)) continue;
  const tmp = mkdtempSync(join(tmpdir(), 'ordnerwahl-gp-'));
  try {
    for (const teil of ['android/app/src', 'native', 'tools', 'upstream', 'docs', 'windows/bridge', 'package.json']) cpSync(join(repo, teil), join(tmp, teil), { recursive: true });
    symlinkSync(join(repo, 'node_modules'), join(tmp, 'node_modules'));
    const text = readFileSync(join(tmp, datei), 'utf8');
    if (!text.includes(alt)) { console.log(`TOTER ANKER    ${titel}`); durch++; continue; }
    const geaendert = text.replace(alt, neu);
    if (!titel.startsWith('Kontrolle') && geaendert === text) { console.log(`OHNE WIRKUNG   ${titel}`); durch++; continue; }
    writeFileSync(join(tmp, datei), geaendert);
    let rot = false;
    try {
      if (art === 'jvm') {
        const jars = process.env.TRESOR_JARS; if (!jars) { console.error('TRESOR_JARS fehlt'); process.exit(2); }
        const cp = [join(jars, 'junit-4.13.2.jar'), join(jars, 'hamcrest-core-1.3.jar')].join(':');
        const a = join(tmp, 'jvm/a'), b = join(tmp, 'jvm/b'), cls = join(tmp, 'jvm/cls');
        for (const d of [a, b, cls]) mkdirSync(d, { recursive: true });
        for (const n of readdirSync(join(tmp, J, 'tresor'))) if (n !== 'SafAblage.java') cpSync(join(tmp, J, 'tresor', n), join(a, n));
        for (const n of ['TresorEinzug.java', 'OrdnerWahl.java', 'VaultCrypto.java']) cpSync(join(tmp, J, 'workflowpdf/pro', n), join(b, n));
        cpSync(join(tmp, 'android/app/src/test/java/de/familyprojekt/workflowpdf/pro/OrdnerWahlTest.java'), join(b, 'OrdnerWahlTest.java'));
        for (const n of ['HauptordnerTest.java', 'TresorOrdnerTest.java']) cpSync(join(tmp, 'android/app/src/test/java/de/familyprojekt/tresor', n), join(a, n));
        const quellen = [...readdirSync(a).map(n => join(a, n)), ...readdirSync(b).map(n => join(b, n))];
        execFileSync('javac', ['-encoding', 'UTF-8', '-d', cls, '-cp', cp, ...quellen], { stdio: 'pipe' });
        execFileSync('java', ['-cp', cls + ':' + cp, 'org.junit.runner.JUnitCore', 'de.familyprojekt.workflowpdf.pro.OrdnerWahlTest', 'de.familyprojekt.tresor.HauptordnerTest'], { stdio: 'pipe' });
      } else {
        execFileSync('node', [join(tmp, 'tools/native/prepare-web.mjs')], { stdio: 'pipe', cwd: tmp });
        const probe = art === 'verbund' ? 'tools/native/test-pro-verbund.mjs' : 'tools/native/test-tresorordner.mjs';
        execFileSync('node', ['--test', join(tmp, probe)], { stdio: 'pipe', cwd: tmp, timeout: 300000 });
      }
    } catch { rot = true; }
    if (titel.startsWith('Kontrolle')) { console.log(`${rot ? 'KONTROLLE ROT ' : 'KONTROLLE GRÜN'} ${titel}`); if (rot) durch++; continue; }
    console.log(`${rot ? 'GEFANGEN      ' : 'DURCHGERUTSCHT'} ${titel}`);
    rot ? gefangen++ : durch++;
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
console.log(`\n${gefangen} gefangen · ${durch} durchgerutscht`);
process.exit(durch ? 1 : 0);
