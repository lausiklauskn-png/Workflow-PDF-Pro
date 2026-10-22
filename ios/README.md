# Workflow PDF Pro für iOS – laufende Implementierung

Dieser Host verwendet denselben `tools/native/prepare-web.mjs` wie Windows und Android.
`upstream/workflow-pdf` bleibt unverändert. Der Apple-Host ist noch keine vollständige
oder veröffentlichte App. Portabler Tresor, Ordnerfreigaben, Keychain und die
Bibliotheksanbindung sind implementiert und im Simulator geprüft. Übersetzungswege,
Share Extension und vollständige Geräteabnahme fehlen noch.

## Reproduzierbarer Bau

Node 24, Capacitor 8.5.3, Swift Package Manager. Die Framework-Untergrenze ist iOS 15;
die endgültige Mindestversion muss mit dem vollständigen Funktionsumfang geprüft werden.
Die Bundle-ID `de.familyprojekt.workflowpdf.pro` ist für den unsignierten Bau gesetzt;
Apple-Team/Verfügbarkeit sind vor einem signierten Gerätebau zu bestätigen.

Im Repositoryverzeichnis:

```sh
npm ci
npm run verify:upstream
npm run sync:ios
node --test ios/tools/test-bundle.mjs
```

`sync:ios` bündelt den gemeinsamen Kern, synchronisiert Capacitor und ergänzt **nur**
das generierte Apple-Bündel um CSP und Apple-Kennung. Ein alleiniger `cap sync ios`
überschreibt diese Ergänzungen; anschließend `node ios/tools/finalize-web.mjs` ausführen.
Generierte Laufzeitdateien, lokale Signierung und Bauausgaben werden nicht eingecheckt.

Auf macOS mit Xcode:

```sh
swift test --package-path ios/WorkflowNativeCore
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'platform=iOS Simulator,name=<verfügbares iPhone>' \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- test
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```

Die konkrete verfügbare Simulator-ID zeigt `xcrun simctl list devices available`.
CI wählt eine verfügbare iPhone-ID automatisch. Ein unsignierter Gerätebau ist
keine installierbare IPA und kein Ersatz für Apple-Signierung.
Der Simulator nutzt ausschließlich lokale Ad-hoc-Signierung für die Keychain-Probe,
keine Apple-Vertriebsidentität.

## Implementierte Grenzen

- Native Ticketübergabe in höchstens 256-KiB-Blöcken; unvollständige Dateien,
  falsche Reihenfolge, ungültiges Base64 und unbekannte Kennungen werden abgewiesen.
- Speichern über Apples Dokumentexport, Erfolg erst nach erneutem Lesen und
  SHA-256-Vergleich der Zieldatei; nicht bestätigbarer Providerzugriff bleibt ein Fehler.
- Systemteilen und Druckdialog. Öffnen des Teilendialogs ist keine bestätigte Zustellung.
- Ordnerimport über explizite Freigabe, koordinierte vollständige Kopie und begrenzte
  Leseaufrufe. Bei einem Fehler wird kein Teilordner an den Webkern übergeben.
- Öffnen von Dateien aus anderen Apps mit dauerhafter, explizit zu bestätigender
  Warteschlange, Empfangsarchiv und Wiederherstellung. Fehlende/beschädigte Metadaten
  dürfen keine leere Erfolgsansicht erzeugen. Eine Share Extension fehlt noch.
- Vor Capacitors Plugin-Dispatch prüft eine native Nachrichtensperre Hauptframe
  **und** Hauptseiten-URL. Externe Seiten und eingebettete Frames erhalten keinen Zugriff.
- Kein entfernter Prüfzugang; WebView-Inspektion bleibt deaktiviert.

Der unvollständige Host darf noch nicht als reguläre Pro-Ausgabe verteilt werden.
Dateieingang/temporäre Dateien sind durch die iOS-Sandbox und System-Dateischutz
abgesichert. Die Bibliothek kann zusätzlich den portablen verschlüsselten Tresor
als Hauptablage verwenden.

Aktuelle Messergebnisse und offene Aufgaben: `docs/portierung/BAUSTAND-IOS.md`.

## Tresorbausteine und Gegenproben

`WorkflowNativeCore` enthält den PBV1-Dateicodec, NFC/PBKDF2, WFP1-Ersatzschlüssel,
dauerhafte Ordner-Bookmarks, koordinierte Dateianbieterzugriffe, gerätegebundene
Keychain-Ablage und `DocumentVault` mit verschlüsseltem Index, Generationen,
Schreibchargen und Passwortfächern nach Ersatzschlüssel-Wiederherstellung.
`WorkflowVaultPlugin` bindet diese Komponenten an den unveränderten gemeinsamen
Bibliotheks-, Journal- und Migrationsadapter an. Passwort und Ersatzschlüssel werden
in nativen Dialogen eingegeben; JavaScript erhält keine Schlüssel.

Auf macOS prüfen:

```sh
swift test --package-path ios/WorkflowNativeCore
node ios/tools/test-vault-interop.mjs
```

Die zweite Probe benötigt JDK und Rust/Cargo. Sie verwendet die unveränderten
Android- und Windows-Implementierungen, synthetische öffentliche Schlüssel und
zufällige temporäre Verzeichnisse. Sie prüft 54 Dateicodec-Richtungen, drei
Passwortableitungen, 90 Ersatzschlüsselkombinationen und neun vollständige
Tresorordner-Richtungen. Ein erfolgreicher Dateicodec-Lauf allein ist kein
vollständiger Ordner- oder Produktnachweis.

`VaultFolder` bestätigt synchronisiertes Schreiben und Rücklesen beim Dateianbieter;
das bestätigt keine abgeschlossene Synchronisation mit einem iCloud-Server.
Fehlende/widerrufene Freigaben führen zu Fehlern. Es gibt keinen Ersatzordner.
`DocumentVault` validiert vor dem Aufräumen alle Generationen und behält die drei
neuesten mit ihren gemeinsam verwendeten Datensätzen. Beschädigung stoppt das
Aufräumen. Der lokale Revisions-/Indexprüfpunkt schützt auch Dokumentmetadaten
vor Rücksetzung beim erneuten Auswählen eines älteren Tresorordners.
