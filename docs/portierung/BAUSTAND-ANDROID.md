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
