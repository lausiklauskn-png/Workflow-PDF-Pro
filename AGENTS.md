# Workflow PDF Pro — gemeinsame Arbeitsgrundlage

- Wiederaufnahme, tatsächliche Zugriffsprüfung und Bauumgebung: `docs/FOLGESITZUNG.md`.
  **Neueste Übergabe (22.10.2026, abends):** `BRIEF_ABSCHLUSS_2026-10-22_VERSION-UND-VIDEO.md`
  (Android 1.0.3 und Windows 1.0.3 veröffentlicht, Web 1.1.0, Video mit Prüfteil) und
  `BRIEF_NACHFOLGE_2026-10-22_NACH-VERSION-UND-VIDEO.md` (nächster Schritt iOS).
  Windows-Releases jetzt unsigniert ohne Schlüssel über `request-release.mjs windows-vX.Y.Z`.
  Davor: `BRIEF_ABSCHLUSS_2026-10-22_ERSATZSCHLUESSEL.md` (Android 1.0.2).
  Eigene bestehende GitHub-Verbindung nutzen; Signierfreigabe bleibt in Actions.
  Neueste Übergabe vom 22.10.2026: `BRIEF_ABSCHLUSS_2026-10-22_WINDOWS.md` und
  `BRIEF_NACHFOLGE_2026-10-22_IOS.md`. Windows vorerst beendet; iOS ist die nächste Sitzung.
  Windows bleibt vorerst bei manuellen unsignierten Installern ohne Update-Schlüssel;
  der vorbereitete Releaseablauf verlangt technisch noch Signierung und ist vor
  einer späteren Windows-Veröffentlichung entsprechend zu korrigieren.
  Aktueller Zusatzbrief: `BRIEF_NACHFOLGE_2026-10-21_ANDROID_APK_AUSGELIEFERT.md`.
  Windows (Tauri 2, Claude Code): `BRIEF_NACHFOLGE_2026-10-21_WINDOWS.md`, Stand in
  `docs/portierung/BAUSTAND-WINDOWS.md`. Windows-Teile liegen nur unter `windows/` und in
  `.github/workflows/windows-*.yml`; `native/*.js` laufen dort unverändert über eine Brücke.
  Änderungen an `native/*.js` wirken auf Android **und** Windows: beide Prüfketten grün halten.
  Historische Baufortsetzung: `BRIEF_NACHFOLGE_2026-10-21_APP_FERTIGSTELLEN.md`.

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
  SD ist optional: vollständiges Arbeiten im Gerätespeicher und später unter
  Windows mit frei gewähltem Rechnerordner erhalten. Gewählt ist die Kombination
  aus interner Arbeitsdatenbank und verschlüsseltem Ordner als Hauptablage.
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
