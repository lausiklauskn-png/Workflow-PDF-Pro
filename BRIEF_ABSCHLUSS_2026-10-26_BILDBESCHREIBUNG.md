# Abschluss 26.10.2026 – Bildbeschreibung (Gleichstand mit Workflow-PDF 1.1.3)

**Von:** Claude Code, `session_01W9Ch8voxfysZZZsm4tJkN7`, 26.10.2026, Sitzung 4 des Designumbaus von Private Brain Pro
(Punkte 12–14 der [Sammlung](https://github.com/lausiklauskn-png/Privat-Brain-Pro/blob/main/docs/design/aenderungen-2026-10-26/SAMMLUNG.md)).
**Klaus:** „Die soll Workflow PDF Pro und Workflow PDF bekommen. Auch die Suche … Alle.“ Name überall **„Bildbeschreibung“**.

## Was im Kern neu ist (Workflow-PDF `3bf07ab`, 1.1.3, Cache v108)

- `assets/bildbeschreibung.js` (neu) mit fünf Nähten in `app.js`; Feld „Bildbeschreibung“ an jeder Foto-Karte und im
  Editor (eigene Worte per Text oder Mikrofon, getrennt von der Modellbeschreibung, beide in der Wortsuche mit
  Fundzeile); Schalter + ⓘ + „Fotos beschreiben lassen“ in einer flachen Zeile unter der Suche; Modell
  `Xenova/vit-gpt2-image-captioning` (transformers.js 2.17.2) erst auf Knopfdruck, Balken mit MB, gemessene Zahlen im
  Dialog (256 MB Download, 1,2 GB Arbeitsspeicher in der Spitze, ~3 s je Foto – Prüfrechner, nicht Tablet).
- 34 neue Sätze DE/EN/RU/AR, `impressum.html` 4d, keine Emojis.
- Proben: `tests/bildbeschreibung.mjs` (50 grün, in `npm test`), Gegenprobe 14 Fälle, 14 gefangen; `npm test` grün.

## Was hier nachgezogen ist

- `upstream/workflow-pdf` = `3bf07ab`, 200 Dateien, `verify-upstream` 0 Abweichungen; Manifest und Quellindices
  neu erzeugt (Skript wie `tools/onboarding/inventar.py` mit Pfaden als Argumente).
- Anker `app.js?v=71` in `tools/native/prepare-web.mjs` (zweimal) und `windows/tools/build-web.mjs`.
- `native/native-bootstrap.js`: `sourceCommit` = `3bf07ab…` (stand seit 1.0.3 auf `db3830e`; die Quittung
  `native-bundle.json` nimmt ohnehin den Manifest-Commit).
- Version **1.0.5**, Android-Buildnummer **6** (`build.gradle`, `package.json`+lock, `windows/package.json`+lock,
  `tauri.conf.json`, `Cargo.toml`+lock). Paketkennung und Signieridentität unverändert.
- `docs/PRODUKTSTAND.md`: Übersicht und Abschnitt „Gleichstand Bildbeschreibung“.

## Geprüft

- `npm run verify:upstream` 0 Abweichungen · `npm run test:native-web` (Bündel, Dateiadapter, Ordnerimport,
  Empfang, Tresor, Chrome-Helfer, Sprache, Übersetzung): **33 bestanden, 0 fehlgeschlagen** (lokal, Chromium des Behälters).
- Nicht gemessen: Gerät (Android/Windows), Arbeitsspeicher der WebView beim Beschreiben, Modell auf family-projekt.de.

## Nicht getan (Klaus' Wort nötig)

- Übernahme des Entwurfs-PR und Veröffentlichung 1.0.5 (Android `request-release.mjs v1.0.5` nach grünem
  `native-acceptance`, Windows `windows-v1.0.5` nach grünem `windows-app`); dann `README.md`, `docs/ANDROID-START.md`,
  Produktstand auf 1.0.5. Die vorbereitete 1.0.4 ist damit überholt (nie veröffentlicht).
