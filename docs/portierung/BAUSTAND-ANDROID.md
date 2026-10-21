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
