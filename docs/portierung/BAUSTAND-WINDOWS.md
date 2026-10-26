# Windows-Bau (Tauri 2, WebView2): Baustand

Stand 21.10.2026. Auftrag: `BRIEF_NACHFOLGE_2026-10-21_WINDOWS.md`. Klaus hat Tauri gewählt.
Gebaut und geprüft wird auf GitHub-Windows-Rechnern (`windows-latest`). **Auf Klaus' eigenem
Windows-PC ist die App nicht gemessen**, bis er es bestätigt.

## Aufbau

- `windows/`: eigener Ordner. Android-Dateien, `native/` und `upstream/` sind unverändert.
  `windows/tools/build-web.mjs` ruft denselben Bündler `tools/native/prepare-web.mjs` auf
  (Kern bytegleich, 86 öffentliche Laufzeitdateien). Nur die eigenen Dialogseiten kommen
  unter `windows/` hinzu.
- `windows/bridge/capacitor-tauri.js`: läuft als Initialisierungsskript nur im Hauptfenster.
  Es stellt dieselbe Plugin-Schnittstelle bereit wie Capacitor. Damit laufen `native/*.js`
  **unverändert** (Speichern, Ordner einlesen, Empfang, Tresor, Chrome-Weg).
  Teilen nutzt zuerst das Teilen-Fenster von Windows (Web Share der WebView2), sonst wird die
  Datei im Explorer gezeigt. Eine Zustellung wird nie bestätigt.
- `windows/core` (reines Rust, ohne Tauri, auch unter Linux geprüft): Nachbau der
  Android-Verträge aus `DocumentVault.java`, `VaultLocations.java`, `VaultCrypto.java`,
  `IncomingInbox.java`, `FolderImport.java`, `ProFilesPlugin.java` und `ChromeSession.java`.
- `windows/src-tauri`: Host. Hauptfenster `https://tauri.localhost`, fremde Seiten dürfen es
  nicht ersetzen. Speichern unter (Systemdialog, Kopie mit Prüfsummenvergleich), Drucken über
  die Standard-PDF-App, Links über die Standard-App, Ordnerwahl, „Öffnen mit“ und Zweitstart
  (eine Instanz), eigenes Passwortfenster, Merken über DPAPI (Windows-Benutzerkonto),
  Chrome-Laufhinweis mit Abbrechen.
- Installer: NSIS, pro Benutzer, ohne Administratorrechte, DE/EN/RU/AR. „Öffnen mit“ für
  .pdf/.png/.jpg/.jpeg/.webp nur über `OpenWithProgids`. Die Standard-App bleibt unverändert.
  Deinstallation entfernt diese Einträge. App-Daten bleiben bei stiller Deinstallation erhalten.
- Kennung `de.familyprojekt.workflowpdf.pro`, Version 1.0.1 passend zu Android.
  Arbeitsdaten liegen unter `%LOCALAPPDATA%\de.familyprojekt.workflowpdf.pro`.

## Tresor: gleiches Format wie Android

Der Tresor in einem frei gewählten Ordner (Rechner, USB-Stick) verwendet dasselbe Format
PBV1 und dieselbe Ordnerstruktur wie unter Android: „Workflow PDF Pro“,
`workflow-pdf-pro.tresor.json`, Commit-Marken, `.wpv`-Datensätze. Gespeichert werden nur
relative Namen. `windows/core/compat/run.sh` übersetzt das **unveränderte**
`VaultCrypto.java` der Android-App und prüft beide Richtungen: Android legt an, Windows liest,
und umgekehrt. Das Passwort ist dabei in NFC und NFD geschrieben. Das Passwort wird nur im
eigenen Fenster eingegeben und geht nie an die Webseite oder in den Ordner.

## Messung vor dem Bau (Lauf 39667843502)

Im WebView2-Fenster der still installierten Tauri-App (Edge 154) gemessen:
Einlesen eines Formulars mit Feld (Original bytegleich), alle drei PDF-Ausgaben,
Tesseract-Texterkennung („Antrag Bewohnerparkausweis“ richtig), pdf.js-Seitenbilder,
Service Worker aktiv, IndexedDB-Daten nach Neustart und nach Deinstallation und
Neuinstallation erhalten. `Translator` ist vorhanden, meldet aber für alle sechs Paare
DE/RU/EN `unavailable`. Deshalb wird der Chrome-Weg (Variante A) gebraucht.
WebView2 trägt also, und Electron als Rückfall ist nicht nötig.

## Abnahme in CI (`.github/workflows/windows-app.yml`)

Linux: `cargo test` (Kryptografie, Tresor anlegen, sperren, wieder öffnen, falsches Passwort,
abgezogener Ordner, beschädigter Index, Stapelabbruch, Chrome-Loopback mit Abweisungen) und
die Gegenprobe des Android-Formats.

Windows: Prüfbau (Feature `messprobe`, nur dort der lokale Prüfzugang und feste Prüfordner
statt Systemdialog) und Auslieferungsbau. Ablauf: still installieren, Phasen *erst*,
*neustart*, *abgezogen*, *neuinstallation*. Am Ende wird der Auslieferungsbau installiert
und geprüft, dass kein Prüfzugang offen ist.

Ergebnisse stehen am Ende dieser Datei, mit Laufnummer.

## Benannte Grenzen unter Windows

- **Unsigniert**: SmartScreen zeigt „Der Computer wurde durch Windows geschützt“. Dann
  „Weitere Informationen“ → „Trotzdem ausführen“. Ein Zertifikat kostet Geld und liegt
  bei Klaus. Nichts davon ist „von Microsoft geprüft“.
- **Übersetzen auf dem Gerät (ML Kit)**: gibt es unter Windows nicht. Die eingebaute
  Übersetzung der WebView2 meldet `unavailable`. Möglich bleiben Chrome (Google Chrome muss
  installiert sein, Text geht an Google) und die vorhandenen KI-Anbieter mit eigenem Schlüssel.
- **Spracheingabe**: kein eigener Windows-Adapter. Es bleibt bei der Spracherkennung der
  WebView2. Ob sie auf einem echten PC Text liefert, ist nicht gemessen.
- **Drucken**: öffnet die PDF in der Standard-PDF-App von Windows; gedruckt wird dort.
- **Teilen**: Teilen-Fenster von Windows, sonst Datei im Explorer. Keine Zustellungsbestätigung.
- **Teilen aus anderen Apps zu Workflow PDF Pro** (Android „Teilen“): unter Windows ohne
  Paketidentität nicht vorhanden. Dafür gibt es „Öffnen mit“ und das Ziehen von Dateien auf das
  App-Symbol oder ins Fenster.
- **Automatische Updates**: noch nicht eingebaut. Eine neue Version wird wie die erste
  heruntergeladen und über die vorhandene installiert. Die Daten bleiben dabei erhalten.

## Ergebnisse

### Lauf 39677170096 (Commit b393047, `windows-latest`, WebView2/Edge 154): grün

| Phase | Ergebnis |
|---|---|
| Installation | stilles NSIS-Setup pro Benutzer; „Öffnen mit“ für .pdf eingetragen; Standard-App für .pdf unverändert |
| erst | Brücke aktiv (Plattform `windows`, alle Adapter geladen, Chrome-Transport ersetzt); Formular eingelesen (2 Seiten, Feld „Müller“, Original per SHA-256 gleich); ausfüllbar/fest/Vorlage als PDF; Texterkennung „Antrag Bewohnerparkausweis“; Speichern unter mit Prüfsummenvergleich; Ordner mit Unterordner eingelesen (+2 Dokumente); Tresor über Passwortfenster in einem leeren Ordner angelegt, Übernahme von 3 Dokumenten (11 Datensätze, 16 Dateien), keine PDF-Klartexte im Ordner; „Öffnen mit“ über Zweitstart (+1 Dokument, Hinweis sichtbar); Chrome-Sitzung mit Laufhinweis gestartet, Chrome geöffnet, über „Abbrechen“ beendet (`CHROME_CANCELLED`) |
| neustart | Tresor ohne Passwort entsperrt (DPAPI), 4 Dokumente, Original aus dem Tresor; Sperren → gesperrt; falsches Passwort abgewiesen („Keine Daten wurden zurückgesetzt“); richtiges Passwort öffnet, 4 Dokumente |
| abgezogen | Tresorordner umbenannt: `VAULT_FOLDER_UNAVAILABLE`, Hinweis „Die Bibliothek wird nicht durch eine leere ersetzt“ |
| Deinstallation | Programm entfernt, „Öffnen mit“-Einträge entfernt |
| neuinstallation | Tresor entsperrt, 4 Dokumente erhalten |
| Auslieferungsbau | startet; kein Prüfzugang offen |

Linux-Teil im selben Lauf: `cargo test` und Gegenprobe Android ↔ Windows grün.
Installer `Workflow-PDF-Pro-Windows-1.0.1-Setup.exe`, 15.147.379 Bytes (Größe und Prüfsumme
ändern sich mit jedem Bau; maßgeblich ist die `.sha256`-Datei der Veröffentlichung).

Nicht automatisch geprüft: echtes Drucken, Teilen-Fenster von Windows, Ablegen von Dateien im
Fenster, Kamera, Spracheingabe und die eigentliche Übersetzung in Chrome (sie braucht eine Bedienung
in Chrome). Nichts davon ist auf Klaus' PC gemessen.

## Veröffentlichung 1.0.1 (21.10.2026)

- main-Commit `e824e73` (Squash von PR #11), Bau- und Abnahmelauf auf main 39678618984 grün.
- Veröffentlichungslauf 39679944807 (`windows-release.yml`): Er nimmt genau den im Abnahmelauf
  gebauten Installer, ohne neu zu bauen. Danach wird die Datei unabhängig heruntergeladen und mit
  Prüfsumme und Größe verglichen.
- Release `windows-v1.0.1`, nicht als „latest“ markiert. Android `v1.0.1` bleibt die Hauptveröffentlichung.
- `Workflow-PDF-Pro-Windows-1.0.1-Setup.exe`, 15.147.075 Bytes,
  SHA-256 `f7d5bffd800c7bd01915744d71aea42b3f7c6b05c3de60a37ecc2f18d179a099`. Zusätzlich aus
  dieser Sitzung heruntergeladen und gegengeprüft: gleich (NSIS-Installer, PE32).
- Unsigniert. Auf Klaus' Windows-PC nicht gemessen.

## Windows 1.0.2: Sicherheit, Updates und Signiervorbereitung (22.10.2026)

Noch nicht veröffentlicht. Der Download oben bleibt die unveränderte, unsignierte 1.0.1.
Die Änderungen aus PR #13 wurden nach erfolgreicher Windows-Abnahme auf main übernommen.

- WebView2-SmartScreen wird nicht mehr abgeschaltet. Neue CSP mit lokalen Skripten,
  der bereits fest versionierten Transformers-Bibliothek, WebAssembly und Workern;
  eingebettete lokale Sicherheitshilfe bleibt möglich. Kein JavaScript-eval und
  keine beliebigen Inline-Skripte. Native Aufrufe prüfen Fenster und lokale Seite.
- Windows-Update-Adapter: automatische Suche nach dem Start und alle sechs Stunden,
  abschaltbar und manuell auslösbar; sichtbarer Download, versionsgebundene Signatur,
  fester HTTPS-Downloadpfad, native Installationsbestätigung. Arbeitsstand und
  ausstehende Journal-Schreibvorgänge werden vor dem Neustart gesichert. Fehlender
  Speicher oder Schreibfehler blockiert die Installation.
- Inhaltsprüfsummen in Adapter-/Dialog-URLs verhindern veraltete Fassungen aus dem
  unveränderten Service-Worker-Cache. Dokumentdaten und Modellvorräte bleiben erhalten.
- Release-Vorbereitung: bereits abgenommenen Installer über Microsoft Artifact
  Signing mit OIDC signieren, Herausgeber/Vertrauenskette/Zeitstempel prüfen,
  endgültige Bytes mit dem Tauri-Schlüssel samt Version signieren und unabhängig
  gegenprüfen. Downloadvergleich kommt vor der Aktualisierung des Windows-Update-Zeigers.

Klaus hat bestätigt, dass noch kein Windows-Code-Signing-Zertifikat oder Signierdienst
vorhanden ist. Es wurde kein kostenpflichtiges Konto angelegt. Auch der dauerhafte
Update-Schlüssel muss einmal sicher eingerichtet werden. Das leere `updater.pub`
schaltet Updates aus; der Release-Workflow bricht ohne Signierkonfiguration ab.
Keine neue signierte Veröffentlichung oder echte Update-Installation behaupten.
Einrichtung: [Windows-Signierung und Updates](../../windows/SIGNIERUNG-UND-UPDATES.md).

Prüfverlauf: Der erste neue Windows-Lauf 39761375330 scheiterte vor den Host-Tests
am noch nicht erzeugten Web-Bündel (`frontendDist`). Der Vorbereitungsschritt wurde
ergänzt, die aufgelösten Abhängigkeiten eingecheckt und die Prüfungen neu gestartet.
Der zweite Lauf 39766322384 baute beide Installer und bestand PDF, OCR, Tresor,
Chrome-Abbruch, Neustart, fehlenden Ordner und Neuinstallation; nur die neue
CSP-Probe aus DevTools war rot. Die CSP-Probe wurde in ein normales, ausschließlich
im Prüfbau enthaltenes App-Skript verlegt. Ein separater Test verhindert die
Übernahme dieses Prüfsystems in den Auslieferungsbau.

**Vollständiger neuer Windows-Nachweis: Lauf 39768752969 auf `7cf2f51`, grün.**
Rust-Update-Regeln, Node-Signaturgegenproben und Speicher-/Journalfehlerfälle,
Gegenprobe mit echten Tauri-CLI-Signaturen sowie Linux-Rust-/Android-Formatprüfungen
bestanden. Im installierten WebView2: `evalBlocked:true`, `inlineBlocked:true`,
Update-Adapter vorhanden, Version 1.0.2 und `configured:false` bei leerem Schlüssel.
Eingebettete Sicherheitshilfe, originale Transformers-Bibliothek im Worker,
PDF/Formular/OCR/Export, Speichern und Anhalten vor Update, Passwortdialog ohne
Update-Rechte, fehlender Tresorordner mit Update-Sperre und Datenerhalt nach
Neuinstallation bestanden. Auslieferungsbau läuft ohne CDP-Prüfzugang und ohne
CSP-Prüfskript. 191/191 Quelldateien unverändert.

Das ist keine ausgeführte Authenticode-Signierung oder echte Update-Installation
und keine physische Windows-10-/11-Abnahme. Eine neue Veröffentlichung ist noch nicht erfolgt. Die spätere abschließende Wahl
unten ersetzt die zuvor angenommene Pflicht zur Einrichtung eines Signierkontos.


## Abschlussentscheidung vom 22.10.2026

Klaus beendet Windows vorerst und bereitet als nächste Sitzung iOS vor.
[Windows-Abschluss](../../BRIEF_ABSCHLUSS_2026-10-22_WINDOWS.md) und
[iOS-Nachfolgebrief](../../BRIEF_NACHFOLGE_2026-10-22_IOS.md) sind die aktuelle Übergabe.

Vorerst manuelle Updates per unsignierter Setup.exe; kein kostenpflichtiges
Windows-Signierkonto, kein selbstsigniertes Herausgeberzertifikat und kein
Update-Schlüssel. Automatische Updates bleiben deaktiviert. Der existierende
Releaseworkflow erzwingt noch Signierung und passt damit noch nicht zur letzten
Wahl. Dies vor einer späteren Windows-Veröffentlichung korrigieren; jetzt kein
Konto anlegen, keinen Schlüssel erzeugen und keine neue Version veröffentlichen.
Der aktuelle öffentliche Installer bleibt 1.0.1. Diese Abschlussfortsetzung
ändert Dokumentation, weder Anwendungscode noch den Releaseablauf.

## Ersatzschlüssel 3 von 5 (Quellstand, nicht veröffentlicht)

PR #14 ergänzt den Windows-Quellstand um Ersatzschlüssel für den Ordnertresor:
eigenes Fenster `windows/ersatz.html` (Anzeigen, Speichern, Drucken, Bestätigen) und
„Passwort vergessen?“ im Passwortfenster. Die Windows-Abnahme prüft Erzeugen, Sperre für
das Hauptfenster, Tippfehlererkennung, Ablehnung von nur zwei Teilen und das Öffnen mit
neuem Passwort nach Neustart. Laut Klaus' Entscheidung vom 22.10.2026 wird jetzt kein
neuer Windows-Installer veröffentlicht; veröffentlicht bleibt 1.0.1 ohne Ersatzschlüssel.

## Releaseablauf unsigniert, ohne Updater (22.10.2026)

Noch nicht ausgeführt. Es gibt dadurch noch keine neue Veröffentlichung.
Veröffentlicht bleibt 1.0.1. Der Quellstand trägt 1.0.3.

`.github/workflows/windows-release.yml` passt jetzt zu Klaus' Wahl: unsignierter
Setup.exe-Installer, keine automatischen Updates, kein Secret, kein Signierkonto,
kein Update-Schlüssel. Der Ablauf folgt dem Weg von 1.0.1: kein Neubau, sondern
genau der Auslieferungsbau aus dem grünen Lauf „Windows-App (Tauri)“ auf demselben
main-Commit. Neu sind: Version muss steigen, `updater.pub` muss leer sein,
Authenticode-Status muss `NotSigned` sein, eine Installationsprobe auf Windows,
Veröffentlichung erst als Entwurf und Rücknahme als Entwurf, wenn der anonyme
Download abweicht. Das Installer-Artefakt bleibt jetzt 90 statt 14 Tage.

Anstoß aus Claude Code (kein `workflow_dispatch` nötig):
`node tools/signing/request-release.mjs windows-v1.0.3`. Das legt den Branch
`release-requests/windows-v1.0.3` auf dem aktuellen main-Commit an.
`release-request.yml` startet dann `windows-release.yml` auf main.

Voraussetzung: Auf dem aktuellen main-Commit muss „Windows-App (Tauri)“ grün sein.
Der Lauf startet nur, wenn ein Commit Dateien unter `windows/`, `native/`,
`upstream/`, `tools/native/` oder `windows-app.yml` ändert. Nach einem reinen
Doku-Commit auf main fehlt dieser Lauf; dann bricht die Veröffentlichung ab.

Einzelheiten: [Windows-Signierung und Updates](../../windows/SIGNIERUNG-UND-UPDATES.md).

## Veröffentlichung 1.0.3 (22.10.2026)

Erster Lauf des neuen unsignierten Ablaufs: `windows-release.yml` Lauf 39802111266 auf main
`4bf83ef`, Installer aus dem grünen `windows-app`-Lauf 39800194808 desselben Commits (dort
auch die Abnahme mit „Version 1.0.3“ im Fuß). Release
[windows-v1.0.3](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/windows-v1.0.3):
`Workflow-PDF-Pro-Windows-1.0.3-Setup.exe`, 15.854.566 Bytes, SHA-256
`4795946f26aac4f1d6e9d37df9c59279b8f66733feccf4f6e8144a181f19ea68`, unabhängig geladen und
verglichen. Unsigniert, ohne automatische Updates. Auf Klaus' Windows-PC nicht gemessen.

## 1.0.4: Direktstart des Scanners, Webkern 1.1.1 (26.10.2026, vorbereitet)

Gleicher Kern wie Android (`upstream/workflow-pdf` = Workflow-PDF `5d32527`), Anker `app.js?v=70` in
`windows/tools/build-web.mjs`; `node windows/tools/build-web.mjs` lokal: 86 Kerndateien, 9 Dialogdateien.
Version 1.0.4 in `windows/package.json`, `tauri.conf.json`, `Cargo.toml`, `Cargo.lock`. Tauri hat keinen
Link-Empfang: der Knopf „Mit Workflow PDF scannen“ in BookLedgerPro öffnet am PC die Web-Fassung; der Scanner
dort ist derselbe. Windows-Bau und WebView2-Abnahme nur in CI (`windows-app`); **nicht veröffentlicht**.

## 1.0.4, zweiter Kernstand: Webkern 1.1.2 (26.10.2026, vorbereitet)

Gleicher Kern wie Android (`upstream/workflow-pdf` = `56b45ec`), `node windows/tools/build-web.mjs` lokal 86 + 9 Dateien. Dazu auf
main (#23): `fsutil::filename` mit NFC und Endungserhalt, `vault::is_commit` byteweise; `windows/core`-Tests laufen auch auf dem
Windows-Läufer. Version 1.0.4. **Nicht veröffentlicht.**
