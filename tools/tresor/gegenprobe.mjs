#!/usr/bin/env node
// Gegenprobe für den gemeinsamen Tresorordner: baut je einen Fehler in eine Wegwerf-Kopie der
// Quellen ein und verlangt, dass die JVM-Probe dann rot wird. Braucht javac/java und
// TRESOR_JARS=<Ordner mit junit-4.13.2.jar und hamcrest-core-1.3.jar>.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const main = join(repo, 'android/app/src/main/java/de/familyprojekt/tresor');
const test = join(repo, 'android/app/src/test/java/de/familyprojekt/tresor');
const jars = process.env.TRESOR_JARS;
if (!jars) { console.error('TRESOR_JARS fehlt'); process.exit(2); }
const cp = [join(jars, 'junit-4.13.2.jar'), join(jars, 'hamcrest-core-1.3.jar')];

const faelle = [
  ['Falsches Passwort schreibt etwas', 'TresorOrdner.java',
    '        for (String name : a.liste(VERWALTUNG)) {\n            if (!name.matches("kennwort-"',
    '        try (OutputStream spur = a.neu("spur-" + UUID.randomUUID())) { }\n        for (String name : a.liste(VERWALTUNG)) {\n            if (!name.matches("kennwort-"', 'falschesPasswort'],
  ['Alter Ersatzsatz bleibt gültig', 'TresorOrdner.java',
    'if (name.matches("ersatz-[a-f0-9]{8}\\\\.json") && !name.equals', 'if (false && !name.equals', 'ersatzschluessel'],
  ['Altes Passwort bleibt gültig', 'TresorOrdner.java',
    'if (name.matches("kennwort-" + UUID_MUSTER + "\\\\.json") && !pfad.equals(behalten))', 'if (false)', 'passwortAendern'],
  ['Einziehen schreibt ins Fach', 'TresorOrdner.java',
    '        fachSchluesselSchreiben(f, vorhandenerSchluessel);\n    }',
    '        fachSchluesselSchreiben(f, vorhandenerSchluessel);\n        try (OutputStream o = ablage.neu(f.ordner + "/umzug.txt")) { o.write(1); }\n    }', 'umzug'],
  ['Marke löscht die Datei im Eingang', 'TresorOrdner.java',
    '        if (ablage.gibtEs(pfad)) return;\n        ablage.ordner(markenOrdner());',
    '        if (ablage.gibtEs(pfad)) return;\n        for (Eintrag x : verzeichnis(slug)) if (x.id.equals(eintragId)) ablage.loeschen(f.ordner + "/" + x.verweis);\n        ablage.ordner(markenOrdner());', 'fremdesFach'],
  ['Jede App darf überall schreiben', 'Fach.java', 'return istUebergabe() || besitzer.equals(app);', 'return true;', 'fremdesFach'],
  // Zwei Sicherungen gegen das Zurückspielen eines alten Verzeichnis-Stands: die Nummer ist in der
  // Verschlüsselung gebunden UND steht im Inhalt. Erst ohne beide darf die Probe rot werden.
  ['Zurückspielen eines alten Stands nicht erkannt', 'TresorOrdner.java',
    'return aad(id, "verzeichnis", f.slug + "|" + schreiber + "|" + rev);', 'return aad(id, "verzeichnis", f.slug + "|" + schreiber);', 'manipulationen',
    [' || Json.zahl(d, "revision") != rev) throw', ') throw']],
  ['Prüfwert im Kopf nicht geprüft', 'TresorOrdner.java',
    'if (!MessageDigest.isEqual(pruefwert(haupt, id), erwartet)) { Arrays.fill(haupt, (byte) 0); throw fehler("TRESOR_BESCHAEDIGT"); }', '', 'manipulationen'],
  // Ort ändern (Umzug.java): nie überschreiben, jede Datei nachprüfen, Kopf zuletzt, kein Umzug in einen fremden Tresorordner.
  ['Umzug überschreibt am neuen Ort', 'Umzug.java',
    'if (neu.istOrdner(p) || !soll.equals(sha(neu, p))) throw TresorOrdner.fehler("TRESOR_UMZUG_KONFLIKT");', 'continue;', 'ortAendernUeberschreibtNie'],
  ['Umzug nimmt einen fremden Tresorordner', 'Umzug.java',
    'if (neu.gibtEs(TresorOrdner.KOPF) && !id.equals(TresorOrdner.kennung(neu))) throw TresorOrdner.fehler("TRESOR_UMZUG_FREMDER_TRESOR");', '', 'ortAendernUeberschreibtNie'],
  ['Umzug schreibt den Kopf zuerst', 'Umzug.java', '        aus.remove(TresorOrdner.KOPF);\n        aus.add(TresorOrdner.KOPF);', '        aus.remove(TresorOrdner.KOPF);\n        aus.add(0, TresorOrdner.KOPF);', 'ortAendernUeberschreibtNie'],
  ['Vermerk wird nicht beachtet', 'Umzug.java', 'if (alt.gibtEs(VERMERK)) throw TresorOrdner.fehler("TRESOR_UMZUG_SCHON_UMGEZOGEN");', '', 'ortAendernKopiert'],
  ['Übergabefach liest nur einen Schreiber', 'TresorOrdner.java',
    'for (String schreiber : Fach.APPS) if (ablage.istOrdner', 'for (String schreiber : java.util.Collections.singletonList(app)) if (ablage.istOrdner', 'uebergabefach'],
];

let gefangen = 0, durch = 0;
const nur = process.env.NUR_FALL;
for (const [titel, datei, alt, neu, erwartet, zweiter] of faelle) {
  if (nur && !titel.includes(nur)) continue;
  const tmp = mkdtempSync(join(tmpdir(), 'tresor-gp-'));
  try {
    const src = join(tmp, 'src'); mkdirSync(src);
    for (const d of [main, test]) for (const n of readdirSync(d)) if (n.endsWith('.java') && n !== 'SafAblage.java') writeFileSync(join(src, n), readFileSync(join(d, n)));
    const text = readFileSync(join(src, datei), 'utf8');
    if (!text.includes(alt)) { console.log(`TOTER ANKER  ${titel}`); durch++; continue; }
    let geaendert = text.replace(alt, neu);
    if (zweiter) {
      if (!geaendert.includes(zweiter[0])) { console.log(`TOTER ANKER  ${titel} (zweiter)`); durch++; continue; }
      geaendert = geaendert.replace(zweiter[0], zweiter[1]);
    }
    writeFileSync(join(src, datei), geaendert);
    const cls = join(tmp, 'cls'); mkdirSync(cls);
    execFileSync('javac', ['-nowarn', '-d', cls, '-cp', cp.join(':'), ...readdirSync(src).map(n => join(src, n))], { stdio: 'pipe' });
    let ausgabe = '';
    try { execFileSync('java', ['-cp', [cls, ...cp].join(':'), 'org.junit.runner.JUnitCore', 'de.familyprojekt.tresor.TresorOrdnerTest'], { stdio: 'pipe' }); }
    catch (e) { ausgabe = String(e.stdout); }
    if (ausgabe && new RegExp(`\\) ${erwartet}`).test(ausgabe)) { console.log(`gefangen     ${titel}`); gefangen++; }
    else { console.log(`DURCHGERUTSCHT ${titel}${ausgabe ? ' (rot, aber nicht in ' + erwartet + ')' : ''}`); durch++; }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
console.log(`\n${gefangen} gefangen · ${durch} durchgerutscht`);
process.exit(durch ? 1 : 0);
