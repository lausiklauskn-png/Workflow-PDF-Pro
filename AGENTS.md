# Workflow PDF Pro — gemeinsame Arbeitsgrundlage (Codex und Claude Code)

Zuerst lesen: den neuesten `BRIEF_ABSCHLUSS_*` und `BRIEF_NACHFOLGE_*` (nach Datum).
Stand aller Fassungen: `docs/PRODUKTSTAND.md`. Wiederanlauf: `docs/FOLGESITZUNG.md`.
Ältere Briefe sind Geschichte; nur lesen, wenn ein neuer Brief darauf verweist.

## Immer gültig

- **Gleichstand:** Wird eine Fassung (PWA, APK, Windows, iOS) fertig gemacht, ziehen alle anderen
  Fassungen derselben App mit. Gilt für alle Apps von Klaus. Fertig ist eine Arbeit erst, wenn
  alle Fassungen gleich stehen oder `docs/PRODUKTSTAND.md` die Lücke mit Grund nennt.
- **iOS** nur vorbereiten und höchstens privat installieren, nicht veröffentlichen.
  Kein Apple-Konto und keine Kosten ungefragt.
- **Kern:** Workflow-PDF und `upstream/workflow-pdf` hier nie von Hand ändern. Kernänderungen im
  Repo Workflow-PDF, dann übernehmen; `node tools/onboarding/verify-upstream.mjs` muss bestehen.
- **Versionen:** Wer im Kern `CACHE_VERSION` erhöht, erhöht auch die Webversion (Meta und
  `package.json`). Neue App-Version: `versionName`/`versionCode`, `tauri.conf.json`, `Cargo.toml`,
  `windows/package.json`.
- **Release** nur vom geprüften main-Commit, Version steigt:
  Android `node tools/signing/request-release.mjs vX.Y.Z` nach grünem `native-acceptance`;
  Windows `… windows-vX.Y.Z` nach grünem `windows-app` (unsigniert, ohne Updater).
  Details: `docs/SIGNIERUNG-UND-GITHUB.md`.
- **Geheimnisse:** keine Schlüssel, Token oder Passwörter in Git oder Chat. Nur das AES-GCM-Paket
  `signing/android-release.enc.json` und sein Zertifikats-Pin sind eingecheckt; Freigabe über
  `WF_PDF_SIGNING_UNLOCK` im Environment `android-production`. Signieridentität nie neu
  anlegen oder ersetzen; App-ID `de.familyprojekt.workflowpdf.pro` bleibt.
  Keine Private-Brain-Schlüssel übernehmen.
- **Speicher:** interne Arbeitsdatenbank plus verschlüsselter Tresor im gewählten Ordner.
  SD-Karte optional; nie still auf eine leere Bibliothek wechseln. `docs/portierung/SPEICHERORT-UND-TRESOR.md`.
- `native/*.js` wirkt auf Android **und** Windows (und iOS): alle Prüfketten grün halten.
- Kein fertiges Produkt behaupten ohne Nachweis. Push, Workflow oder Simulator ist keine Veröffentlichung.
- Bestehenden Checkout nutzen, keinen Worktree ohne Auftrag. Keine Plattform-Zugangsdaten auslesen.
- Wesentliche Abweichungen vorher mit Klaus besprechen; Routine selbst entscheiden.

## Schreibweise und Abschluss

Deutsch, kurze Sätze. Nie „von Microsoft geprüft“, kein „Virenschutz“.
Am Ende jeder Sitzung: Abschlussbrief mit Zeitnachweis, Kimhub-Eintrag (`arm: "voll"`),
neuer Nachfolgebrief, Download-Link für Klaus.
