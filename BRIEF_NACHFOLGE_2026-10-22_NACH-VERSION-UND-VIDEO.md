# Brief für die nächste Sitzung (nach Version, „Alle prüfen“ und Video)

**Von:** Claude-Code-Sitzung `session_01B4oBviErACQexqctbJbz76`, 22.10.2026.
**Zuerst lesen:** `AGENTS.md`, `BRIEF_ABSCHLUSS_2026-10-22_VERSION-UND-VIDEO.md`.

## Stand

- Workflow-PDF (Web) 1.1.0, Android 1.0.3, Windows 1.0.3 (unsigniert, ohne Updater) sind veröffentlicht.
- Das Erklärvideo hat den Prüfteil; die Musik läuft ohne Lücke.
- Windows-Releases gehen jetzt ohne Schlüssel:
  `node tools/signing/request-release.mjs windows-vX.Y.Z` (nur nach grünem `windows-app` auf demselben
  main-Commit). Android unverändert: `node tools/signing/request-release.mjs vX.Y.Z` nach grünem
  `native-acceptance`.
- Versionsregel: Wer im Kern `CACHE_VERSION` erhöht, erhöht auch die Webversion (Meta + package.json).
  Eine neue App-Version erhöht `versionName`/`versionCode` und `tauri.conf.json`/`Cargo.toml`/`windows/package.json`.

## Nächster Auftrag

Nach Klaus' Plan: **iOS** — `BRIEF_NACHFOLGE_2026-10-22_IOS.md`. Vorher Klaus fragen, ob seine
Sichttests (Tablet, Windows-PC, Video hochkant) etwas ergeben haben.

## Kleine offene Punkte (nur auf Klaus' Wort)

1. Im russischen Hochformat liegt „← Библиотека“ in der Editor-Leiste außerhalb des Bildes.
2. Android-12-Emulator in `native-acceptance` wacklig: `NativeIncomingTest.warmStartsWithSameAction…`
   und leere UI in `verify-signed-install.py`. Ursache suchen statt wiederholen.
3. Video: helle Schlussfolien, ruhige Stelle beim Übersetzen, Seitenfehler am Übergang Prüfen → Ausfüllen.

## Regeln

Deutsch, kurze Sätze. Keine Schlüssel oder Passwörter in Git oder Chat. Nie „von Microsoft geprüft“.
Kein „Virenschutz“. Am Ende: Abschlussbrief mit Zeitnachweis, Kimhub-Eintrag (`arm: "voll"`),
neuer Brief, Download-Link für Klaus.
