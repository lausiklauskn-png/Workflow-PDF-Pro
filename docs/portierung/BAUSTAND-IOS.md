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
  **7/7** Dateitests und **3/4** echte WKWebView-Tests bestanden. Native Dateiübergabe,
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
