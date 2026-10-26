# Abschluss: Gleichstand Direktstart (Webkern 1.1.1 → Pro 1.0.4 vorbereitet)

**Sitzung:** Claude Code, `session_01GhWv1RmzjCFEur8Bq4RwQ3`, 26.10.2026 (BookLedgerPro-Bau-Brief, Schritt 2).
**Auftrag (Klaus, 26.10.2026):** „du darfst Workflow für den Direktstart anfassen. PWA, Android und Windows gleich.“
Und: „Ich arbeite hier nur in Claude Code. Codex wird für diese Sessions hier nicht angerührt.“

## Zeitnachweis (gemessen, UTC)

| Block | Beginn | Ende | Beleg |
|---|---|---|---|
| Workflow-PDF PWA: Direktstart `./?scan=1&von=<App>`, Proben, PR #132, Merge | 26.10. vormittags | 26.10. ~09:50Z | Workflow-PDF main `5d32527` |
| Workflow-PDF-Pro: Kern nachziehen, Anker, Version, Proben, Doku, PR | 2026-10-26T10:03Z | Commit dieses Briefs | Reflog (Checkout des Zweigs) |

Die PWA-Arbeit lief in derselben Sitzung innerhalb des BookLedgerPro-Auftrags; genaue Startzeit dort nicht
getrennt gemessen.

## Ergebnis

- `upstream/workflow-pdf` bytegleich auf Workflow-PDF `5d32527f01e4fb5eaadca74a5e6b769b13a92641` (194 Dateien,
  neu `tests/direktstart.mjs`; `verify-upstream` 0 Abweichungen). Manifest und Quellindices neu erzeugt
  (gleiches Skript wie `tools/onboarding/inventar.py`, nur mit Pfaden als Argumente).
- Anker `assets/app.js?v=70` in `tools/native/prepare-web.mjs` und `windows/tools/build-web.mjs`.
- Gemeinsame Version 1.0.4, Android-Buildnummer 5 (`build.gradle`, `package.json`/Lock, `windows/package.json`/Lock,
  `tauri.conf.json`, `Cargo.toml`/`Cargo.lock`). Paketkennung und Signieridentität unverändert.
- Lokal (Linux-Behälter): `build:web` 86 Dateien · `test:native-web` 33/33 · `test-request-release` und
  fünf Tresor-Proben 42/42 · Windows-Bündel 86 + 9. Die Originalkette des Kerns (`npm test` im Kern) lief am
  selben Quellstand im Workflow-PDF-Checkout: `direktstart` 16, `teilen-empfang` 23, `version` 12, `sprache` 49,
  `syntax` 75, `scan` 119, `bibliothek` 90, `e2e` 78, alle 0 ROT (Chromium des Behälters). Gegenprobe
  Direktstart: Vorbelegung entfernt → 2 rote Zeilen mit Namen.
- Doku: `docs/PRODUKTSTAND.md`, `docs/portierung/BAUSTAND-ANDROID.md`, `BAUSTAND-WINDOWS.md`, `README.md`.

## Nachtrag (später am 26.10.)

- #23 übernommen: Windows-Kern-Fixes (Unicode-Dateinamen behalten die Endung, `is_commit` byteweise) — die Befunde aus dem
  Codex-Entwurf #20, hier neu gebaut, Gegenprobe mit alter Quelle rot/Panik.
- #24 übernommen: Kern **1.1.2** bytegleich (Workflow-PDF #133, hier gebaut: Worker löscht nur noch eigene Schalen,
  Kopfzeile mit breiter Schrift, Browser-CI). Version bleibt 1.0.4 / Code 5, **unveröffentlicht**.
- Klaus (26.10.): nur Claude Code, Codex wird nicht angerührt; die Entwürfe #20/#131 bleiben unberührt, ihr Inhalt ist nachgebaut.

## Nicht gemacht, ehrlich

- **Keine Veröffentlichung.** 1.0.4 steht nur im Quellstand. Release erst auf Klaus' Wort und nach grünem
  `native-acceptance` (Android) bzw. `windows-app` (Windows) auf main, dann `request-release.mjs`.
- Kein Android-App-Link für die Web-Adresse (die Pro-App nimmt keine https-Links an). Der `intent://`-Link aus
  BookLedgerPro fällt sonst auf die Web-Fassung zurück; der Scanner geht dort genauso.
- Emulator, Gerät (Tab S6, S21), Windows-PC: nicht gemessen; nur CI.
- Kimhub-Eintrag: in dieser Sitzung nicht geschrieben (Repo nicht im Zugriff der Sitzung). Nachtragen.
- Codex' Entwürfe Workflow-PDF #131 und Workflow-PDF-Pro #20 bleiben unberührt (Klaus' Wort). Hinweis: #131
  behebt, dass Workflow PDFs Worker fremde Vorräte desselben Ursprungs löscht; das betrifft auch BookLedger.

## Downloads (unverändert)

- Android 1.0.3: <https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/v1.0.3>
- Windows 1.0.3: <https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/windows-v1.0.3>
- Web 1.1.1: <https://lausiklauskn-png.github.io/Workflow-PDF/> (Pages-Lauf nach #132)
