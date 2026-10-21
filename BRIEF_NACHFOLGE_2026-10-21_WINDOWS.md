# Brief für die nächste Sitzung: Workflow PDF Pro für Windows (2026-10-21)

**Auftrag von Klaus (2026-10-21):** Die Windows-Ausgabe von Workflow PDF Pro bauen und veröffentlichen.
Gebaut wird **in diesem Repo** (Workflow-PDF-Pro), von **einer neuen Claude-Code-Sitzung**. Codex arbeitet
in dieser Zeit **nicht** an Windows-Teilen (Klaus' Wahl: „Neue Claude-Code-Sitzung“). Die Reihenfolge
„Android/DeX zuerst, danach Windows, anschließend iOS“ (`docs/portierung/ENTSCHEIDUNGEN.md`) ist damit
bei Schritt 2 angekommen.

Klaus ist kein Programmierer, bedient meist einhändig am Handy, hat keinen eigenen Windows-Bau-PC und
kann keine PRs öffnen. Vorschauen und Ergebnisse bekommt er als **Link**.

## 1. Zuerst lesen

1. `AGENTS.md` und `CLAUDE.md` (gemeinsame Regeln Claude Code/Codex).
2. `BRIEF_NACHFOLGE_2026-10-20_NATIVE_APP.md` vollständig (Grundauftrag: unveränderter Kern, keine
   reduzierte Ausgabe, eigene Identität).
3. `docs/portierung/ENTSCHEIDUNGEN.md`, `FUNKTIONSMATRIX.md`, `SPEICHERORT-UND-TRESOR.md`.
4. `docs/SIGNIERUNG-UND-GITHUB.md` (Muster für Schlüssel nur verschlüsselt im Repo, Freigabe nur in Actions).
5. `docs/portierung/BAUSTAND-ANDROID.md`, Abschnitt 1.0.1: Stand der Android-App.

## 2. Ausgangsstand (geprüft am 2026-10-21)

- Android **1.0.1** ist veröffentlicht (versionCode 2, App-Commit `46ee4ce`, Release-Lauf 39634219828,
  APK 83.110.198 Bytes). Windows hat **noch keinen Code**: kein Host, keine Workflows, kein Installer.
- Der Webkern liegt bytegleich unter `upstream/workflow-pdf` (`npm run verify:upstream`). Er wird nicht
  abgewandelt. Die Gerätefunktionen hängen in `native/*.js` an Capacitor-Plugins (Android).
- Für Windows gibt es heute nur die PWA (`https://lausiklauskn-png.github.io/Workflow-PDF/`) in Chrome oder Edge.

## 3. Vor dem Bauen: kurzer Plan an Klaus, mit Empfehlung

Plan-vor-Code gilt. Diese Punkte entscheidet Klaus. Jeweils eine Empfehlung geben, in einfachen Worten:

| Frage | Möglichkeiten | Hinweis |
|---|---|---|
| Host | **Tauri 2** (WebView2 von Windows, kleine Datei) · Electron (eigenes Chromium, ~100 MB mehr) | Bei Tauri auch prüfen, ob WebView2 `Translator`/`window.print`/Dateiauswahl genauso kann wie die Android-WebView. Messen, nicht annehmen. |
| Paket | MSI oder NSIS-Setup (`.exe`) · MSIX | Ohne Code-Signatur warnt Windows SmartScreen („Unbekannter Herausgeber“). |
| Signatur | zunächst unsigniert mit klarem Hinweis · Zertifikat (OV/EV, kostet jährlich) · Azure Trusted Signing | Kosten und Konto liegen bei Klaus. Nie „von Microsoft geprüft“ schreiben. |
| Speicherort | Arbeitsdatenbank in `%APPDATA%` + frei gewählter Rechnerordner/USB-Laufwerk als verschlüsselte Hauptablage | Wie unter Android (`SPEICHERORT-UND-TRESOR.md`): Ordnerwechsel ohne Datenverlust, keine stille leere Ersatzbibliothek. |
| Chrome-Übersetzung (Variante A) | Übergabe an installiertes Chrome/Edge und Rückweg | Unter Windows eigener Weg nötig. Vorher mit Klaus besprechen, falls A dort nicht trägt. |

### Codex' Vorschlag vom 2026-10-21 (von Klaus weitergegeben, deckt sich mit diesem Brief)

- Ein gemeinsamer Anwendungscode, daraus parallel Android-APK und Windows-Installer (`Workflow-PDF-Pro-Setup.exe`
  oder `.msi`, auf Wunsch zusätzlich portabel). Dateiauswahl, Speichern, Drucken, Teilen je Plattform angebunden.
- Bevorzugt **Tauri**; Electron nur, wenn die PDF-Verarbeitung eine mitgelieferte Chromium-Umgebung braucht.
  **Zuerst prüfen** (Webkern, pdf.js/pdf-lib/Tesseract/WASM, Android-Abhängigkeiten in `native/`), dann mit Tauri erproben
  und das Ergebnis mit Klaus entscheiden.
- Eine freigegebene Version (z. B. Tag `v1.x.y`) baut **beide** Pakete aus demselben Stand und veröffentlicht sie mit
  Versionshinweisen. Nicht jeder Commit geht an Nutzer.
- Die Windows-App prüft eine Update-Adresse und bietet „Version x ist verfügbar – herunterladen und installieren“ an,
  mit signierten Update-Paketen (Tauri-Updater-Schlüssel nur verschlüsselt/als Secret, nie in Git oder Chat).
- Android bei direktem APK-Download: Update-Hinweis in der App, Installation bestätigt der Nutzer.
- Eine neue Browserfassung (PWA) aktualisiert installierte Apps nicht; dafür ist die Veröffentlichungskette da.

## 4. Bauen

- Eigener Ordner (z. B. `windows/`) und eigene Adapter (`native/windows-*.js` oder ein Brückenmodul).
  Android-Dateien nicht umbauen. Gemeinsames nur, wenn beide Prüfketten grün bleiben.
- Gleicher Funktionsumfang wie Android 1.0.1 (`FUNKTIONSMATRIX.md`). Was unter Windows nicht geht, steht
  als benannte Grenze in der Matrix, nicht still weggelassen.
- Offline: Kern, Schriften, pdf.js, Tesseract lokal im Paket. Keine Fern-Webseite als App-Inhalt.
- Eigene, feste Windows-Kennung (z. B. `de.familyprojekt.workflowpdf.pro`), Version 1.0.x passend zu Android.

## 5. Prüfen und veröffentlichen (auf GitHub, nicht lokal)

- Neuer Workflow mit `runs-on: windows-latest`: Bauen, Installer erzeugen, still installieren, App starten,
  Grundfälle per WebDriver/Playwright gegen WebView2 (Einlesen, Felder, PDF-Ausgabe, Tresorordner,
  Sicherung), deinstallieren, erneut installieren mit Datenerhalt.
- Release über `workflow_dispatch`, nur von geprüftem `main`-Commit. Neben dem Installer: SHA-256-Datei.
  Danach **unabhängig herunterladen** und Prüfsumme und Größe vergleichen.
- Dieselbe Ehrlichkeit wie bei Android: Der Windows-Runner ist **kein** echter Rechner von Klaus.
  „Am Windows-PC nicht gemessen“ steht im Baustand, bis Klaus es bestätigt.

## 6. Danach

- Link für Klaus: direkter Download des Installers plus zwei Sätze (SmartScreen: „Weitere Informationen“ →
  „Trotzdem ausführen“, falls unsigniert).
- Geschenk-Seite „Workflow PDF Pro“ (Claude-Artefakt `https://claude.ai/artifact/7dK5kDLqY4tmKqzU9jK4aA`,
  aus der Private-Brain-Pro-Sitzung) bekommt dann einen dritten Weg „Windows“ mit Version.
- Baustand, `FUNKTIONSMATRIX.md`, `README.md` und `AGENTS.md` nachziehen.

## Nicht tun

- Den Kern unter `upstream/` oder das Quellrepo Workflow-PDF ändern.
- Android-Signieridentität für Windows verwenden oder Schlüssel in Git/Chat legen.
- Eine Vorschau oder reduzierte Fassung als fertige Windows-App ausgeben.
- Parallel zu Codex dieselben Dateien ändern: vor dem Start `git log origin/main` und offene PRs ansehen.
