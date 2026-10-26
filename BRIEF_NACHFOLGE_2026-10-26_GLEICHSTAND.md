# Brief für die nächste Sitzung (nach dem Direktstart-Gleichstand)

**Von:** Claude Code, `session_01GhWv1RmzjCFEur8Bq4RwQ3`, 26.10.2026.
**Zuerst lesen:** `AGENTS.md`, `docs/PRODUKTSTAND.md`, `BRIEF_ABSCHLUSS_2026-10-26_DIREKTSTART.md`.
**Klaus (26.10.):** nur Claude Code; Codex wird für diese Sitzungen nicht angerührt.

## Stand

- Web 1.1.2 (Direktstart; Worker löscht nur eigene Schalen) live. Pro 1.0.4 (Kern 1.1.2, Windows-Fixes, Buildnummer 5) auf main vorbereitet, **nicht veröffentlicht**.
- Veröffentlicht bleiben Android 1.0.3 und Windows 1.0.3.

## Nächste Schritte (nur mit Klaus' Wort, wo markiert)

1. **Veröffentlichen 1.0.4** (Klaus' Wort): main grün in `native-acceptance` und `windows-app` prüfen, dann
   `node tools/signing/request-release.mjs v1.0.4` und `… windows-v1.0.4`; Downloads laden, SHA-256 vergleichen,
   `docs/PRODUKTSTAND.md`, `README.md`, `docs/ANDROID-START.md` auf 1.0.4 stellen.
2. ~~Codex-Entwürfe~~ **erledigt am 26.10.:** Inhalt von Workflow-PDF #131 und Workflow-PDF-Pro #20 ist hier neu gebaut
   (Workflow-PDF #133 → Kern 1.1.2; Pro #23 und #24). Die Entwürfe selbst bleiben unberührt (Klaus: Codex wird nicht angerührt).
3. Optional: Android-App-Link für `https://lausiklauskn-png.github.io/Workflow-PDF/` in der Pro-App, damit der
   BookLedgerPro-Knopf die App statt der Web-Fassung öffnet. Nur mit Gerätemessung.
4. Sammelliste in `docs/PRODUKTSTAND.md` (Zurück-Pfeil im Handy-Editor) mitnehmen.
