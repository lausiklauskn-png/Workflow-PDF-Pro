# Workflow PDF Pro 1.0.13: eigenständiger Android-Appwechsel, Abschluss 03.11.2026

Beim Android-System-Teilen bleibt Workflow PDF Pro eine eigenständige App. Familienakte öffnet ihren eigenen Task; der bisherige PDF-Arbeitsbereich bleibt erreichbar. Der Ausgabedialog startet ohne Ergebnis-Rückkanal, das Ziel erhält NEW_TASK. Die Anzeige in vier Sprachen bestätigt das Öffnen und keine Zustellung. Gewöhnliches Speichern behält seinen Rückkanal.

## Quelle und Nachweise

PR #59 wurde nach vollständig grüner Prüfung als `1ea49db1eb9b23969f051030247a56472e528d3b` auf main zusammengeführt. Claudes doppelter PR #60 wurde geschlossen, dessen optionale Wächterdatei wurde gelesen. Der wirksame neue OS-Wächter ist NativeAppSwitchTest: tatsächlicher Android-Chooser und veröffentlichte Familienakte-APK, kalter und warmer Empfänger, getrennte wiederverwendete Tasks und erhaltenes Senderfenster. Die alte Ausgabe aus 1.0.12 fällt in 41687211768 mit beiden Apps in Aufgabe 8 durch. Neuer Telefonlauf: Aufgaben 8/9 und wieder 9.

Vollständige Branch-Freigabe 41693054268 und tatsächliche Main-Freigabe 41696817320 grün: beide Android-APIs 31/35 mit je 51 ausgeführten Fällen, ohne Fehler oder Überspringen, Überinstallation mit Datenerhalt. Auch die vollständigen regulären PR- und Windows-Prüfungen sind grün; Main-Windows-Abnahme 41696817356. Adapter-Browsergruppe 98/0, Netz 16/0 sowie 5 Eingangs- und 8 Verbund-Gegenproben gefangen. Bytegleicher Kern: 216 Dateien. Die lokale unveränderte Kern-E2E-Kette traf eine verwaltete file://-Sperre und zählt nicht als grün; die vollständige CI-Kette bestand. Keine Prüfungen oder Installationsbudgets abgeschaltet.

Im ersten vollständigen Telefonlauf blockierte ein bereits vor dem Appwechsel aufgetretener SDK-Pixel-Launcher-Dialog die Eingabe. Originalbild/Protokoll sind in der Übergabe erhalten; nur dieser exakt benannte fremde SDK-Dialog darf in der Probe geschlossen werden. Fehler der geprüften Apps bleiben sichtbar. Der später grüne Lauf hatte keinen erneut protokollierten Launcher-ANR; kein neuer Belastungsnachweis des SDK wird daraus abgeleitet.

## Veröffentlichung und Gleichstand

Android v1.0.13 / Build 14: Lauf 41701010489, dauerhaft signiert, echte Installation und Überinstallation geprüft. Windows windows-v1.0.13:41699023539, abgenommener Installer von main, unsigniert und weiterhin manuelles Update. Beide Tags und anonym erneut geladene öffentliche Dateien stimmen mit dem geprüften Main überein. Nachweise: docs/APPWECHSEL-VEROEFFENTLICHUNG-1.0.13.json.

| Datei | Bytes | SHA-256 |
|---|---:|---|
| Workflow-PDF-Pro-Windows-1.0.13-Setup.exe | 26445225 | `559065bcfa080a4296cf858af01a7384d97c539bdd11e1e51626d282f0361b10` |
| Workflow-PDF-Pro-1.0.13.apk | 83346114 | `55068653f29eae321e6cfc64c712e83b6e4530f2c06f15e9dc30c51fdbe96407` |

PWA-Kern **1.1.9** aus Workflow-PDF main 0ed15e5 bleibt bytegleich; Android-Task-Flags haben im Browser keine Entsprechung. iOS bleibt nur vorbereitet und wird nicht veröffentlicht. Familienakte PR #67 hat den Adapter über den Herkunftsweg von 1ea49db bytegleich nachgezogen und bewahrt den eingebetteten 1.1.9-Klon. Die frühere vollständige Android-Tresor-Paar-Abnahme bleibt gesondert offen; Familienakte PR #59 bleibt Entwurf. Persönliche DeX-/Maus-Geräte als konkrete Rückmeldung prüfen, keine neue allgemeine Testmatrix.

## Zeit und Weiterarbeit

Belegbarer Zweigbeginn: **03.11.2026 16:44:19 UTC / 17:44:19 MEZ**. Diese Aufzeichnung: **03.11.2026 20:45:10 MEZ**. Verstrichenes Fenster **3.01 Stunden**, einschließlich CI, Freigaben und Wartezeit; keine persönliche oder aktive Arbeitsstundenmessung. Nachfolgende reine Dokumentations-/Geschenk-/Sicherungsarbeiten sind ein Nachlauf, Repozeiten werden nicht addiert.

```text
Aktuellen main von Meine-Familienakte und Workflow-PDF-Pro laden.
Zuerst CLAUDE.md bzw. AGENTS.md und die aktuellen Appwechsel-Abschlussbriefe lesen.
Familienakte 2.28.17 und Workflow PDF Pro 1.0.13 sind veröffentlicht; diese Versionen nicht erneut ausgeben.
Bytegleichen PDF-Kern 1.1.9, Herkunftspins, Paketkennungen und Signieridentitäten erhalten.
Konkrete Geräte-Rückmeldung mit vorhandenen Testunterlagen auswerten; keine neue allgemeine Testmatrix.
Familienakte PR #59 bleibt Entwurf: ältere vollständige Android-Tresor-Paar-Abnahme separat offen.
```
