# Workflow PDF Pro — gemeinsame Arbeitsgrundlage

- Verbindlich: `BRIEF_NACHFOLGE_2026-10-20_NATIVE_APP.md` vollständig lesen.
  Der Quellcheckout Workflow-PDF und `upstream/workflow-pdf` bleiben unverändert;
  `node tools/onboarding/verify-upstream.mjs` prüft die bytegleiche Übernahme.
- Entscheidungen: Android/Samsung DeX zuerst, Windows danach, iOS anschließend.
  Chrome-Variante A ist zur Erprobung gewählt. Neue wesentliche Abweichungen
  vorher mit Klaus anhand konkreter Möglichkeiten besprechen.
- Bestand und aktuelle Nachweise: `docs/portierung/README.md`.
  Historische Tests oder simulierte Übersetzung sind keine neuen Geräteprüfungen.
- Verbindlicher zusätzlicher Speicherauftrag: `docs/portierung/SPEICHERORT-UND-TRESOR.md`
  lesen. SD-Karte/frei gewählter Ordner für Dokumente und App-Arbeitsdaten,
  Private-Brain-Pro-Speicher-/Tresor-Grundgerüst wiederverwenden. Kein bloßer
  Export als vollständige externe Ablage; komplexe Kernanbindung vorher besprechen.
- Signierung und GitHub-Zugang für Claude Code **und** Codex:
  `docs/SIGNIERUNG-UND-GITHUB.md` lesen. Beide verwenden denselben Release-Workflow.
  GitHub-Anmeldung und Android-Signierschlüssel sind getrennte Berechtigungen.
- Keine Schlüssel/Token/Passwörter im Klartext in Git oder Chat. Nur das
  AES-GCM-Paket `signing/android-release.enc.json` und dessen öffentlicher
  Zertifikats-Pin dürfen eingecheckt werden. Entschlüsselungsfreigabe separat
  im GitHub-Environment-Secret `WF_PDF_SIGNING_UNLOCK` für `android-production`.
- Vorhandene App-Identität niemals ersetzen; Private-Brain-Schlüssel nicht
  übernehmen. `init` ist einmalig; danach `check` und dieselbe Identität nutzen.
- Reguläre Releases nur vom vollständig geprüften main-Commit, ohne Preview-/
  Testkanal; Version und Android-Buildnummer müssen steigen. Kein fertiges
  Produkt behaupten, solange native Implementierung oder Nachweise fehlen.
- Bestehende Checkouts verwenden; ohne ausdrücklichen Auftrag keinen Worktree
  erzeugen. Agenten dürfen keine Plattform-Zugangsdaten auslesen oder übertragen.
