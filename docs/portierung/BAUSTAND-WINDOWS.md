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
