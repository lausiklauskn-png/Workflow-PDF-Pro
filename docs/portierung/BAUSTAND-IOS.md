# iOS-Baustand – Workflow PDF Pro

Stand 22.10.2026. Klaus hat nach Abschluss der parallelen Claude-Arbeit den Bau
freigegeben. Gemeint ist Workflow PDF Pro aus derselben Quelle wie Windows.

## Ausgangsstand

Aktuelles main `4bf83efcac603d654abba1e0a87d816987a75667` wurde nach Prüfung des
sauberen Arbeitsbaums per Fast-Forward übernommen. Enthalten sind der gemeinsame
Kern 1.1.0, native Versionsanzeige, „Alle prüfen“ und die Android-/Windows-Erweiterung
für Tresor-Ersatzschlüssel. Der Kern stammt jetzt aus
`db3830e23b1207498efa083d00678f2de31379f7`, nicht mehr aus dem historischen
7227c543-Stand. **193/193** Dateien sind unverändert verifiziert.

Arbeitsbranch: `codex/ios-native-host`. Windows-/Android-Quellcode und
`upstream/workflow-pdf` werden durch die iOS-Implementierung nicht bearbeitet.

## Implementierung

Capacitor 8.5.3 mit exakt gepinnter iOS-Abhängigkeit und SPM, iPhone/iPad-Ziel,
Produkticon aus dem vorhandenen Pro-Icon. Der identische gemeinsame Bündler bleibt
die Quelle. Die Apple-Ergänzungen entstehen ausschließlich im generierten iOS-Bündel.

Native Komponenten:

- `WorkflowBridgeViewController`: Registrierung und Herkunfts-/Hauptframeprüfung
  vor Plugin-Dispatch, deaktivierte WebView-Inspektion.
- `WorkflowFilesPlugin`: Version aus Bundle, begrenzte Schreibtickets,
  Dokumentexport mit erneuter Prüfsumme, Systemteilen, Drucken, externe Links.
- `WorkflowImportPlugin`: explizite Ordnerwahl, koordinierte vollständige Kopie,
  Unterordner/Unicode, begrenztes Lesen und Aufräumen ohne Teilimport.
- `WorkflowIncomingPlugin` und Scene-Anbindung: Dateieingang über „Öffnen mit“,
  dauerhafte explizite Warteschlange, Empfangsarchiv und erneutes Anbieten.
- `WorkflowNativeCore`: vom UI unabhängige Swift-Verträge mit echten Dateiproben.
- In der Fortsetzung: `WorkflowVaultPlugin`, `WorkflowSpeechPlugin` und
  `WorkflowShare.appex`; aktuelle Implementierungs-/Prüfgrenzen am Ende dieser Datei.

Framework-Untergrenze laut Paket: iOS 15.0. Das ist noch keine vollständige
Abnahme auf iOS 15; notwendige neue APIs dürfen nicht unbemerkt die endgültige
Mindestversion verändern. Apple-Team und Bundle-ID-Verfügbarkeit sind ungeprüft.

## Neue Nachweise

- Linux: eingefrorene npm-Installation, `sync:ios` und Herkunftsprüfung erfolgreich.
- Gemeinsame native Browserkette: **33/33** bestanden, keine Skips.
- Tresorkomponenten unter Node: **41/41** bestanden, keine Skips; kein iOS-Tresornachweis.
- Apple-Paketprüfung: **3/3** bestanden. Herkunft, unveränderte Schutzmodule,
  Laufzeit-Allowlist, Ausschluss fremder Dateien, CSP und Startreihenfolge geprüft.
- Erster macOS-Lauf `39810507308`: Swift-Dateiverträge erfolgreich; Simulatorbau
  fehlgeschlagen. Nicht als Simulator- oder Gerätenachweis werten.
- Bei der Untersuchung korrigiert: UInt64 als nicht unterstützter JSValue-Typ und
  falsche von der Projektbibliothek erzeugte Testpaket-Endung. Zusätzliche Gegenprobe
  gegen das stille Zurücksetzen eines Empfangsindex ergänzt.
- Lauf `39811790747` auf `bdd9321`: **7/7** Swift-Dateitests bestanden. Der native
  Simulatorhost wurde kompiliert und gestartet, das Testpaket konnte wegen der
  fehlenden Swift-WebKit-Laufzeitbibliothek nicht geladen werden. Keine eigentlichen
  WKWebView-Tests ausgeführt; Lauf bei der Ablösung abgebrochen.
- Gegenmaßnahme: WebKit-Proben verwenden die Objective-C-Completion-Schnittstelle
  mit eigener begrenzter Promise-Beobachtung; Swift-Laufzeit wird eingebunden.
  Lauf `39813164051` auf `ff20b56` bestätigt die behobene Testpaket-Ladung:
  **7/7** Dateitests und **3/4** App-gehostete Tests bestanden. Native Dateiübergabe,
  Version und Herkunftsprüfung funktionieren in diesen Proben. Die PDF-/Formular-/
  Original-/Neuladeprobe lief in ein Timeout; sie ist ausdrücklich nicht bestanden.
  Eine wahrscheinliche Rennbedingung in der Probe (alte Globals direkt nach reload)
  ist in `1b60246` korrigiert, mit unveränderten Datenassertionen. Nachprüfung im Lauf
  `39815186968` war beim Dokumentieren noch eingereiht. Ursache erst nach dessen
  Ergebnis als bestätigt betrachten.
- Tatsächliche erste Apple-Werkzeuge: Xcode 16.4 (16F6), Swift 6.1.2,
  iOS-Simulator-SDK 18.5. Weitere Simulator-/Gerätenachweise bleiben offen.
- SwiftPM ist zusätzlich auf den bestätigten 8.5.3-Tag-Commit
  `4c7f346d16196e21fbe23d4a7a6fc7af62af6742` festgelegt; die offiziellen
  Binärprüfsummen bleiben unverändert. Keine offene Prüfung als Erfolg zählen.

- GitHub-Job `119945319456` auf `ff20b56`: die vollständige unveränderte Original-
  Testkette, gemeinsame Browserfälle, Release-Auftragsgegenproben und Tresor-/
  Journalfälle bestanden. Das ist kein nativer Android-/Windows-Gerätenachweis.
- Gemessene WKWebView-Fähigkeiten aus dem xcresult: sicherer Kontext,
  IndexedDB und CacheStorage vorhanden; Worker und WebAssembly vorhanden;
  lokale russische OCR-Sprachdatei mit 3.861.738 Bytes vollständig geladen.
  **Kein Service Worker, keine Browser-Translator-API.** Ein vorhandener Speech-
  Konstruktor belegt keine erfolgreiche Aufnahme/Erkennung. Dateiladen belegt keine OCR.
- Nachweise: `nachweise/2026-10-22-ios-foundation.json` und
  `nachweise/2026-10-22-ios-wkwebview-capabilities.json`. Noch kein signierter Bau,
  keine physische Geräteprüfung und kein App-Store-/TestFlight-Release.

Die URL-Herkunftsregeln wurden zuerst als native Policy-Gegenprobe geprüft.
Der aktuelle Eintrag unten enthält zusätzlich einen echten Same-Origin-Subframe-
Angriff über WebKits Nachrichtenhandler.

## Noch erforderlich, bevor die Pro-App vollständig ist

1. Native Apple-Bauten und echte WKWebView-Proben grün halten; iPad und begründete
   Mindestversion ergänzen. PDF/Formulare, OCR/WASM/Worker, Schriften, Exporte,
   Sicherung/Rückimport, interne Persistenz und ursprüngliche Schutzprüfungen messen.
2. Den vollständigen bestehenden Dokumenttresor einschließlich Speicherwahl,
   Keychain, Journal-/Index-Kopplung, Migration und **Ersatzschlüsseln 3 von 5** anbinden.
   Android↔iOS und Windows↔iOS müssen kompatibel sein. Fehlender Ordner, widerrufene
   Rechte, voller Speicher, falsches Passwort und Prozessende dürfen weder leere
   Bibliothek noch bestätigtes unvollständiges Schreiben erzeugen.
3. WKWebView-eigene Grenzen von Service Worker/CacheStorage und optionalen Modellen
   messen. Keine bloße Entfernung ihrer Funktionen, kein öffentlicher Dokumentserver.
4. Echte Übersetzung einschließlich Reinigung, Abbruch und Rückweg auf Apple messen.
   Android-/Windows-Nachweise und simulierte Antworten sind keine iOS-Belege.
5. Spracheingabe, Kamera, Mikrofonfreigaben, Dateianbieter-/iCloud-Verhalten,
   Share Extension und Lebenszyklus fertigstellen; UI in DE/EN/RU/AR einschließlich
   RTL, Tastatur, Drehung und iPad-Fenstergrößen abnehmen.
6. Ganze Funktionsmatrix gegen aktuelle Nachweise abgleichen. Browserfixtures,
   Simulator, physisches Gerät und Veröffentlichung getrennt benennen.
7. Erst dann vorhandenes Apple-Team und signierte Geräte-/Vertriebsrechte verwenden.
   Kein Apple-Konto/Abonnement wurde angelegt; kein signiertes Paket, App-Store-
   Eintrag oder TestFlight-Release existiert aus dieser Arbeit.

Das ist ein laufender Implementierungsstand, keine funktionsreduzierte fertige
Pro-Ausgabe. Vor einem größeren Eingriff in den gemeinsamen Kern gelten weiterhin
die dokumentierten Grenzen. Die Folgesitzung setzt an diesen offenen Punkten an.

## Fortsetzung: Apple-Tresorformat (22.10.2026)

Der exakte PR-Commit `1dcb17b` wurde nachgelesen: Apple-Lauf
[39815991648](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39815991648)
mit Job `119955043942` ist vollständig grün. Das Rohprotokoll bestätigt **7/7**
Swift-Dateitests und **4/4** Hosttests, einschließlich PDF/Formular/Original und
Neuladen; auch der unsignierte Gerätebau bestand. Android-Lauf `39815991801`
ist ebenfalls erfolgreich. Diese Nachweise gelten für diesen Ausgangscommit.

Neu ergänzt: Apple-PBV1-Dateicodec (AES-256-GCM, 256-KiB-Blöcke, gebundener Name,
Position und Endmarke), NFC/PBKDF2 sowie kompatible WFP1-Ersatzschlüssel 3 von 5.
Dateicodec schreibt nur neue Dateien, synchronisiert und überschreibt keine
bestehende Datei oder symbolische Verknüpfung. Leere Dateien werden ebenfalls
authentifiziert; nichtkanonische zusätzliche Leerblöcke werden abgewiesen.

Neue macOS-Gegenprobe: unveränderter Android-Java-Code und Windows-Rust-Kern
gegen Apple CryptoKit, sechs Größen einschließlich leerer Datei und Blockgrenzen,
alle neun Schreib-/Leserichtungen, NFC-Passwortableitung sowie alle zehn
Dreierkombinationen für jede der neun Ersatzschlüsselrichtungen. Swift-Gegenproben
prüfen zusätzlich falsche Schlüssel/Namen, Manipulation, Reihenfolge, Abschneiden,
zusätzliche Daten und Überschreibschutz. Neue Apple-Nachweise stehen noch aus.

An diesem Zwischenstand waren die Bausteine noch nicht als `WorkflowVault`-Adapter
aktiviert. Die inzwischen geprüfte Anbindung ist im folgenden aktuellen Eintrag
beschrieben. Keine vollständige Geräteabnahme daraus ableiten.

### Weitere Implementierung derselben Fortsetzung

- `VaultFolderGrant` speichert Apple-Ordner-Bookmarks getrennt vom portablen Tresor.
  `VaultFolder` koordiniert Anbieterzugriffe, bestätigt neue Dateien nach Rücklesen
  und Dateisystem-Synchronisation und verweigert Überschreiben/Links/Traversal.
  Fehlender Ordner oder beschädigtes Bookmark erzeugen keinen leeren Ersatz.
- `VaultKeychain` speichert optional nur den Datenschlüssel, gerätegebunden und
  nur bei entsperrtem Gerät; keine Passwortübertragung an JavaScript.
- Auf `6e52bb9` bestätigte Job `120057140897` **13/13** Swift-Tests einschließlich
  Bookmark-Neustart und Fehlerszenarien. Der Gesamtlauf wurde bei Ablösung des
  Commits abgebrochen; daraus folgt keine vollständige Simulatorabnahme.
- Auf `0b6d441` bestand die neue echte Drei-Plattform-Probe für 54 Dateicodec-
  Richtungen, drei NFC-Passwortableitungen und 90 Ersatzschlüsselkombinationen
  (Job `120055579284`). Der spätere Hosttest wurde durch Ablösung abgebrochen.
- Neu hinzugefügt: `DocumentVault` für vollständige portable Ordner, verschlüsselte
  Indexgenerationen und Commit-Markierungen, blockweises Schreiben/Lesen,
  Schreibchargen, Neustartprüfung, Ersatzschlüssel-Hülle und zusätzliche
  Passwortfächer. Neuste beschädigte Generation wird nicht übersprungen;
  verschobene Generationen und doppelte Revisionsmarkierungen sperren den Zugriff.
  Apple↔Android↔Windows-Ordnerproben und deren Swift-Tests stehen noch aus.
- Zu diesem Zwischenstand fehlten noch Aufräumregel, `VaultLocations`,
  Plugin-/Passwort-UI, native Recovery-Anzeige und die produktive Anbindung.
  Diese Komponenten sind inzwischen implementiert (aktueller Eintrag unten).
- Neue Hostproben führen echte DE/EN/RU-OCR mit lokalem Worker/WASM aus und
  messen native Übersetzungs-Sprachpaare/Spracheingabe-Verfügbarkeit. Für deren
  Ergebnis den aktuellen Apple-Lauf prüfen; eine Verfügbarkeitsabfrage ist kein
  ausgeführter Übersetzungs- oder Sprachlauf.
- Neue lokale Regressionen: **193/193** Herkunftsdateien unverändert, **33/33**
  gemeinsame Browserfälle und **41/41** Tresorkomponenten bestanden, keine Skips.
  Es wurden keine Änderungen an Android, Windows oder dem gemeinsamen Kern gemacht.

Workflow PDF Pro für iOS ist weiterhin nicht vollständig abgeschlossen. Es wurde
kein Nachfolgebrief für Private Brain Pro erstellt.

### Aktuelle Anbindung und bestandene Apple-Prüfung

Commit `cd9169662264632db6a20c4f65fc295d80782e33`, Apple-Lauf
[39849604499](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39849604499),
Job `120071918263`: vollständig erfolgreich. Rohprotokoll bestätigt **16/16**
Swift-Datei-/Tresortests, **54** Dateicodec-Richtungen, **3** NFC-Ableitungen,
**90** Ersatzschlüsselkombinationen, **9** vollständige Ordner-Richtungen und
**8/8** echte App-gehostete WKWebView-Tests. Unsigned Release-Gerätebau bestanden.
Der Simulator verwendet Ad-hoc-Signierung für den tatsächlichen Keychain-Zugriff;
das ist keine Apple-Vertriebssignierung.

- `WorkflowVaultPlugin` ist registriert. `VaultLocations` erhält Hauptablage und
  Migrationszeiger dauerhaft; native Passwort-/Recovery-Dialoge und optionaler
  gerätegebundener Keychain-Schlüssel sind angebunden. Gemeinsame Adapter unverändert.
- Die WKWebView-Probe migriert echte IndexedDB-Datensätze und PDF-Bytes über den
  unveränderten gemeinsamen Adapter in einen realen nativen Tresor. Der interne
  Dateidatensatz wird eine Referenz; strukturierter Übersetzungsauftrag bleibt
  erhalten. Entfernen des Ordners sperrt anschließend Auftragslesen und -schreiben.
- Lokale Worker-/WASM-OCR erkennt synthetische Texte tatsächlich in DE/EN/RU.
  Die native Übersetzungs-Verfügbarkeitsprobe meldet im Simulator alle sechs
  DE/EN/RU-Richtungen als nicht unterstützt. Kein Übersetzungslauf ausgeführt.
  Auch Spracheingabe wurde lediglich auf Verfügbarkeit geprüft.
- Neuere, noch nachzuprüfende Ergänzungen: generationenbewusstes Aufräumen nach
  Schreibabschluss, direktes Subframe-Angriffsszenario, Files-App-Sichtbarkeit,
  koordinierter App-Group-Empfangsbaustein und stärkere lokale Kontinuitätsprüfung
  beim Wiederanbinden älterer oder abweichender Tresorkopien. App-Group-Baustein
  allein ist noch keine fertige Share Extension.

Offen bleiben insbesondere vollständige Übersetzungs-/Rückwege, Spracheingabe,
Share Extension, iPad-/Mindestversionsabnahme, physische Geräte und echte
Dateianbieter-/Unterbrechungsproben sowie spätere Signierung und Verteilung.
Die oben stehende historische Aufgabenliste ist anhand dieses Eintrags zu lesen;
ein bestandener Simulatorlauf ist keine vollständige Produktabnahme.

### Sicherheitsprüfung und Erweiterungen nach diesem Lauf

Commit `9ea382cce15b9ebffb5f5bf6ca5dc2c5c7141229`, Apple-Lauf
[39851891286](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39851891286),
Job `120079973405`: vollständig grün. **19/19** Swift-Tests und **9/9**
WKWebView-Hosttests, Drei-Plattform-Gegenproben und unsignierter Gerätebau bestanden.
Die neuen Gegenproben belegen:

- Nur an PDF-Dateien zu vergleichen genügt nicht: lokale Revisions-/Indexprüfstände
  weisen ältere Ordnerkopien und abweichende Dokumentmetadaten derselben Revision
  beim Wiederanbinden zurück. Der bisherige Hauptort bleibt erhalten. Eine aktuelle
  identische Kopie lässt sich auch bei entzogenem altem Ordner wieder anbinden.
- Ein laufender Tresor weist ersetzte Commit-Markierungen ab; nach Neustart wird
  auch der authentifizierte Indexinhalt gegen den lokalen Prüfstand verglichen.
- Ein echter eingebetteter Same-Origin-Frame erreicht den WebKit-Handler, bekommt
  aber keinen nativen Aufruf ausgeführt; die Hauptframe-Kontrollanfrage funktioniert.
- Ein veröffentlichter Standortkatalog wird bei nachfolgend fehlgeschlagener
  Synchronisation nicht durch Zurückverschieben seiner Dateien ungültig gemacht.

Auf `e8ab661` wurde die Share Extension tatsächlich eingebettet und kompiliert,
auch der unsignierte Gerätebau bestand. Lauf
[39852974761](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39852974761)
bestätigt **20/20** Swift-Tests einschließlich kurzlebiger NSItemProvider-Dateien,
ganzer Empfangsgruppen, Abbruch und unabhängiger koordinierter Clients. Im Host
bestanden **9/10** Fälle. Der neue native→Web→Archiv→Wiederherstellungsfall scheiterte
mit `INCOMING_DAMAGED`: Foundation-JSON wurde als Capacitor-`JSObject` gecastet.
Die Brücke konstruiert nun ausdrücklich typisierte Werte; Datenassertionen bleiben
erhalten und Aufrufe erhalten zur Diagnose ihren Methodennamen. Dieser Lauf ist
wegen des Fehlers ausdrücklich **nicht vollständig grün**.

Weitere neue Implementierung, Nachprüfung des aktuellen Commits erforderlich:

- Native Spracheingabe mit Freigaben, begrenztem Stoppen und Aufräumen bei
  Unterbrechung/Hintergrund/Navigation; gemeinsame JS-Ereignisform bleibt erhalten.
  Kein erfolgreicher Sprachlauf aus der bloßen Verfügbarkeitsprobe ableiten.
- Neue Ersatzschlüsselsätze lassen bisherige Teile bis zur nativen Bestätigung
  ihrer Aufbewahrung gültig. Neustart davor soll keine bisherigen Teile entwerten;
  neue Teile werden vor dem Entfernen der alten Manifestdateien erneut geprüft.
- Unterbrochene private Import-/Empfangs-/Schlüsselexport-Kopien werden beim Start
  aufgeräumt. Geteilte Exportkopien erhalten für mögliche Nachleser 24 Stunden.
- Eigener iPad-Hostlauf, verschlüsselte Sicherungs-/Original-/Rückimportprobe,
  vier UI-Sprachen und RTL bei drei WKWebView-Größen, Offline-OCR-Ressourcensperre
  und Import der gepinnten optionalen Modellbibliothek. Die Apple-CSP erlaubt nun
  auch deren exakte Basis-URL, die der unveränderte Kern tatsächlich importiert.
  Das sind noch keine physischen Drehungs-/Tastatur-/Modellabnahmen.

`ios/README.md` beschreibt App Group und aktuellen Bau. Die App-Group-/Bundle-
Zuordnung ist vor signierten Geräten mit dem vorhandenen Team zu bestätigen.
Keine Kosten, Konten oder signierten Veröffentlichungen wurden ausgelöst.

Apple bestätigt in [Meet the Translation API](https://developer.apple.com/videos/play/wwdc2024/10117/),
dass diese APIs im Simulator nicht funktionieren. Die gemessenen nicht unterstützten
Paare sind daher kein Nachweis fehlender Übersetzung auf einem echten iPhone.
Die physische Probe bleibt erforderlich. Neuere APIs für längere Hintergrundaufträge
und direkte Übersetzungssitzungen sind an konkrete Betriebssystem-/SDK-Versionen
gebunden; aus dem älteren gemessenen SDK keinen universellen iOS-Ausschluss ableiten.

Erster neuer iPad-Nachweis auf `35a0475ee503fd8bdf12198b71c18083939ad2bb`:
Lauf [39855024240](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39855024240),
Job `120091222612`, iPad Pro 11-inch (M4), iPadOS-Simulator 18.5: **14/14**
Hosttests bestanden. Korrigierter gemeinsamer Eingang bis Archiv/Wiederherstellung,
verschlüsselte Sicherung mit Original und Überschreibschutz, OCR mit blockierten
HTTP-/HTTPS-Ressourcen, vier UI-Sprachen/RTL, nativer Speech-Vertrag ohne Aufnahme
und Import der echten gepinnten Modellbibliothek bestätigt. Der Bibliotheksimport
bestätigt weder Modelldownload noch Embedding/Offline-Modellrechnung.

Der Folgeentwurf ergänzt eine sichtbare Latin-/Kyrillisch-Schriftprobe aus dem
unveränderten Upstream-Test, genaue Kontrolle der angeforderten WKWebView-Breite,
SHA-256-Rücklesen eingegangener Dateien, Apple-MIME-Typen, Unicode-Dateinamen mit
erhaltener Endung und lokalisierte native Kamer-/Mikrofon-/Speech-Freigabehinweise.
Diese Ergänzungen benötigen ihren eigenen Apple-Lauf. Reguläre Hardware-Drehung,
externe Tastatur und Dateianbieter bleiben davon getrennte Geräteproben.
