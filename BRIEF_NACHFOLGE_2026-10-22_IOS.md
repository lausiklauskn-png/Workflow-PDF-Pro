# Nachfolgeauftrag für die iOS Version von Workflow PDF Pro

Stand 22.10.2026. Dieser Brief bereitet die nächste Sitzung vor. Klaus hat die Windows-Arbeit vorerst beendet und möchte danach Workflow PDF Pro für iOS. Die iOS-Implementierung beginnt erst in der neuen Sitzung; durch diesen Brief wird keine iOS-Ausgabe als vorhanden behauptet.

## Auftrag und bestehende Produkte

Workflow PDF Pro als installierbare App für iPhone und möglichst iPad umsetzen, mit dem vorhandenen Anwendungskern, bewährter Bedienung, Datenschutz, Schutzfunktionen und zuverlässigem Speichern. Für iPad Fenstergrößen, Hoch-/Querformat und externe Tastatur berücksichtigen. Mindestversion und unterstützte Geräte anhand der tatsächlich verwendeten Werkzeuge festlegen; Klaus hat dafür noch keine konkrete iOS-Version genannt.

Repository: [lausiklauskn-png/Workflow-PDF-Pro](https://github.com/lausiklauskn-png/Workflow-PDF-Pro).

Android 1.0.1, Build 2, ist als reguläre APK unter `v1.0.1` veröffentlicht. Windows 1.0.1 ist als unsignierte Setup.exe unter `windows-v1.0.1` veröffentlicht. Windows-Sicherheitsverbesserungen mit Quellversion 1.0.2 sind in main, aber noch nicht veröffentlicht. [Windows-Abschluss](BRIEF_ABSCHLUSS_2026-10-22_WINDOWS.md) beachten. In main vor dieser Übergabe liegt `03599afc9959446878aeaf83a602c8ded2995261`; vorhandenen neueren Stand vor Arbeitsbeginn prüfen.

Aktuell gibt es im überprüften Repositorybaum keinen `ios/`-Host und keine iOS-Abnahme. Windows ist mit Tauri 2 umgesetzt; Android verwendet Capacitor 8.5.3. Das ist kein Auftrag, iOS ebenfalls mit Tauri zu bauen. Ausgangsempfehlung: den vorhandenen Capacitor-Aufbau für iOS erweitern und native Swift-Adapter ergänzen, sofern die anfängliche Prüfung keine konkrete Unverträglichkeit zeigt.

## Zuerst lesen und den Arbeitsstand prüfen

1. `AGENTS.md`, `docs/FOLGESITZUNG.md` und den vollständigen Originalauftrag `BRIEF_NACHFOLGE_2026-10-20_NATIVE_APP.md`.
2. `BRIEF_NACHFOLGE_2026-10-21_ANDROID_APK_AUSGELIEFERT.md`, aktuellen Android-Baustand und den Windows-Abschluss.
3. `docs/portierung/FUNKTIONSMATRIX.md`, `ENTSCHEIDUNGEN.md`, `SPEICHERORT-UND-TRESOR.md` und `docs/SIGNIERUNG-UND-GITHUB.md`.
4. `capacitor.config.json`, `tools/native/prepare-web.mjs`, `native/`, vorhandene Android-Plugins und deren Tests. Windows-Verträge und Tresor-Kompatibilitätsproben können als weitere Referenz dienen.

Bestehenden Checkout benutzen, lokale Änderungen und parallele Arbeiten prüfen und nicht zurücksetzen. Der aktuelle Cloud-Checkout kann hinter GitHub main liegen; lokal ungetrackte Windows-Dateien sind nicht automatisch neue, unveröffentlichte Eigenarbeit. In der abgeschlossenen Sitzung liefen GitHub-Lesen und -Schreiben über den vorhandenen Connector; Shell-Netzwerk war eingeschränkt. Tatsächliche aktuelle Rechte und Umgebung prüfen, ohne Tokens oder Secrets auszulesen. Keinen Worktree ohne Nutzerauftrag anlegen.

## Kern und vorhandene Plattformen erhalten

Der Quellcheckout Workflow-PDF und `upstream/workflow-pdf` bleiben unverändert. Die 191 Quelldateien stammen von `7227c543d4a536cf8f3354a56fbba7574645703e`; `node tools/onboarding/verify-upstream.mjs` prüft die Herkunft. PDF-Kern, Schutzmodule, Lizenzen, Modelle, Schriften, Sicherungsformate und dokumentierte Prüfgrenzen erhalten. Keine Dateiuploads an neue Dienste ohne ausdrückliche Wahl.

Nur öffentliche Laufzeitdateien lokal bündeln. Keine bloße Fern-Webseite, Schlüssel, private Dokumente, Tests oder Repository-Metadaten in das App-Paket aufnehmen. Android- und Windows-Host getrennt erhalten. Änderungen an gemeinsamen Adaptern wirken auf bestehende Apps und brauchen deren passende Regressionstests.

Bestehende Android-App-ID `de.familyprojekt.workflowpdf.pro` und Signieridentität niemals ersetzen oder für Apple verwenden. Für iOS dieselbe logische Produktidentität anstreben, die konkrete Bundle-ID aber mit vorhandener Apple-Team-Zuordnung und Verfügbarkeit abgleichen. Kein neues Apple-Konto oder kostenpflichtiges Abo ungefragt anlegen.

## iOS Anbindungen und Speicherung

Den gesamten Umfang der Funktionsmatrix auf iOS übertragen. Dazu gehören PDF-Anzeige und -Bearbeitung, Formular-/Originalexport, Unicode und Schriften, OCR, Worker/WASM, optionale Modelle, Bibliothek, Suche, Sicherungen, Wiederherstellung, Kamera und Mikrofon nach Bedarf, Spracheingabe, Drucken, Teilen, Dateiauswahl und Öffnen aus anderen Apps.

Die iOS-Sandbox ist keine frei verfügbare Windows-Festplatte. Dokument- und Ordnerauswahl über die dafür vorgesehenen iOS-Schnittstellen anbinden. Dauerhafte Zugriffsrechte, erneute Freigabe und Verhalten einzelner Dateianbieter praktisch prüfen. Ein iCloud- oder anderer Anbieterordner ist nicht automatisch vollständig offline verfügbar. Keine SD-Karte als iPhone-Voraussetzung annehmen.

Die gewählte Speicherung bleibt: interne Arbeitsdatenbank für Bibliothek/Suche und nötige Arbeitsdaten, verschlüsselter Tresor im gewählten Ordner als dauerhafte Hauptablage. Vollständiges Arbeiten im internen Gerätespeicher muss möglich sein. Tresorformat mit Android und Windows kompatibel halten und mit Gegenproben belegen. Gerätespezifische Schlüssel geschützt im Apple Keychain verwahren; gemeinsame Passwörter oder Schlüssel nicht in JavaScript, Logs oder Git schreiben.

Journal, Migration, ausstehende Schreibvorgänge, Sperren/Entsperren, App-Unterbrechung und Wiederaufnahme müssen zum iOS-Lebenszyklus passen. Hintergrundzeit nicht voraussetzen. Bei fehlendem Ordner, Schreibfehler, vollem Speicher, falschem Passwort oder widerrufenen Rechten nicht still auf eine leere Bibliothek wechseln. Speichern erst nach erfolgreichem dauerhaften Schreiben bestätigen. Deinstallation unter iOS kann lokale App-Daten entfernen; den Windows-Datenerhalt nicht darauf übertragen.

## Übersetzung und Sicherheit

Die Android-/Windows-Entscheidung für Chrome ist kein Beleg, dass derselbe Dienst oder Rückweg unter iOS funktioniert. WKWebView, externer Browser und native Übersetzung getrennt prüfen. Android-Vordergrunddienst und Windows-Loopback-Transport nicht ungeprüft übertragen. Privates Dokument nicht zum Umgehen einer Grenze auf einen öffentlichen Server stellen.

Zuerst verfügbare lokale APIs, Sprachpaare, Rücktransport und Einwilligungsablauf messen. Bestehende Reinigung, Abbruch ohne Senden und Hinweise erhalten. Routineentscheidungen selbst treffen; bei echter Funktionsabweichung oder neuem externem/kostenpflichtigem Dienst Klaus den konkreten Befund und eine begründete Wahl vorlegen. Keine Übersetzungsqualität oder Offlinefunktion aus simulierten Antworten ableiten.

Native Aufrufe auf vertrauenswürdige lokale Herkunft begrenzen, Navigation und externe Links kontrollieren, minimale Berechtigungen und verständliche Datenschutzhinweise vorsehen. CSP, lokale Ressourcen, Worker und erlaubte Netzziele unter WKWebView prüfen. Release ohne Debugzugang bauen. App-Store-Vorgaben zu Datenschutz, WebView und ausführbarem Code bei der Umsetzung berücksichtigen.

## Bauen und Ausliefern unter Apple

Für iOS-Bauten wird ein geeigneter macOS-Rechner oder macOS-CI mit passendem Xcode und SDK benötigt. Auf einem Linux-Runner sind Quellprüfungen möglich, aber keine vollständige native iOS-Abnahme. Simulator und physisches Gerät getrennt ausweisen.

Der kostenlose Windows-Weg einer unsignierten Setup.exe ist unter iOS kein entsprechender allgemeiner Installationsweg. Reguläre App-Store-Verteilung und TestFlight benötigen üblicherweise die Apple-Developer-Program-Mitgliedschaft; Ausnahmen und aktuelle Bedingungen gegebenenfalls prüfen. Ein kostenloses persönliches Entwicklungsteam ermöglicht begrenzte Tests auf eigenen Geräten und ist kein dauerhafter öffentlicher Vertriebsweg. Keine Kosten auslösen und keine App-Store-Veröffentlichung aus dem bloßen Vorbereitungsauftrag ableiten.

Die Sitzung soll unabhängig von einer noch fehlenden Apple-Mitgliedschaft mit Bestandsprüfung, Implementierung und verfügbaren Simulatorprüfungen vorankommen. Erst für den konkret benötigten Geräte-/Vertriebsschritt vorhandenes Apple-Team, Signing und Berechtigungen klären. Nur dann notwendige Nutzeraktionen bündeln; keine Apple-Passwörter, privaten Zertifikate oder Tokens im Chat anfordern.

iOS-Updates später über den gewählten Apple-Vertriebsweg planen. Den Windows-minisign-Updater nicht als Austausch des iOS-App-Codes übernehmen. Google Play betrifft die Android-App; die iOS-Ausgabe gehört in Apples Vertrieb.

## Arbeitsergebnis der nächsten Sitzung

1. Tatsächliche iOS-Voraussetzungen und wiederverwendbare Komponenten feststellen, passende Mindestversion begründen und einen kurzen Plan mitteilen. Ohne wiederholte Routinefreigaben umsetzen.
2. Den iOS-Host und erforderliche Geräteadapter integrieren, ohne Android/Windows zu beschädigen.
3. Einen iOS-Baustand mit Funktionsabdeckung und echten Nachweisen führen. Mindestens PDF/Formulare/OCR/Export, Tresor-Kompatibilität, Unterbrechung/Neustart, fehlenden Speicher, Sicherung/Rückimport sowie Dateieingang und Übersetzungsgrenzen prüfen.
4. Gebauten Host, Simulator, signiertes Gerät und veröffentlichte App klar auseinanderhalten. Fehlende Geräte oder Apple-Vertriebsrechte mit ihrer konkreten Auswirkung benennen.
5. Bei vollständig vorhandenen Voraussetzungen den prüfbaren Installationsstand bereitstellen; sonst fertige Vorarbeit und den eng begrenzten verbleibenden Apple-Schritt übergeben. Keine funktionsarme Hülle als fertige Pro-App bezeichnen.

Klaus möchte eigenständiges Arbeiten mit Logik, Sicherheit und Nutzerfreundlichkeit. Keine erneute Grundsatzbefragung zu bereits entschiedenen Speicher- oder Windows-Themen. Diese Sitzung endet mit der Übergabe; iOS-Arbeiten erst bei Wiederaufnahme beginnen.
