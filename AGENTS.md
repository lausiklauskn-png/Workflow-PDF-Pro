# Workflow PDF Pro — gemeinsame Arbeitsgrundlage (Codex und Claude Code)

Zuerst lesen: den neuesten `BRIEF_ABSCHLUSS_*` und `BRIEF_NACHFOLGE_*` (nach Datum).
Stand aller Fassungen: `docs/PRODUKTSTAND.md`. Wiederanlauf: `docs/FOLGESITZUNG.md`.
Grundauftrag mit allen Einzelheiten: `BRIEF_NACHFOLGE_2026-10-20_NATIVE_APP.md` (gilt weiter;
lesen, bevor Kern, Schutzfunktionen, Übersetzung oder Speicher berührt werden).
Ältere Zwischenbriefe sind Geschichte.

## Dauerhafte Regeln von Klaus (bewährt, nicht neu verhandeln)

1. **Gleichstand:** Wird eine Fassung (PWA, APK, Windows, iOS) fertig gemacht, ziehen alle anderen
   Fassungen derselben App mit. Gilt für alle Apps von Klaus. Fertig ist eine Arbeit erst, wenn
   alle Fassungen gleich stehen oder `docs/PRODUKTSTAND.md` die Lücke mit Grund nennt.
2. **Nichts vergessen, nichts umschreiben.** Kern bytegleich übernehmen; Geräteanbindung nur in
   Adaptern. Keine Funktion still entfernen, vereinfachen oder ausdünnen. Workflow-PDF und
   `upstream/workflow-pdf` hier nie von Hand ändern; `node tools/onboarding/verify-upstream.mjs`.
3. **Vorher fragen, mit Möglichkeiten:** Vor Kerneingriff, unvermeidbarer Abweichung, komplexer
   Umstellung, neuem externem oder kostenpflichtigem Dienst: 2–4 umsetzbare Varianten mit Begründung,
   Folgen (Bedienung, Daten, Datenschutz, Kosten, offline) und Empfehlung. Antwort abwarten.
   Routine selbst entscheiden. Bereits Entschiedenes nicht erneut fragen (siehe unten).
4. **Ehrlich nachweisen:** Mock, Browser, Emulator/Simulator und echtes Gerät getrennt nennen.
   Übersprungenes zählt nicht als Erfolg. Alte Läufe oder simulierte Übersetzung sind keine neue
   Prüfung. Kein fertiges Produkt behaupten ohne Nachweis; Push, Workflow oder Simulator ist keine
   Veröffentlichung. Neue Tests mit Gegenprobe belegen (Fehler einbauen → Test wird rot).
   „Wacklig“ ist keine Ursache: Ursache suchen statt nur wiederholen. Tests nie abschalten.
5. **Schutzfunktionen** (Prüfer, SBKIM, Schlüsseltresor) unverändert; Hashes nie anpassen, um grün
   zu werden. Prüfung nur auf Knopfdruck; ehrlich „nicht geprüft“/„nicht ganz geprüft“ anzeigen.
   Kein „Virenschutz“, keine Erkennung aller Schadsoftware behaupten. Keine ungefragten Datei-Uploads;
   keine privaten Dokumente als Prüfdaten. Vor Übertragungen: Reinigung, Rückfrage, Abbruch ohne Senden.
6. **Geheimnisse:** keine Schlüssel, Token, Passwörter in Git oder Chat. Eingecheckt sind nur
   `signing/android-release.enc.json` und der Zertifikats-Pin; Freigabe über `WF_PDF_SIGNING_UNLOCK`
   im Environment `android-production`. Signieridentität: `init` war einmalig, danach nur `check`;
   nie ersetzen. App-ID `de.familyprojekt.workflowpdf.pro` bleibt. Keine Private-Brain-Schlüssel.
   GitHub-Recht und Signierschlüssel sind getrennt; jeder Dienst nutzt seine eigene Verbindung.
   Keine Plattform-Zugangsdaten auslesen oder weitergeben.
7. **Release** nur vom geprüften main-Commit, kein Preview-/Testkanal, Version und Buildnummer steigen.
   Android `node tools/signing/request-release.mjs vX.Y.Z` nach grünem `native-acceptance`;
   Windows `… windows-vX.Y.Z` nach grünem `windows-app` (unsigniert, ohne Updater).
   Danach öffentlichen Download erneut laden und per SHA-256 vergleichen. `docs/SIGNIERUNG-UND-GITHUB.md`.
8. **Versionen:** Wer im Kern `CACHE_VERSION` erhöht, erhöht auch die Webversion (Meta und
   `package.json`). Neue App-Version: `versionName`/`versionCode`, `tauri.conf.json`, `Cargo.toml`,
   `windows/package.json`.
9. **Updates bewahren Daten:** als Update installierbar, Einstellungen und Dokumente bleiben.

## Getroffene Entscheidungen (nicht erneut fragen)

- Plattformfolge Android/DeX → Windows → iOS. Android: Capacitor. Windows: Tauri 2, Teile nur unter
  `windows/` und `.github/workflows/windows-*.yml`. iOS: Capacitor, Codex, Zweig `codex/ios-native-host`.
- `native/*.js` wirkt auf alle Plattformen: alle Prüfketten grün halten.
- Übersetzung: Chrome-Variante A; Android mit Vordergrunddienst, sichtbarer Benachrichtigung und
  Abbruch. Für iOS gilt das nicht automatisch: dort neu messen.
- Speicher: interne Arbeitsdatenbank plus verschlüsselter Tresor im gewählten Ordner (Grundgerüst aus
  Private Brain Pro). SD-Karte optional; nie still auf eine leere Bibliothek wechseln. Kein bloßer
  Export als Ablage. `docs/portierung/SPEICHERORT-UND-TRESOR.md`.
- iOS nur vorbereiten und höchstens privat installieren, nicht veröffentlichen. Kein Apple-Konto
  und keine Kosten ungefragt.
- Kleine Korrekturen sammeln und gemeinsam in alle Fassungen bringen (`docs/PRODUKTSTAND.md`).

## Schreibweise und Abschluss

Deutsch, kurze Sätze. Nie „von Microsoft geprüft“. Bestehenden Checkout nutzen, keinen Worktree
ohne Auftrag. Am Ende jeder Sitzung: Abschlussbrief mit Zeitnachweis, Kimhub-Eintrag (`arm: "voll"`),
neuer Nachfolgebrief, Download-Link für Klaus.
