# Nachfolgeauftrag vom 21.10.2026: Workflow PDF Pro fertigstellen

Arbeite im Repository https://github.com/lausiklauskn-png/Workflow-PDF-Pro.
Dieser Auftrag gilt für Codex und Claude Code. Setze den begonnenen Bau fort,
bis die vollständige reguläre Android-App als direkt installierbare, mit der
bestehenden Identität signierte APK bereitgestellt werden kann. Keine reduzierte
Test-/Preview-App als fertiges Produkt ausgeben. Windows danach, iOS anschließend.

## 1. Den richtigen Arbeitsstand übernehmen

Der Bau liegt auf `codex/native-android-build`, **nicht vollständig auf main**.
Entwurf-PR: https://github.com/lausiklauskn-png/Workflow-PDF-Pro/pull/8.
Letzter Stand vor diesem Brief: `527ea3bb8c14a0fc10f224012ae52fd4ca4def51`.
Damals Pro-main: `f403aa1188232e2679fe664ebbdc2a6301ce6106`.
Vor dem Fortsetzen Remote-Stände, lokale Änderungen und Parallelbranches prüfen.
Vorhandene Arbeit nicht überschreiben, keinen Reset/Force-Push und ohne Auftrag
keinen Worktree anlegen. Bei sauberem Checkout den geprüften Bauzweig verwenden;
bei Änderungen zuerst deren Herkunft und Erhaltung klären.

Vollständig lesen:
- `AGENTS.md` und `BRIEF_NACHFOLGE_2026-10-20_NATIVE_APP.md` (weiterhin verbindlich).
- `docs/FOLGESITZUNG.md`, `docs/SIGNIERUNG-UND-GITHUB.md`.
- `docs/portierung/README.md`, `FUNKTIONSMATRIX.md`, `ENTSCHEIDUNGEN.md`,
  `SPEICHERORT-UND-TRESOR.md`, `BAUSTAND-ANDROID.md` und `PRUEFSTAND.md`.
- Im Quellrepo Workflow-PDF: die gesamte `CLAUDE.md`, `README.md`, `docs/TODO.md`,
  relevante Briefe/Abschlüsse unter `docs/sessions/`, Schutzvorgaben und Tests.

## 2. Bewährten Kern und sämtliche Funktionen erhalten

Workflow-PDF bleibt unverändert. Letzter erneut gelesener Quell-main:
`7227c543d4a536cf8f3354a56fbba7574645703e`.
191 Dateien wurden bytegleich nach `upstream/workflow-pdf` übernommen.
Herkunftsprüfung: `node tools/onboarding/verify-upstream.mjs`.
Aktuelle Quelle erneut vergleichen; neue Änderungen nicht ungeprüft übernehmen.

Die vollständige Funktionsmatrix ist maßgeblich: Bibliothek, PDF-Editor/Formulare,
Scan/Kamera/OCR, alle Ausgaben, alle Übersetzungswege, Suche/Sprache, Schutzprüfungen,
Reinigung/Abbruch, Originale, Arbeitsstände, Sicherung, DE/EN/RU/AR einschließlich
RTL, Hilfe/Videos, Mycel/SBKIM und sämtliche Einstellungen erhalten.
Geräteanbindungen getrennt ergänzen. Keine Schutzpins/Prüfsummen ändern, um
Eingriffe grün zu machen. Keine Funktion still streichen oder umschreiben.

Bei notwendigen wesentlichen Abweichungen oder komplexen Umstellungen VORHER
Klaus mehrere konkrete Möglichkeiten mit Begründung, Vor-/Nachteilen, Folgen
für Daten/Bedienung/Offlinebetrieb/Kosten und einer Empfehlung vorlegen;
die konkrete Entscheidung abwarten. Unabhängige Arbeit weiterführen.
Bestehende Schutzgrenzen ehrlich erhalten: kein allgemeiner Virenscanner,
normale Importe manuell prüfen, keine kryptografisch bestätigte C2PA-Signatur
behaupten. Vor externen Übertragungen Reinigung, Rückfrage und Abbruch erhalten.

## 3. Getroffene Speicher- und Übersetzungsentscheidungen

Gewählt: interne Arbeitsdatenbank für Bibliothek/Suche plus vollständig
verschlüsselter Tresor im frei gewählten Ordner als hauptsächliche dauerhafte
Ablage von Dokumenten und wiederherstellbaren Arbeitsständen. Keine pauschale
dauerhafte interne Zweitkopie aller PDFs als vollständige Auslagerung ausgeben.
Originale, Felder, Prüf-/Entfernungsvermerke und separate `ue:*`-Übersetzungsjobs
mitnehmen; der alte Sicherungsexport allein enthält nicht alle diese Daten.
API-Schlüssel nicht automatisch extern sichern. Altes Sicherungsformat erhalten.

**SD-Karte ist optional.** Vollständige Nutzung im Gerätespeicher ermöglichen;
auch ein Tresorordner im internen Speicher muss wählbar sein. Später unter
Windows einen Rechnerordner bzw. verfügbares externes Laufwerk anbieten.
Ordnerwechsel darf keine Dokumente verlieren; fehlende Karte/Freigabe, falsches
Passwort oder beschädigte Daten dürfen keine stille leere Ersatzbibliothek oder
falsche Erfolgsmeldung erzeugen. Alte Ordner nicht ungefragt löschen.

Die App selbst wird derzeit intern installiert. Freie Installation auf SD ist
keine zugesagte Funktion. Für ein anderes Gerät App erneut installieren und
denselben eigenen Tresor mit Passwort öffnen können. Gerätelokale Keystore-
Entsperrung ist nicht übertragbar. Eine als interner Speicher eingebundene SD
ist normalerweise gerätegebunden. Echte Karten-/Gerätewechsel noch nachweisen.

Private-Brain-Pro-Speichergrundgerüst wiederverwenden, mit eigener Workflow-
Identität und eigenen Datenschlüsseln. Gelesene Referenz:
`lausiklauskn-png/Privat-Brain-Pro`, Commit
`0937bc54a2fa58462a17ffe123757026a096925e`. Referenzrepo nicht verändern;
keine fremden Signierschlüssel, Konten oder privaten Daten übernehmen.

Chrome-Variante A ist gewählt: bestehenden Chrome-Weg mit nur lokalem,
geschütztem Hin-/Rücktransport erhalten. Keine öffentlichen Dokument-URLs,
keine ungefragte neue Übersetzungs-API oder kostenpflichtige Ersatzlösung.
Chrome erhält nur den bereits gereinigten Text. Sechs DE/RU/EN-Richtungen,
Fortsetzen/Abbruch und PDF-Ergebnis prüfen. Die zusätzliche Frage zum
Vordergrunddienst mit sichtbarer Laufbenachrichtigung versus manueller Rückkehr
pro Abschnitt ist noch unbeantwortet; keine Zustimmung aus Schweigen ableiten.

## 4. Tatsächlicher Bau- und Prüfstand

Vorhanden: lokal gebündelter Capacitor-8.5.3-Android-Host, Datei-/PDF-Anzeige-/
Zurück-Brücke, reproduzierbarer Bau und getrennte Tresorbausteine
`DocumentVault`, `VaultLocations`, `ProVaultPlugin`, `VaultCrypto` sowie
`native/vault-codec.js` und `native/vault-records.js`.
**Die Tresorbausteine sind noch nicht mit der laufenden Bibliothek verbunden.**
Die native Tresor-Brücke ist noch nicht in MainActivity registriert; Codec und
Transport werden noch nicht als laufender Speicheradapter eingebunden.
Der Node-Chrome-Protokollversuch ist noch kein nativer Android-Transport.
Es gibt noch keine vollständig freigegebene reguläre APK.

Bereits ausgeführte Prüfungen, jetzt nur deren Status erneut gelesen:
https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39514505622
auf `527ea3b` erfolgreich; davor Lauf `39513680351` auf `ce950ab` erfolgreich.
Nachweise: vollständige unveränderte Originalkette mit 28 Skripten, vier
Browser-/Dateiadapterfälle, acht JVM-Fälle, sieben Codec-/Transportfälle,
Release-CLI-Gegenprobe und 14 tatsächliche Android-15-Emulatorfälle
(drei WebView-/Dateifälle plus elf SAF-/Keystore-/Tresorkomponentenfälle).
Ein Teil der Transportfälle verwendet eine gestellte Schnittstelle.
Linux-Browserprüfungen nutzen die gemessene Android-Referenzschrift Roboto;
Produkt-CSS, Quelltests und Schutzpins wurden dafür nicht geändert.

Das sind keine neuen Prüfungen der Nachfolgesitzung, keine echte SD-Karte,
kein physisches zweites Gerät und keine echte Google-Übersetzung.
Zielgerät und genaue Android-/Chrome-/WebView-Version sind noch nicht bekannt;
zuletzt war kein Gerät per ADB angeschlossen. `native-foundation` erfüllt
ausdrücklich noch nicht das vollständige Releasegate `native-smoke`.

## 5. Nächste konkrete Bauarbeiten

1. Speicheradapter und Einstellungen mit dem unveränderten `WFP.DB`-Vertrag
   verbinden: interner Standard ohne SD, Passwort/Sperren, dauerhafte Freigaben,
   verschlüsselte Hauptablage, sichtbarer Schreibstatus und konsistente Fehlerwege.
   Auch Invalidierung von Seitentext/Vektorblöcken, Originalfoto-Lebenszyklus
   und Übersetzungsstände erhalten. Keine funktionierenden Daten löschen.
2. Übernahme, Ordnerwechsel und Wiederherstellung ohne Überschreiben anbinden;
   Abbruch, Neustart, fehlendes Medium, vollen Speicher und beschädigte Daten
   prüfen. Einstellungen und Caches/Modelle vollständig zuordnen; Geheimnisse
   nicht durch pauschales Sichern von localStorage/IndexedDB übertragen.
3. Native lokale Chrome-Brücke fertigstellen; ursprüngliche Reinigung und
   Übersetzungslogik erhalten, Hintergrundentscheidung und reale Gerätebefunde
   berücksichtigen. Protokollsimulationen nicht als Google-Nachweis ausgeben.
4. Ordnerimport, Teilen hinein, SEND/SEND_MULTIPLE/VIEW bei kaltem/warmem Start,
   Kamera/Mikrofon/Sprache, Teilen-Abbruch, Drucken, DeX/Fenstergrößen, Offline-
   Ressourcen, Neustart und Updates anhand der gesamten Funktionsmatrix fertigstellen.
5. Vollständige native Freigabeprüfung schaffen und ausführen. Erst danach
   reguläre APK mit vorhandener Signatur, steigender Versions-/Buildnummer und
   überprüftem Download bereitstellen. Keine Gates für einen frühen Host abschalten.

Cloud-Bauumgebung, wenn diese Pfade vorhanden sind:
`bash tools/native/setup-cloud.sh`, dann `source tools/native/env.sh`,
`npm run sync:android` und
`android/gradlew -p android --no-daemon --max-workers=2 assembleRelease lintRelease testReleaseUnitTest`.
Emulatorziel: `:app:connectedDebugAndroidTest`; zum Kompilieren nur
`:app:assembleDebugAndroidTest`. Niemals `npm ci` gleichzeitig mit Gradle/Lint.
Lokal blockiert die Browserrichtlinie file:// im Original-HTML-Exporttest;
nicht umgehen oder abschalten, vollständige Originalkette im geeigneten CI prüfen.
Cloud-Konfiguration ist als Entwurf gespeichert; ihre Veröffentlichung und eine
neue Task-Wiederherstellung nicht ohne tatsächlichen Nachweis behaupten.

## 6. Signierung und GitHub: bestehende Schlüssel verwenden, nicht kopieren

Die nächste Sitzung braucht keinen privaten Schlüssel im Chat. Im Repo liegen:
- `signing/android-release.enc.json`: vorhandener verschlüsselter APK-Schlüssel.
- `signing/android-certificate.json`: öffentlicher Zertifikats-Pin.
- App-ID: `de.familyprojekt.workflowpdf.pro`.
- Zertifikat SHA-256:
  `0da805c9ad11ded86227fa4398e9237766f9f2d12bec66d65cb20309cbea3837`.

Entschlüsselungsfreigabe: vorhandenes GitHub-Environment `android-production`,
Secret `WF_PDF_SIGNING_UNLOCK`. Wert weder auslesen noch in Chat/Git/Logs
übertragen. **Niemals die Identität neu initialisieren oder ersetzen.**
Prüfen statt neu erzeugen:
`gh workflow run signing-identity.yml --repo lausiklauskn-png/Workflow-PDF-Pro --ref main -f operation=check`.
Vorhandener erfolgreicher Identitätsnachweis: Actions-Lauf `39501737287`.

Claude Code und Codex verwenden jeweils ihre eigene vorhandene GitHub-Verbindung.
Eine MD-Datei überträgt keine GitHub-Berechtigungen und ist kein Zugangstoken.
Zuerst `git fetch origin main`,
`node tools/signing/github-access.mjs --probe-write` und
`gh workflow list --repo lausiklauskn-png/Workflow-PDF-Pro` ausführen;
Ausgaben unterscheiden zwischen tatsächlichem Push und bloßem Dry-Run.
Keine Proxy-Anmeldedaten oder Token aus einer anderen Sitzung auslesen/kopieren.

Gemeinsamer Releaseweg: `tools/signing/request-release.mjs` und der bestehende
Actions-Workflow. Bei gesperrtem direktem Dispatch ist die Git-Auftragsbrücke
vorbereitet; sie muss zuerst geprüft auf main stehen. Sie kann fehlendes
Git-Schreibrecht nicht ersetzen und umgeht keine App-/Signier-/Releasegates.
Bei echtem 401/403 die konkret fehlende Dienstverbindung/Berechtigung benennen;
keine neue Signierung und kein Hin-/Herschieben von Schlüsseln verlangen.

Arbeite nach diesen Festlegungen selbstständig weiter. Halte offene Arbeit und
tatsächliche Nachweise mit Commit/Laufnummer für weitere Sitzungen aktuell.
