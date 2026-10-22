# Abschluss: Windows 1.0.1, Ersatzschlüssel 3 von 5, Android 1.0.2

Sitzung von Claude Code `session_01RyZfm7xfj7vsZnGGohhrFY`, Stand 22.10.2026.
Die Sitzung lief parallel zu Codex. Codex hat Windows 1.0.2 (Updater, Signierablauf,
CSP) und den Windows-Abschlussbrief `BRIEF_ABSCHLUSS_2026-10-22_WINDOWS.md` beigetragen.

## Zeitnachweis

| | UTC | Quelle |
|---|---|---|
| Beginn | 2026-10-21T19:46Z | Reflog `checkout: moving from main to claude/windows-tauri-probe` 19:45:10Z, aufgerundet |
| erster Commit | 2026-10-21T19:48Z | `33ec544` Tauri-2-Messprobe |
| letzter Arbeitscommit vor diesem Brief | 2026-10-22T13:17Z | `0b0566c` Download-Links 1.0.2 |

Die Spanne ist eine **Obergrenze**. Nachtpausen und Wartezeiten auf Codex und GitHub
sind nicht abgezogen. Brief und Forschungseintrag kamen danach.

## Was fertig ist

1. **Windows-App mit Tauri 2** (PR #11, #12). Sie läuft in WebView2 mit unverändertem
   Webkern und einer Capacitor-kompatiblen Brücke, sodass `native/*.js` unverändert
   läuft. Dazu kommt ein Rust-Kern mit demselben Tresorformat wie Android.
   Veröffentlicht ist **windows-v1.0.1** (unsigniert, ohne automatische Updates).
   Die Geschenkseite hat eine Windows-Karte.
2. **Ersatzschlüssel 3 von 5** für den Ordner-/SD-Tresor (PR #14, Merge `1a31272`).
   - Format: Shamir über GF(256), Teile `WFP1-…` mit Prüfsumme.
   - Android und Windows erzeugen und lesen dieselben Teile. Das zeigt die Gegenprobe
     `windows/core/compat/run.sh`.
   - Bedienung: Einstellungen → Speicher und Dokumenttresor → Ersatzschlüssel erzeugen.
     Im Passwortfenster steht „Passwort vergessen?“.
   - Die Teile gelangen nie in die Webseite.
3. **Android 1.0.2** veröffentlicht:
   [v1.0.2](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/v1.0.2).
   - Lauf 39779355145. Der erste publish-Versuch scheiterte an einem vorübergehenden
     `uiautomator dump`; die einmalige Wiederholung lief grün.
   - APK: 83.126.582 Bytes, SHA-256
     `405e49f56a6d9b0315e8ec2843f6050fec842a7e849c5bfef8232d95c07b5ba7`.
   - Der Download wurde unabhängig geladen und verglichen.
4. **Doku**: ANDROID-START, SPEICHERORT-UND-TRESOR, BAUSTAND-ANDROID und
   BAUSTAND-WINDOWS sind nachgezogen. Die Links stehen auf 1.0.2; die
   Geschenkseite (Artifact) zeigt Android 1.0.2.

## Offen

- **PR #15** (Links, Nachweis, robustere Installationsprobe):
  - `android-foundation` fiel einmal mit dem bekannten `NativeChromeTest` „Connection
    reset“ aus (wie bei PR #11).
  - Die Wiederholung läuft. Danach mergen.
  - Die Ursache dieses Ausfalls ist nicht behoben. Er liegt im Test, nicht in der App.
- **Ersatzschlüssel am Gerät**: Anzeige- und Eingabefenster unter Android sind nicht
  per UI-Test geprüft. Klaus' Sichttest am Tablet steht aus.
- **Windows**: Der Quellstand enthält Ersatzschlüssel und 1.0.2-Härtung, ist aber nicht
  veröffentlicht (Klaus: vorerst keine Signierung, kein Update-Schlüssel).
  `windows-release.yml` verlangt noch Signierung und muss vor dem nächsten
  Windows-Release umgebaut werden. Siehe den Windows-Abschluss.
- **Neuer Auftrag von Klaus**: Versionsnummer anzeigen, Knopf „Alle prüfen“,
  Erklärvideo ergänzen, Musik ohne Lücken. Steht im
  [Nachfolgebrief](BRIEF_NACHFOLGE_2026-10-22_VERSION-UND-VIDEO.md).

## Befunde dieser Sitzung (Auswahl)

- CRLF beim Auschecken unter Windows veränderte Quelldateien. Die Prüfsummen der
  übernommenen Dateien schlugen an. Behoben über `.gitattributes`/Checkout.
- Die CDP-Fernsteuerung der WebView2 brauchte ein eigenes Prüf-Feature
  (`messprobe`). Alle Dialogfenster brauchen dieselben Browser-Argumente.
- Die Java-Gegenprobe mit „ä“ im Passwort scheiterte ohne Locale an argv. Gelöst mit
  einer UTF-8-Datei.
- Codex' Windows-Releaseablauf erzwingt Signierung. Das widerspricht Klaus' späterer
  Entscheidung; es ist benannt, aber nicht umgebaut.
- `verify-signed-install.py` brach bei einem vorübergehenden Fehler des
  Bildschirm-Auslesens ab, statt neu zu lesen. Behoben in PR #15.
