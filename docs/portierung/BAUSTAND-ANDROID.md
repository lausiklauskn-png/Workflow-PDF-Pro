# Android-Bau: tatsächlich ausgeführter erster Abschnitt

20.10.2026. Noch keine vollständige App-Freigabe und kein ausgeliefertes Paket.
Dieser Stand ergänzt die historischen Ausgangsprüfungen in PRUEFSTAND.md.

## Implementierter Anfang

- Capacitor 8.5.3, eigenes Android-Paket `de.familyprojekt.workflowpdf.pro`, reguläre
  Release-Konfiguration 1.0.0 / Build 1. Debug-Ausgaben nur intern mit `.debug`.
- Explizites öffentliches Bundle aus 86 Quelldateien; 191 Herkunftsdateien vorher
  per SHA-256 geprüft. Nur index.html erhält Produktnamen und Adapter-Skripttags.
  PDF-/Schutzkern, Modelle, Schriften, Worker und Manifest bleiben bytegleich.
  Der Service Worker bleibt für Modellcache und bisherigen Teilen-Weg erhalten;
  Capacitor löst seine lokalen Ressourcen auf. Kein Fernseiten-Wrapper.
- Erste getrennte Datei-Brücke: stückweise Übergabe, Android-Speichern-Dialog,
  Rücklesen und SHA-256-Vergleich nach Speichern, Teilen mehrerer Dateien über
  eng begrenzten FileProvider, ausdrückliche externe Links. Teilen bestätigt nur
  das Öffnen des Android-Dialogs, keine Zustellung beim Empfänger.
- PDF-Anzeige über den vorhandenen pdf.js-Kern und Android-Druckübergabe der
  unveränderten PDF-Bytes. Sichtbarer Zurückknopf und Android-Zurück, insbesondere
  Abbrechen der vorhandenen Reinigung vor einer externen Übertragung.
- Wiederanlauf: docs/FOLGESITZUNG.md, reproduzierbare Werkzeuginstallation und
  gespeicherter Cloud-Konfigurationsentwurf. Gemeinsame Git-Release-Auftragsbrücke
  vorbereitet; kein Signierschlüssel wird zwischen KIs übertragen.

## Neue lokale Prüfungen dieses Bauabschnitts

| Prüfung | Tatsächlicher Befund |
|---|---|
| `node tools/onboarding/verify-upstream.mjs` | 191 Dateien ohne Abweichung; separates Quellrepo weiterhin unverändert |
| `WFP_CHROMIUM=/usr/bin/chromium npm run test:native-web` | 4/4 bestanden; Hash-/Bundlegrenzen, echtes Formular mit Originalbytes und Neustart; Dateibrücke separat simuliert mit Abbruch, Schreibfehler, mehreren Teilen und PDF-Rückweg |
| Gradle `assembleRelease lintRelease testReleaseUnitTest :app:assembleDebugAndroidTest` | erfolgreich nach Korrekturen; App-Lint 0 Fehler, 8 Warnungen; 2 eigene JVM-Gegenproben bestanden |
| `NativeFoundationTest` | 3 echte WebView-/Java-Brückenfälle kompilieren; lokal mangels Gerät/Emulator **nicht ausgeführt** |
| `test-request-release.mjs` | 1 gruppierter CLI-Test bestanden: direkter Aufruf, Git-Fallback, veränderter main, fehlende Brücke, bestehender Auftrag, Preview-Ablehnung; GitHub-Aufrufe gestellt |
| `actionlint` | neue Foundation-/Release-Auftragsworkflows ohne Befund |
| JDK/SDK/ADB und wiederholtes `setup-cloud.sh` | JDK 21.0.12.1, SDK 36, ADB 37.0.1 installiert; wiederholte Einrichtung erfolgreich; `adb devices -l` meldet kein angeschlossenes Gerät |
| Echte dauerhafte Signieridentität | erneuter Actions-`check` 39501737287 auf main f403aa1 erfolgreich; keine neue Identität, keine APK-Veröffentlichung |

Rohprotokolle dieser lokalen Läufe in der aktuellen Maschine:
`/workspace/setup/native-web-files.tap`, `native-build-checkpoint-fixed.log`,
`native-repeat-install-fixed.log`; XML-Befunde unter
`android/app/build/test-results/testReleaseUnitTest/`. Diese lokalen Pfade sind
keine Zusage einer Wiederherstellung in einer neuen Sitzung. Nachfolgende CI-Läufe
mit Commit und URL hier gesondert ergänzen.

Zwischenfehler wurden nicht als Erfolg gezählt: eine falsche Verkettung von
`Intent.setClipData` korrigiert; gleichzeitiges `npm ci` entfernte Dateien einer
laufenden Lint-Prüfung, danach in getrennter Reihenfolge erneut erfolgreich;
ADB konnte zunächst seinen normalen Benutzerordner nicht anlegen (read-only),
der neue leere Ordner wurde mit erteilter Dateisystemfreigabe auf
`/workspace/android-user` verwiesen. HOME blieb unverändert.
Ein zu breit gewähltes `assembleDebugAndroidTest` baute auch die leeren
Cordova-Bibliothekstests mit widersprüchlichen Kotlin-Abhängigkeiten; das Ziel
auf die tatsächlichen Workflow-App-Tests `:app:assembleDebugAndroidTest` begrenzt.
Keine bestehenden Workflow-PDF-Tests deaktiviert. Die generischen neu erzeugten
Capacitor-Beispieltests wurden durch die eigenen Dateigrenzen-/WebView-Fälle ersetzt.

## Noch zu bauen und nachzuweisen

Die vollständige Funktionsmatrix bleibt maßgeblich. Insbesondere fehlen noch:
laufende Tresor-/SD-Anbindung und Wiederherstellung (gewählte Kombination mit
optionaler SD), native Ordnerimporte und Teilempfang/„Öffnen mit“, Kamera-/Druck-/
Sprachprüfungen, tatsächlicher Chrome-Hin-/Rücktransport auf Android und reale
Google-Übersetzung, alle Fenster-/DeX-/Neustart-/Updatefälle. Der vorhandene
Node-Chrome-Versuch ersetzt keinen nativen Transport. Ein hier erzeugtes
unsigniertes Host-APK ist kein vollständiges Workflow PDF Pro und wird nicht als
reguläre erste Version bereitgestellt.

`native-foundation.yml` soll jetzt die vollständigen unveränderten Originaltests
auf geeignetem CI-Browser und separat echte WebView-/Java-Brückenfälle im Emulator
ausführen. Sein Android-Job heißt absichtlich **nicht `native-smoke`** und öffnet
damit das bestehende Gate für die vollständige reguläre Freigabe nicht.

## Fortschritt nach den ersten CI-Gegenproben

Die ersten CI-Läufe waren fehlgeschlagen; nicht als vollständigen Erfolg zählen:
`39507303735` und `39508538478` auf den zugehörigen Baucommits zeigten zwei von
drei bestandenen Android-WebView-Fällen. Die dritte Probe blieb im echten
Speicherdialog hängen: Dem blockierenden Test-IntentFilter fehlte der MIME-Typ.
Die Fixture erhält jetzt `*/*`; das ist noch durch einen neuen Lauf zu bestätigen.
Ein zuvor tatsächlich gefundener Brückenfehler (Java `Long` statt JavaScript-
Integer bei kleinen Dateiversätzen) ist korrigiert und mit drei JVM-Fällen geprüft.

Die unveränderte Originalkette scheiterte im CI an der schmalen Kopfzeile bei
380 px mit DejaVu Sans Bold. CDP und Geometriemessungen belegen den Schriftunterschied.
Neue lokale Original-`knoten.mjs`-Läufe mit externem Fontconfig-Profil:
Roboto als Android-Referenz: 126 grün, 0 rot; DejaVu: 124 grün, 2 rot.
Weder Produkt-CSS noch Quelltests oder Prüfsummen wurden geändert. CI erhält
jetzt die Android-Referenzschrift; die komplette Kette damit ist noch zu messen.

Die neuen Tresor-Komponenten bauen lokal. Fünf übernommene Kryptoprüfungen und
drei binäre Datensatzprüfungen bestanden neu; die zehn vorbereiteten nativen
SAF-/Keystore-Komponentenfälle sind noch nicht ausgeführt. Der Browser-Bundle-
und Dateiadapterlauf bestand erneut 4/4. Native Adapter-URLs tragen nun ihren
Inhaltshash, damit nach einem APK-Update kein veraltetes Adapterskript aus dem
unveränderten Service-Worker-Cache geladen wird. Die Tresor-Brücke ist noch
nicht mit der laufenden Bibliothek verbunden, also kein fertig nutzbarer Tresor.

Aktuell erneut gelesene Remotes: Quelle main `7227c543d4a536cf8f3354a56fbba7574645703e`,
Pro main `f403aa1188232e2679fe664ebbdc2a6301ce6106`. Quellcheckout weiterhin sauber.

### Neuer CI-Befund auf `1b3216e47f6e2afd9243e9693fcafb46028f88f9`

[Actions-Lauf 39512895516](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39512895516):
Die vollständige Originalkette mit allen 28 Skripten hat jetzt neu bestanden,
ebenso Browser-Bundle, Git-Release-CLI-Gegenprobe und die drei Datensatzprüfungen.
Android-Bau/Lint/JVM bestanden; die Emulatorprüfung schlug fehl. Im neu angelegten
Debug-Testanbieter fehlte die von `DocumentsProvider` verlangte Deklaration
`exported=true` mit `android.permission.MANAGE_DOCUMENTS`; die Referenz enthält
diese. Dieser Testanbieter wird jetzt entsprechend korrigiert und bleibt aus
dem Release ausgeschlossen. Der Folge-Emulatorlauf muss den Befund bestätigen.

Zusätzlicher binärer Transport liegt separat vor, noch nicht in der Bibliothek:
Originale und Übersetzungsjobs, unterbrochene Transfers, veraltete Speicherstände
und Austausch eines Datensatzes zwischen Status und Lesen. Neu lokal 7/7
Codec-/Transportfälle bestanden; davon vier gestellt gegen eine native
Schnittstelle, keine Android-Gerätenachweise. Jeder native Leseblock bindet den
erwarteten Datensatzhash, damit kein gemischter Schreibstand als Erfolg gilt.
PDF-Anzeigen schließen beim Ersetzen die alte Renderinstanz; Speichern/Drucken
aus der Anzeige übernimmt den Dokumentnamen mit der vorhandenen Zeichenregel.

### Neuer nativer Nachweis auf `ce950abc1e7ca5ab54bb5225e62db1de565e2394`

Im [Actions-Lauf 39513680351](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39513680351)
bestanden beide Baujobs. Die vollständige unveränderte Original-Testkette mit
28 Skripten, vier Browser-/Dateiadapterfällen, Release-CLI-Gegenprobe und sieben
Codec-/Transportfällen bestand erneut. Der Android-Job bestand neu: Bauen,
Lint, acht JVM-Fälle und **14 echte
Instrumentierungsfälle auf dem Android-15-Emulator** (14 ausgeführt, 0 Fehler,
0 ausgelassen). Das umfasst drei WebView-/Dateibrückenfälle und elf
SAF-/Keystore-/Tresorkomponentenfälle, darunter interner Standard ohne
Speicherwahl, Rückwechsel auf intern mit weiterhin erreichbarem altem Tresor,
nicht erreichbarer Hauptordner ohne stillen Wechsel, Schutz laufender Transfers
und Zurückweisen einer anderen Dateifassung beim Lesen.

Der frühere Startabsturz ist durch das historische CI-Protokoll ausdrücklich
bestätigt: `Unable to get provider ... FixtureDocuments: ... Provider must be exported`.
Die korrigierte Systemberechtigung steht ausschließlich im Debug-Manifest;
der Release enthält diesen Testanbieter nicht. Die Passwort-Wiederaufnahme
verwendet getrennte App-Einstellungsräume im selben Emulator, kein physisches
zweites Gerät. Eine echte SD-Karte, die Bibliotheksanbindung sowie Windows/iOS
sind weiterhin offen. Der Erfolg dieser Komponenten ist keine vollständige
native-smoke-Abnahme und keine Freigabe einer regulären APK.

## Fortsetzung 21.10.2026: nativer Ordnerimport

Übernommen wurde der saubere Bauzweig `628d2ca`, einschließlich des inzwischen
auf `a19d82d` stehenden main. Alle sieben Remotezweige wurden vor Änderungen
abgefragt; keine fremde Arbeit zurückgesetzt oder überschrieben. Quell-main
erneut `7227c543d4a536cf8f3354a56fbba7574645703e`, Quellcheckout sauber.

Neu: `FolderImport` / `ProImportPlugin` mit lesender SAF-Ordnerauswahl und
undurchsichtigen, widerrufbaren Dateitickets. Unterordner, Unicode-Namen und
leere Dateien bleiben erhalten; nicht erreichbare Dateien melden einen Fehler.
Der Webadapter `native-import.js` bedient beide bestehenden Ordner-Dateieingaben
(Bibliothek und Übersetzungsbereich). Erst nach vollständigem Lesen wird deren
unveränderter `change`-Handler ausgelöst. Abbruch oder Lesefehler gibt keinen
halben Ordner als vollständige Auswahl weiter. Die bestehende PDF-/Bild-/
Arbeitsstand-Importlogik, manuelle Schutzprüfung, natürliche Pfadsortierung und
Ordnerzuordnung bleiben im Quellkern. Es werden keine Quelldateien verändert,
keine dauerhafte Ordnerfreigabe für diesen einmaligen Import und keine
Schreibrechte verlangt. Das ist unabhängig vom dauerhaften Tresor.

Neu lokal tatsächlich ausgeführt:
- Herkunftsprüfung: 191/191 unverändert.
- `WFP_CHROMIUM=/usr/bin/chromium npm run test:native-web`: 10 Node-Testeinträge
  bestanden (einschließlich fünf neuer Ordnerfälle und ihres Sammeltests),
  0 fehlgeschlagen/übersprungen. Echte Browser-/PDF-Importe; Android-Schnittstelle
  dabei gestellt. Mehrteiliger Transport bis 600001 Bytes, Unicode-Pfade,
  Abbruch, spätere Lesefehler, leere ungültige Antwort, Originalbytes und
  weiterhin ungeprüfter Dokumentstatus geprüft. Im ersten Versuch wartete der
  Test mit einem asynchronen Prädikat zu früh; auf den tatsächlichen Abschluss
  des Bibliotheksladens korrigiert, danach vollständig bestanden.
- Unveränderte Codec-/Transportgegenproben: 7/7 bestanden, keine Geräteprüfung.
- Eigene vorhandene GitHub-Verbindung: Git lesen, API/Actions lesen und
  Push-Dry-Run erfolgreich. **Direkter Dispatch wirklich ausgeführt**:
  Signieridentitäts-`check` von main `a19d82d` im
  [Lauf 39568357544](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39568357544)
  erfolgreich. Bestehende Identität benutzt, keine Schlüssel neu erzeugt oder
  ausgelesen. Noch kein tatsächlicher Release-Schreibvorgang.

Vier neue echte DocumentsProvider-Komponentenfälle und zwei WebView-/Java-
Brückenfälle sind ergänzt. Deren Ausführung wird separat mit CI-Lauf/Commit
festgehalten; bloßes Kompilieren zählt nicht als bestandener Emulatorlauf.
Lokale Arbeitsprotokolle liegen in `work/`, nicht in der APK. Der erste
SDK-Aufbau scheiterte am HTTP-503 des Build-Tools-Downloads, Wiederholung
installierte die Werkzeuge; ADB ist lokal wegen des nicht beschreibbaren
Standard-Benutzerverzeichnisses weiterhin nicht startbar. Kein echtes Gerät,
keine SD-Karte und kein lokaler Emulator nachgewiesen.

Weiter offen: Speicheradapter samt Einstellungen, Wiederanlauf/Übernahme und
Tresorwechsel; nativer Chrome-Transport; SEND/SEND_MULTIPLE/VIEW; übrige
Funktionsmatrix und vollständige native Freigabe. Vor Kopplung der Speicher
wurde das konkrete Wiederanlaufjournal mit Alternative zur Entscheidung
vorgelegt; Antwort noch offen. Auch die Frage zum Chrome-Vordergrunddienst
bleibt offen. Keine Zustimmung aus Schweigen abgeleitet. Große Ordner müssen
zusätzlich auf dem Zielgerät hinsichtlich Speicherverbrauch geprüft werden:
der Webadapter baut die Dateiauswahl vollständig vor der Übergabe auf.
Keine reguläre APK freigegeben und kein Releasegate abgeschaltet.

### Bestätigter neuer Bau-/CI-Nachweis für `865b768`

Lokaler erneuter Sync und
`assembleRelease lintRelease testReleaseUnitTest :app:assembleDebugAndroidTest`
bestanden vollständig. Lint: 0 Fehler, 9 Warnungen; acht JVM-Fälle bestanden,
keine ausgelassen. Android-Test-APK kompiliert; lokal weiterhin kein ADB-/
Emulatorlauf. Die Warnungen betreffen bestehende SharedPreferences-/Manifest-/
Backup-/Ressourcen-/Speicherplatzstellen, keine neue FolderImport-Lintwarnung.

[Actions-Lauf 39569568346](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39569568346)
auf Implementierungscommit `865b768d70cd302b53dc12c6443c2c3683ee311b`
ist vollständig erfolgreich: unveränderte Originalkette mit allen 28 Skripten,
erweiterte Browser-/Dateiadapterfälle, sieben Codec-/Transportfälle und
Release-Auftragsgegenprobe; Android-Bau, Lint, JVM und Emulator ebenfalls grün.
Der zusätzliche PR-Lauf 39569577632 bestätigte den Android-Job neu; dessen
API-lesbare XML-Annotation meldet **20 Tests, 0 Fehler, 0 ausgelassen**.
Damit sind die vorherigen 14 Android-15-Emulatorfälle plus vier echte
DocumentsProvider-Ordnerfälle und zwei WebView-/Java-Ordnerfälle bestätigt.
Der System-Ordnerdialog wird in den zwei Brückenfällen per Instrumentation
kontrolliert beantwortet; der Provider, Dateistream und WebView sind echt.
Das ist keine Bedienprüfung eines echten SD-Kartenanbieters oder Zielgeräts.

Die neue statische [Speicherinventur](SPEICHERINVENTAR.md) ordnet Dokumente,
Originalfotos, `ue:*`-Jobs, Suchindex, Einstellungen, Geheimnisse sowie Modell-/
Teilen-/Netzspeicher getrennt zu. Ein wichtiger noch zu schließender Fehlerpfad:
`jobLesen` im Quellkern fängt Lesefehler als `null` ab. Der native Speicheradapter
muss nicht erreichbare Freigaben vor dem Start eines Übersetzungsjobs sichtbar
sperren; ein solcher Fehler darf keine Wiederaufnahme durch einen leeren Job
ersetzen. Der Quellkern wurde nicht geändert.

Die beiden konkret vorgelegten Entscheidungen (Wiederanlaufjournal und
Chrome-Vordergrunddienst) sind beim Schreiben weiterhin unbeantwortet.
Keine Migration, kein Vordergrunddienst und kein regulärer APK-Release daraus
ableiten. Die Speicherarchitektur ist gewählt; deren Journal-/Index-Kopplung
wird erst nach der konkreten Auswahl eingebaut. Das Releasegate bleibt erhalten.

## Fortsetzung: gewähltes Wiederanlaufjournal, 21.10.2026

Ausgangspunkt dieser Fortsetzung: sauberer lokaler Checkout `f403aa1`; Remote-
Zweige vollständig gelesen. Bauzweig inzwischen `2c63afc`, main `a19d82d`;
main ist im Bauzweig enthalten. Alle sieben Remotezweige wurden verglichen,
kein Reset, Force-Push oder Worktree. Quell-main erneut unverändert `7227c54`.

Klaus hat in dieser Sitzung ausdrücklich gewählt: **verschlüsseltes
Wiederanlaufjournal** und **Chrome-Vordergrunddienst mit sichtbarer Benachrichtigung
und Abbruch**. Die historischen offenen Fragen oben sind damit beantwortet;
die Funktionen sind durch die Entscheidung allein noch nicht fertig gebaut.

Neue getrennte Bausteine:
- `native/vault-journal.js`: serielles Redo-Protokoll über den vorhandenen
  binären Records-/Android-Verschlüsselungsweg. Erst bestätigtes Journal,
  dann bestätigte Tresoränderungen, dann eine interne Indextransaktion,
  anschließend ein Abschlussmarker ohne Nutzdaten. Wiederholung ist idempotent;
  nach einem Fehler bleiben weitere Operationen bis zur Wiederaufnahme gesperrt.
- `native/vault-db.js`: Factory für den bestehenden asynchronen WFP.DB-Vertrag.
  PDF-/Original-/Jobdatensätze werden vollständig transportiert; `files` enthält
  intern nur Versionsreferenzen. Text-/Vektorkopf-/Blockinvalidierung und Löschen
  des Originalfotos bleiben erhalten. Metadaten behalten Felder, Verknüpfungen
  und Entfernungsvermerke. Keine localStorage-/API-/SBKIM-Schlüsselübernahme.
- Die interne Transaktion verwendet unverändert `WorkflohPDF1`, Version 3 und
  dessen fünf Stores. Das ursprüngliche DB-Objekt wird nicht ersetzt oder geändert.

**Noch nicht produktiv aktiviert:** Factory und Journal sind weder in den
Bundle-Skripttags noch in MainActivity registriert. Einstellungen, explizite
Migration/Ordnerwechsel, Übernahme auf ein zweites Gerät, sichere Startsperre
und Fehleranzeige sowie zugeordnete Einstellungen fehlen noch. Die Library darf
erst nach deren Einbau auf den neuen Adapter umgeschaltet werden. Ein bloßes
Factory-/Protokollergebnis ist keine vollständige Tresoranbindung. Der bisherige
Dateieingang SEND/SEND_MULTIPLE/VIEW ist ebenfalls weiterhin offen; nach Klaus'
Antwort wurde die Journalschicht vorgezogen. Der Chrome-Dienst ist gewählt,
noch nicht implementiert. Keine reguläre APK und kein geändertes Releasegate.

Neu tatsächlich ausgeführt:
- `node tools/native/test-vault-journal.mjs`: **13 Testeinträge bestanden**, 0
  Fehler/ausgelassen, einschließlich sechs Unterfällen mit Abbruch nach einem
  dauerhaften Protokollschritt. Fehler nach PDF-Schreiben, Index-Quota, verlorene
  Bestätigung, gesperrter Speicher, beschädigtes/fremdes Journal, veraltete
  Dateireferenz, unveränderte Original-/Übersetzungszustände und Aufrufreihenfolge.
  Der native Transport ist in diesen Protokollfällen gestellt; keine neuen
  Android-Verschlüsselungs-/Emulatorfälle daraus ableiten.
- Erweiterte echte Chromium-Bundleprüfung: **3/3 bestanden**, einschließlich
  realer IndexedDB-Rücknahme bei ungültigem Datensatz und Journalwiederaufnahme
  nach tatsächlich abgeschlossenem Indexschreiben mit verlorener Bestätigung.
  PDF-Bytes, Versionreferenz ohne interne PDF-Kopie und Löschung geprüft; die
  Remote-Schnittstelle ist dabei gestellt. Kein Produktadapter aktiviert.
- Gesamter vorhandener `test:native-web`-Lauf: **10 Testeinträge bestanden**,
  0 Fehler/ausgelassen; danach die zuletzt erweiterte Bundleprüfung separat
  erneut 3/3 bestanden. Die erste Ausführung ohne Sandbox-Netzfreigabe konnte
  keinen lokalen Testserver öffnen (`listen EPERM`); mit der vorgesehenen
  Netzfreigabe bestanden, keine Browserrichtlinie umgangen.
- Herkunftsprüfung erneut **191/191 unverändert**. Syntax und `git diff --check`
  ohne Befund. Codec-/Record-Transportdateien ebenfalls neu erfolgreich gestartet;
  deren ursprüngliche Geräteprüfungen bleiben historische Nachweise.
- Eigene Verbindung: API lesen und Admin-/Pushrechte von GitHub gemeldet,
  Git lesen und Push-Dry-Run erfolgreich. **Direkter Workflow-Dispatch neu
  ausgeführt**, vorhandene Identität im
  [Lauf 39575347257](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39575347257)
  auf main `a19d82d` erfolgreich geprüft. Keine Schlüsselwerte gelesen oder neu
  erzeugt. Releases-Schreibvorgang weiterhin nicht ausgeführt.

Rohprotokolle dieser Fortsetzung unter `nachweise/2026-10-21-journal*`.
Keine erneute vollständige Originalkette oder Android-Bau-/Emulatorprüfung in
diesen lokalen Angaben enthalten; der nächste CI-Lauf ist gesondert zu ergänzen.

### Startsperre für die bevorstehende Produktanbindung

`native/vault-gate.js` ergänzt die noch nicht aktivierte Speicherschicht.
Bibliotheks- und Jobabfragen warten beim gesperrten Start auf erfolgreiche
Entsperrung/Wiederaufnahme, statt `null` oder eine leere Liste vorzutäuschen.
Vor Speicherwechseln wartet die Sperre laufende Datenbankaufrufe ab. Nach einem
Fehler werden neue Schreibversuche abgewiesen; vor dem Fehler zurückgestellte
Schreibversuche werden nach Wiederaufnahme verworfen und müssen vom aufrufenden
Vorgang bewusst wiederholt werden. Das verhindert insbesondere, dass der Kern
nach einem abgefangenen Job-Lesefehler später einen leeren Job nachschreibt.
Eingabewerte werden bereits beim Aufruf kopiert, nicht erst nach dem Entsperren.

`node tools/native/test-vault-gate.mjs`: **5/5 neu bestanden**, 0 Fehler/ausgelassen.
Start mit gesperrtem Job, laufender Schreibvorgang beim Ordnerwechsel, Fehler
mit anschließendem leeren Job, verspätete Wertänderung und eine bereits wartende
Mutation nach fehlgeschlagenem Lesen sind getrennt geprüft. Das sind lokale
Protokoll-/Nebenläufigkeitsprüfungen, keine native Passwortdialog-/Geräteabnahme.
Die Sperre ist weiterhin eine Factory, keine schon injizierte Startoberfläche.

Ergänzende lokale Gegenprobe: Abbruch nach jedem der acht dauerhaften Schritte
beim Löschen von PDF, Originalfoto, Text, Vektorkopf und -block, Index und
Abschlussmarker. Nach Wiederaufnahme bleiben Dokument/Original/Suchindex entfernt,
der separate Übersetzungsjob bleibt erhalten. Der erweiterte Journallauf besteht
jetzt **22 Testeinträge**, 0 Fehler/ausgelassen; Rohbericht
`nachweise/2026-10-21-journal-deletion.tap`. Die früher genannten 13 Einträge
bezeichnen den vorherigen, kleineren Lauf, keine weiteren Geräteprüfungen.

### Neuer vollständiger CI-Nachweis auf `01eaec6`

[Actions-Lauf 39576626957](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39576626957)
und der zusätzliche PR-Lauf 39576635719 bestanden vollständig. Web-Job:
unveränderte Originalkette mit 28 Skripten, Bundle-/Datei-/Ordnerprüfungen,
Release-Auftragsgegenprobe sowie Codec-/Transport- und die ersten 13 Journal-
Testeinträge. Android-Job: Build/Lint/JVM und echte Android-15-Emulatorprüfung
erfolgreich; API-lesbare XML-Annotation von Job 119143630487 meldet **20 Tests,
0 Fehler, 0 ausgelassen**. Die Journal-Factory ist dabei nicht in der Android-App
aktiviert; diese 20 Fälle sind die bestehenden nativen Komponentenfälle.
Startsperre und zusätzliche Löschabbruchfälle kamen erst nach `01eaec6` hinzu
und sind durch diesen Lauf ausdrücklich noch nicht im CI nachgewiesen.

### Bestätigter Folgelauf auf `a1c0de8`

[Actions-Lauf 39577609845](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39577609845)
bestand vollständig: Originalkette mit 28 Skripten, Browser-/Datei-/Ordnerfälle,
Release-Auftragsgegenprobe, drei Codec-, vier Transport-, 22 Journal- und fünf
Startsperren-Testeinträge. Android-Bau, Lint/JVM und Emulator ebenfalls erfolgreich;
die XML-Annotation meldet erneut **20 Fälle, 0 Fehler, 0 ausgelassen**. Damit sind
auch die nach `01eaec6` ergänzten Prüfungen neu im CI bestätigt. Die folgenden
Änderungen betreffen nur Dokumentation dieser Ergebnisse und Entscheidungen.

Nächster notwendiger Integrationsschritt: die bestehende Datenbank vor dem
Erfassen durch `app.js` kontrolliert hinter die Startsperre stellen, native
Entsperr-/Fehleroberfläche und explizite Migration/Ordnerwechsel anschließen.
Dabei ausstehende Autospeicherungen und aktuelle Editorwerte vor einer
Umstellung erhalten; ein bloßes Neuladen darf offene Werte nicht verwerfen.
Erst nach bestätigtem Tresorschreiben lokale Dateibytes durch Referenzen ersetzen.
Ein neuer/leerer Tresor, ein vorhandener eigener Tresor und fehlende Freigaben
sind unterschiedliche Vorgänge. Fehler dürfen keine interne Ersatzbibliothek
erzeugen; fremde/konfligierende Kennungen nicht überschreiben. Einstellungen
explizit anhand SPEICHERINVENTAR.md zuordnen. Alle bereits gewählten Arbeiten
sind weiterhin autorisiert. Zur Dienstfreigabe gilt inzwischen die neuere
ausdrückliche Nutzerweisung der folgenden Fortsetzung.

## Fortsetzung: nativer Dateieingang über SEND / SEND_MULTIPLE / VIEW

Ausgangspunkt `f2fb08a`, main `a19d82d`; zunächst sauberer Arbeitsbaum und alle
sieben Remotezweige gelesen. Die übrigen Branchspitzen enthalten historische
Signier-/Rechtedokumentation bzw. sind im Bauzweig enthalten; main ist enthalten.
Keine vorhandene Arbeit zurückgesetzt, kein Worktree, kein Force-Push. Der erste
Tracking-Switch meldete wegen des auf main begrenzten Fetch-Refspecs einen Fehler;
anschließend denselben bereits geprüften Stand mit `switch --no-track` übernommen.
Arbeitsbaum danach sauber. Quell-main erneut `7227c54`, Herkunft 191/191 bytegleich.

Die aktuelle Nutzerweisung bezeichnet die Chrome-Vordergrunddienstentscheidung
als offen; sie überstimmt die historischen Zusagen oben. Konkrete Alternativen
erneut vorgelegt, keine Antwort aus Schweigen abgeleitet und kein Dienst aktiviert.

Neue unabhängige Anbindung: Manifest-Dateizuordnungen, `IncomingFiles`,
`ProIncomingPlugin` und `native-incoming.js`. Android übergibt ausschließlich
content-URIs aus SEND/SEND_MULTIPLE/VIEW; JavaScript erhält keine URI, sondern
befristete Dateitickets. Einzel-/Mehrfachdateien und ClipData-Rückfall werden
stückweise gelesen, Originalbytes und Namen erhalten. Eine sichtbare Empfangsleiste
in DE/EN/RU/AR bietet Einlesen oder Verwerfen; der unveränderte `inDatei`-Handler
übernimmt vollständig gelesene Auswahlen. Er behält die bestehenden Arbeitsstand-,
PDF-/Bildimporte, Originalfotos und die manuelle Schutzprüfung bei. Kein Prüferpin,
Quellcode oder Sicherungsformat geändert. Lesefehler geben keinen halben Satz
Dateien weiter. Bestätigungsfehler nach Übergabe lösen keinen automatischen
zweiten Import aus. Kaltstart wird nicht doppelt eingereiht; gleiche Warmstart-
Aktionen haben unterschiedliche Empfangskennungen und verdrängen einander nicht.

Neu lokal ausgeführt:
- Gesamter abschließender `test:native-web`: 18 Testeinträge bestanden,
  0 Fehler/ausgelassen, einschließlich sieben neuer Empfangsgegenproben mit
  echtem Browser/PDF-/DB-Kern und gestellter Android-Schnittstelle. Darunter
  Originalfoto bytegleich neben erzeugtem PDF sowie Arbeitsstand mit Feldwerten/
  Entfernungsvermerk und verworfenem fremdem „sauber“-Befund. Zuvor kleinerer
  Lauf mit 16 Einträgen und Wiederholungen der Empfangsprobe mit sechs Einträgen.
  Keine neue echte Android- oder Google-Prüfung daraus ableiten.
- 35 Codec-/Transport-/Journal-/Startsperren-/Release-Auftragsgegenproben
  bestanden, 0 Fehler/ausgelassen; Schnittstellen dort weiterhin teilweise gestellt.
- Gradle `assembleRelease lintRelease testReleaseUnitTest :app:assembleDebugAndroidTest`
  im Wiederholungslauf erfolgreich: acht JVM-Fälle, Lint 0 Fehler / 9 Warnungen.
  Erster Lauf scheiterte an zwei neuen Testaufrufen (`setClipData` liefert void,
  direkter Aufruf der geschützten Basismethode); korrigiert. Die Warmstartprobe
  startet nun tatsächlich Android-Aktivitäten. Sieben neue Instrumentierungsfälle
  kompilieren; abschließender Lauf nach der letzten Intent-Absicherung ebenfalls
  erfolgreich (24 s). Lokal mangels `/dev/kvm`/Zielgerät nicht ausgeführt.
  Die sechste Probe verbindet einen echten VIEW-Intent über den synthetischen
  Android-Provider und die Java-Brücke mit dem unveränderten PDF-Importhandler,
  Originalbytes, Formularwert und ungeprüftem Status. Ihre zusätzliche lokale
  Test-APK-Kompilierung bestand (12 s); ein Emulatorlauf steht noch aus.
  Danach ergänzt: Der aktuelle bereinigte Empfangs-Intent bzw. die Bestätigung
  wird explizit in Androids Instanzzustand aufgenommen; `setIntent` allein ist
  dafür keine dauerhafte Zusage. Senderextras werden vorher auf content-Streams,
  Aktion und MIME-Typ beschränkt; zusätzlicher nativer Test verwirft fremde
  Text-/Zusatzeinträge. Beim ersten Kompilieren war die neue Zustandsmethode
  gegenüber Capacitor zu eng sichtbar; auf dessen öffentliche Signatur korrigiert.
- Bestehende eigene GitHub-Verbindung: Git-/API-/Actions-Lesen und Push-Dry-Run
  erfolgreich, Repo meldet Admin-/Pushrechte. Echter Workflow-Dispatch ausgeführt:
  Signieridentitäts-`check` auf main `a19d82d` im
  [Lauf 39580414181](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39580414181)
  erfolgreich. Bestehende Identität, kein Secret gelesen/kopiert/neu erzeugt.
  Echter Releases-Schreibvorgang weiterhin nicht ausgeführt.

Offen: vollständige Geräte-/SD-/DeX-Prüfung, große Eingänge und Speicherverbrauch;
die Auswahl wird vor Import vollständig im WebView zusammengesetzt. Die native
Empfangswarteschlange ist noch im Arbeitsspeicher: ein unbestätigter Start-Intent
kann wieder angeboten werden, mehrere wartende Warmstarts sind noch nicht gegen
Prozessende gesichert. Nach Übergabe verwaltet der Quellkern seine eigenen
Importfehler; die Empfangsbestätigung ist keine Zusage, dass alle Dateien als
Dokumente gespeichert wurden. Keine sichere Exactly-once-Importtransaktion bei
Prozessabbruch behaupten. Diese Grenzen vor vollständiger Freigabe schließen.
Der Tresor, Migration/Einstellungen, Chrome-Transport, übrige Geräteadapter und
die gesamte Funktionsmatrix bleiben offen. Keine fertige/signierte APK, kein
Releasegate verändert. Rohprotokolle dieser Maschine unter `work/`; CI-Nachweis
für den neuen Commit ist gesondert zu ergänzen.

### Erster neuer CI-Befund und Startkorrektur

[Lauf 39582745003](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39582745003)
auf `335bf47` bestand den vollständigen Web-Job einschließlich unveränderter
Originalkette, Bundle/Empfang und Speicher-/Release-Gegenproben. Android-Bau,
Lint und JVM bestanden; Emulator: **27 ausgeführt, 3 fehlgeschlagen, 0 ausgelassen**.
Die 24 übrigen Fälle bestanden, einschließlich der vier neuen Empfangs-
Komponentenfälle. Die drei neuen WebView-Lebenszyklusfälle scheiterten am Start;
dieser Lauf ist keine bestandene native Gesamtabnahme.

Belegter Fehler im Adapter: Capacitors injizierte `Plugins`-Schnittstelle liefert
von `addListener` einen synchronen Handle (native-bridge.js:183), während die
neuere registerPlugin-Schnittstelle ein Promise liefert. Der Adapter rief direkt
`.catch` auf; die ursprüngliche Browserattrappe war durch `async addListener`
zu großzügig. Jetzt beide Verträge über Promise.resolve unterstützt und die
Attrappe auf den tatsächlichen synchronen Vertrag umgestellt. Empfangsprobe
neu 8/8 bestanden. Kein Android-Erfolg daraus abgeleitet.

Zusätzlich: AndroidX ActivityScenario 1.7.0 ordnet Lifecycle-Ereignisse anhand
von Aktion, Daten, Typ und Komponente des Startintents zu (veröffentlichter
Quelltext nachgelesen). Der bereinigte Empfangszustand wird jetzt separat im
MainActivity-Instanzzustand gehalten, ohne Androids Startintent auszutauschen.
Ein Bestätigungsmarker verhindert die erneute Kaltstartübergabe; spätere
Warmstarts bleiben davon unberührt. Senderextras werden weiterhin verworfen,
Routingdaten erhalten. Der noch nötige neue Emulatorlauf ist gesondert zu
ergänzen. Die unzugängliche Actions-Logdownload-Domain wurde nicht umgangen;
konkrete XML-Fehler wurden über die vorhandenen GitHub-Check-Annotationen gelesen.

### Bestätigter korrigierter CI-Lauf auf `2c16888`

[Actions 39584646803](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39584646803)
auf `2c168888c8d9f8db1e860f4d0b23ff066ba1d14b` ist vollständig erfolgreich.
Der Web-Job bestand die vollständige unveränderte Originalkette mit 28 Skripten,
18 native Browser-Testeinträge (einschließlich sieben Empfangsgegenproben),
Release-Auftragsgegenprobe und Codec-/Transport-/Journal-/Startsperrenfälle.
Android-Bau, Lint und JVM bestanden. Die XML-Annotation von Job `119170428054`
bestätigt **27 ausgeführte Android-15-Emulatorfälle, 0 Fehler, 0 ausgelassen**
(41,231 s Instrumentierung). Darunter sind die bisherigen 20 Fälle und sieben
neue Empfangsfälle: vier ContentResolver-/Intent-Komponentenfälle sowie echter
Kaltstart mit bestätigter Activity-Neuerstellung, zwei gleiche getrennte
Warmstart-Aktionen und VIEW bis zum unveränderten PDF-Import mit Originalbytes,
Formularwert und ungeprüftem Status. Die drei zuvor fehlgeschlagenen neuen
Startfälle sind damit tatsächlich neu bestanden, nicht nur lokal kompiliert.

Lokale Korrekturläufe: Empfangsprobe mit synchronem Capacitor-Listener 8/8;
vollständiger Android-Bau/Lint/JVM/Test-APK nach Zustandsisolierung erfolgreich
(23 s), abschließende Test-APK-Kompilierung 12 s. Die neue CI-Hilfe
`tools/native/run-connected.sh` behält den echten Gradle-Rückgabewert bei und
gibt nur bei Fehlern begrenzte AndroidRuntime-/WebView-Fehler als API-lesbare
Hinweise aus. Keine Prüfung abgeschaltet oder umbenannt, kein Releasegate geöffnet.

Rohbefund mit Lauf, exaktem Commit, Jobs und originalen XML-Annotationen:
`nachweise/2026-10-21-native-intake-ci.json`. Diese nachfolgenden Änderungen
dokumentieren nur das Ergebnis; die Implementierung ist durch den obigen Commit
belegt. Keine echte SD-Karte, kein physisches Zielgerät, keine reale Google-
Übersetzung oder dauerhafte Importsicherung gegen Prozessende aus dem Emulator
ableiten. Produktiver Tresor, Migration/Ordnerwechsel, Einstellungen, Chrome-
Hin-/Rücktransport und vollständiges `native-smoke` bleiben offen. Kein Merge
auf main und keine reguläre APK-Veröffentlichung.

## Nächster Bauabschnitt: produktive Tresoranbindung und explizite Übernahme

Klaus hat nach der erneuten Auswahl den Vordergrunddienst gewählt und beauftragt,
ohne weitere Rückfragen selbstständig bis zur signierten Erstinstallations-APK
fertigzubauen. Vollständiger Kern, Schutzmodule und Sicherungen bleiben erhalten.
Ausgangspunkt dieses Abschnitts: sauberer Bauzweig `85a8c38`, alle Remotezweige
erneut gelesen, main weiterhin `a19d82d`. Kein Reset, Force-Push oder Worktree.

Neu angebunden: `ProVaultPlugin` ist registriert, die bisherigen Factories werden
vor dem Erfassen von WFP.DB durch app.js geladen. `native-vault.js` installiert
die Startsperre, internen Standard ohne SD, native Passwort-/Ordnerbrücke,
Sperren/Entsperren und einen zusätzlichen Knopf im bestehenden Speicherbereich
der Einstellungen. Originaler PDF-/Import-/Sicherungs-/Schutzcode unverändert.

`DocumentVault` bereitet Übernahmen in einer eigenen verschlüsselten Generation
vor und bestätigt den Zielindex erst gemeinsam. Abbruch vor diesem Punkt gibt
die bisherige Zielgeneration wieder frei; bisherige Bibliothek bleibt erhalten.
Ein gerätelokaler Wiederanlaufvermerk überbrückt die danach folgende einzelne
IndexedDB-Transaktion und die Auswahl des nativen Hauptorts. Bestehende Ordner
werden nicht gelöscht; kollidierende Kennungen mit anderem Inhalt werden vor
Übernahme abgewiesen. Die Kopie wird datensatzweise transportiert, nicht als
ein JSON mit sämtlichen PDFs aufgebaut. Dateien liegen intern nach Bestätigung
als Versionsreferenzen. Separate ue:-Jobs, Originalfotos, Felder, Vermerke und
Text-/Vektorblöcke werden vollständig mitgenommen.

Ein verlorener interner Index wird aus dem gewählten Haupttresor rekonstruiert;
gesperrte/fehlende Freigaben erzeugen keine leere Ersatzbibliothek. Bei erneuter
Freigabe einer identischen Tresorkopie werden bekannte Versionen vor Neubindung
der Ortsreferenzen geprüft. Alte/andere Dateiversionen werden abgewiesen.
Portable Einstellungen besitzen eine ausdrückliche Allowlist. API-Schlüssel,
Anbietereinwilligungen, SBKIM-Identitäten, Modell- und Eingangscaches bleiben
gerätelokal; bisheriges Sicherungsformat unverändert.

Neu lokal ausgeführt: fünf Produkt-Browserfälle plus Sammeltest bestanden
(echter Kern/IndexedDB, Android-Transport gestellt): interner Start, ausdrückliche
Übernahme/Neustart, Entsperren, vollständig geleerter interner Index und
Speicherfehler ohne Überschreiben eines Übersetzungsjobs. Sieben neue Protokoll-
und Präferenzfälle bestanden, zusätzlich die fünf bestehenden Startsperrenfälle.
Der vorherige volle native Browserlauf mit 23 Einträgen und vorhandene 34
Codec-/Transport-/Journal-/Gate-Einträge waren ebenfalls grün; der zusätzliche
Indexverlustfall ist im späteren fokussierten Lauf enthalten. Kein neuer
Android-Erfolg aus Browserattrappen abgeleitet.

Aktueller Android-Bau/Lint/JVM/Test-APK lokal erfolgreich (23 s). Drei neue echte
SAF-/Batch-/Migrationszeigerfälle und ein durchgängiger Produktfall von Original-
PDF/Formular/Foto/Job über Verschlüsselung bis zum internen Referenzindex und
Activity-Neustart sind kompiliert. Deren CI-Ausführung ist gesondert zu ergänzen.
Keine vollständige App-Abnahme: Chrome-Dienst/Transport, Sprache, weitere
Gerätefunktionen und reguläre Freigabe bleiben im Bau. Releasegates unverändert.

## Neue Speicherprüfung und native Chrome-Anbindung (21.10.2026)

Der vollständige CI-Lauf `39590041226` auf `6291a479cec9a54b1721fa545ec2b007f4efd526`
ist erfolgreich: Original-Testkette, Browser-/Speichergegenproben, Android-Bau,
Lint und JVM sowie **31 Android-15-Instrumentierungsfälle, 0 Fehler/Skips,
52,448 s**. Rohannotation: `nachweise/2026-10-21-native-storage-ci.json`.
Dies ersetzt die zuvor noch ausstehende Ausführung der vier neuen Speicherfälle.

Neu implementiert ist der gewählte native Vordergrunddienst mit sichtbarer,
lokalisierter Laufmeldung und sitzungsgebundenem Abbruch. Er startet aus der
sichtbaren App, verlangt sichtbare Benachrichtigungen, startet nach Prozessende
nicht selbsttätig und beendet seinen Transport bei Abbruch/Systemzeitlimit.
Die Datenverbindung öffnet erst beim ersten bereits bereinigten Absatzpaket:
IPv4-Loopback, zufälliger Port und 256-Bit-Schlüssel nur im URL-Fragment,
exakte Host-/Origin-Prüfung, keine CORS-Freigabe, keine Fremdressourcen.
WebView-Cleartext bleibt abgeschaltet. Chrome wird ausdrücklich geöffnet;
fehlt es, wird kein anderer Übersetzungsanbieter still gewählt.

Der APK-Adapter ersetzt ausschließlich die Chrome-Transportfabrik. Quell-
Reinigung, Einwilligung, seitenweise Jobs und PDF-Aufbau bleiben bytegleich.
Der externe Helfer nutzt dieselbe unveränderte Chrome-DOM-Engine. 16 MiB sind
der explizite technische Paketrahmen, keine Kürzung; eine Überschreitung wird
als Fehler behandelt. Diese technische Grenze ist noch auf praxistaugliche
Segmentierung zu prüfen. Kein tatsächlicher Google-Übersetzungslauf behauptet.

Neu lokal bestanden: 15 Browser-/Transport-Testeinträge, davon drei native
Produktfälle plus Sammeltest mit echter Quell-Reinigung/PDF-Kette und gestellter
Android-Brücke. Vor Bestätigung kein Text; Abbruch ohne Entfernungsvermerk;
anschließend zwei gereinigte Seiten und PDF mit ursprünglichen Seitenmaßen;
Benachrichtigungsabbruch verhindert weitere Übergaben. Android-Bau/Lint/JVM
und Test-APK erfolgreich (28 s). Vier neue native HTTP-/Vordergrunddienstfälle
sind kompiliert; ihre tatsächliche Emulatorausführung folgt im nächsten CI-Lauf.

## Chrome-Dienstprüfung und dauerhafter Empfang / Spracheingabe

CI `39591894099` auf `f554065afb4388d38d9547e340d0a983d27a8f9a` erfolgreich:
Originalkette und sämtliche Web-/Speicherprüfungen, Android-Bau/Lint/JVM,
**35 Android-15-Fälle, 0 Fehler/Skips, 80,834 s**. Enthalten sind die vier neuen
Loopback-/Vordergrunddienstfälle einschließlich sichtbarer Benachrichtigung,
Stopp einer wartenden Seite, Schutz gegen alten Abbruch und Systemzeitlimit.
Rohbefund: `nachweise/2026-10-21-native-chrome-ci.json`. Keine echte Google-
Übersetzung daraus ableiten.

Neu im Bau: Android-Spracheingabe über die ausgewählte Systemerkennung,
Mikrofonfreigabe, Zwischen-/Endergebnisse und Ende beim Verlassen der App.
Der ursprüngliche WFSprechen-Balken und seine Duplikaterkennung bleiben gleich.
Der native Knopf beschreibt korrekt den Android-Anbieter; kein Offlineversprechen
und keine Audiodatei. Neue Browserprobe mit gestelltem Sprachdienst bestanden.

Der Eingang erhält eine private, von der Bibliothek getrennte Wiederherstellung:
komplette Dateien, atomarer Empfangsvermerk, SHA-256 vor Übergabe, mehrere
Warteschlangeneinträge über Neuerstellung hinweg. Fehlgeschlagene spätere Datei
wird nicht als vollständige Auswahl geliefert. Nach Importübergabe bleibt eine
Empfangskopie erhalten, bis der Nutzer sie ausdrücklich verwirft; Wiederherstellen
und Löschen in den Speichereinstellungen. Keine automatische Doppelübernahme.
Dies ist eine zusätzliche interne Wiederherstellungskopie, kein Ersatz für den
gewählten Haupttresor. Es werden ausschließlich app-eigene Empfangskopien gelöscht.

Neue volle lokale Browserprüfung: 29 Einträge bestanden (vor zusätzlichem
History-UI-Fall). Android-Bau/Lint/JVM/Test-APK erneut erfolgreich (21 s);
drei neue native Empfangsspeicherfälle kompiliert. Emulatorausführung folgt.

## Lokaler Android-Übersetzer und fortgesetzte native Abnahme

CI `39593366955` auf `de7d1ad1041b68c6c181caa185fab7c6ae1020e8` grün:
Originalkette und native Browserfälle, Bau/Lint/JVM sowie **38 echte Android-15-
Fälle, 0 Fehler/Skips, 83,259 s**. Enthält drei neue Empfangsspeicherfälle
(Wiederanlauf mit zwei Einträgen, beschädigte Kopie abweisen, Teilfehler/Retry).
Rohbefund `nachweise/2026-10-21-native-recovery-ci.json`. Der parallele PR-Lauf
der vorherigen Chrome-Revision hatte zwei instabile Befunde: Systembenachrichtigung
noch nicht gepostet und ausstehender Speicherleser. Nicht als Vollerfolg verschwiegen.
Die Meldung fordert nun ausdrücklich sofortige Sichtbarkeit; der Test wartet
begrenzt auf das tatsächliche Posting. Die Startsperre bleibt bei notwendigem
Präferenz-Neuladen geschlossen und verwendet den endgültigen Migrationszielort.
Neue Browsergegenprobe zur Startsperre bestanden, genauere native Fehlerdiagnose
ergänzt. Kein Test abgeschaltet und kein Gate umbenannt.

Der vom Benutzer selbstständig zu vervollständigende lokale Weg erhält die
Android-Fähigkeitsbrücke `WorkflowTranslate` mit festem `com.google.mlkit:translate:17.0.3`.
Das ersetzt die im WebView fehlende Browser-Translator-Schnittstelle unterhalb
der unveränderten Quellfunktionen: sechs DE/EN/RU-Paare, bestehende Wiederholung
und Satzzerlegung, Gegenprobe und Feldrückweg. Modelle werden beim ersten
Gebrauch vom SDK heruntergeladen, Dokumenttext wird auf dem Gerät verarbeitet.
Die Ergebnisse müssen nicht wortgleich mit Chromes Browsermodellen sein.
SDK-Lizenz und Modell-/Betriebsdaten: Google ML Kit / Google APIs Terms of Service
(https://developers.google.com/ml-kit/terms). Keine neue kostenpflichtige API,
kein API-Schlüssel und keine Weiterleitung von Dokumenttext an einen Ersatzdienst.
Der native Dialog nennt den Weg korrekt „Übersetzer auf dem Gerät“.

Lokaler Android-Gesamtbau/Lint/JVM/Test-APK grün (23 s); neue Browserprobe mit
gestelltem Modelldienst prüft alle Paare, bestehende Satzzerlegung/Wiederholung
und Abbruch spät eintreffender Antworten. Sie und die fünf Speicherproduktfälle
plus Sammeltest bestanden, insgesamt sieben Einträge. Neue echte ML-Kit-
Modell-/Sechspaarprüfung und Binder-Sprachprüfung mit ausschließlich im Debugbau
enthaltenem synthetischem Android-Sprachdienst sind kompiliert. Ausführung folgt;
keine echte Spracherkennung oder Modellübersetzung vorab behauptet.

## Echte Android-Modelle bestanden; vollständige Freigabeprüfung vorbereitet

CI `39594634590` auf `89ea38b1abbbe9496c7002ff4a726f3455951d17` erfolgreich:
Originalkette, alle Adapter-/Speicherbrowserfälle, Bau/Lint/JVM und **40 echte
Android-15-Fälle, 0 Fehler/Skips, 96,192 s**. Enthalten sind erstmals tatsächliche
ML-Kit-Modell-Downloads und Übersetzungen in allen sechs DE/EN/RU-Richtungen sowie
die reale Android-Erkennungsbinderkette mit ausdrücklich synthetischem Debug-
Sprachdienst. Keine Mikrofon-/Google-Spracherkennungsqualität daraus abgeleitet.
Rohbefund `nachweise/2026-10-21-native-models-ci.json`. Paralleler PR-Lauf ebenfalls
erfolgreich; beide vorherigen instabilen Befunde sind damit erneut geprüft.

Neu zur Abnahme ergänzt und lokal kompiliert: echter WebView-PDF-/Formular-/
Unicode-/Vorlagen-/HTML-/ZIP- und verschlüsselter Sicherungsrückweg, tatsächliche
gebündelte Scanic- und Tesseract-Modelle bis zum durchsuchbaren PDF, ursprüngliche
Systemdateiauswahl sowie Kamera-Abbruch und synthetische JPEG-Rückgabe durch den
realen Berechtigungs-/FileProvider-Weg. Hardware und Kamera-App liefern in dieser
Gegenprobe ausdrücklich synthetische Dateien. Echte Samsung-Hardware bleibt
anschließend durch die gewünschte Erstinstallation zu prüfen.

Die neue Freigabekette `native-acceptance.yml` verlangt zusätzlich zur vollständigen
Originalkette beide Androidstände 12/API31 im Tabletprofil und 15/API35 im
Telefonprofil, mindestens 44 tatsächlich ausgeführte native Produktfälle ohne
Fehler/Skips und den Datenerhalt über APK-Neuinstallation durch die sichtbare
Oberfläche. Erst deren erfolgreicher Sammeljob heißt `native-smoke`. Der frühere
Foundation-Job wird weder umbenannt noch als vollständige Abnahme ausgegeben.
Der reguläre Signierweg bleibt main-exakt und verwendet dieselbe Identität.
Vor Veröffentlichung wird zusätzlich die tatsächlich signierte reguläre APK
installiert, über die Oberfläche ein Ordner angelegt und nach erneuter Installation
dessen Erhalt geprüft. Der veröffentlichte Installationsbeleg ist an APK-Hash,
Commit und reguläre App-ID gebunden; Debug-Prüfbelege werden abgewiesen.

Die Chrome-Fabrik unterscheidet Transportfehler von Nutzerabbruch, damit z. B.
fehlendes Chrome als Fehler sichtbar bleibt. Größere Absatzmengen werden in
kleinen Rahmen übertragen; außergewöhnlich große Einzelabsätze verwenden die
vorhandene Quell-Satzzerlegung und werden vor der PDF-Übernahme wieder demselben
Absatz zugeordnet. Die frühere technische 16-MiB-Eingangsgrenze begrenzt dadurch
nicht mehr die Dokument-/Seitengröße; nichts wird abgeschnitten. Der Server
behält eine begrenzte Nachrichtengröße zum Schutz vor defekten Browserantworten.
Bei gesperrtem Tresor wird die Dokumentoberfläche verborgen. Der Speicherdialog
benennt die tatsächliche Hauptablage und behauptet bei aktiver Tresoranbindung
keine ausschließliche Browserablage mehr. Quellmodule bleiben bytegleich.
