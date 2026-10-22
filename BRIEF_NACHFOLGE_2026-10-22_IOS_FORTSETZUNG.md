# Fortsetzung: Workflow PDF Pro für iPhone und iPad

Klaus hat am 22.10.2026 nach Abschluss der parallelen Claude-Code-Arbeit ausdrücklich
mit dem iOS-Bau begonnen und selbstständige technische Arbeit freigegeben. Die frühere
Vorgabe „nur vorbereiten, keinen Code schreiben“ gilt nicht mehr. „Book Club PDF Pro“
wurde im Gesprächskontext als Workflow PDF Pro verstanden. iOS soll dieselbe gemeinsame
Produktquelle wie die Windows-Installation verwenden.

## Auftrag und Reihenfolge

Workflow PDF Pro vollständig für iOS umsetzen, keine funktionsarme Hülle als fertige
Pro-App ausgeben. Falls Workflow PDF Pro noch offen ist, bleibt die nächste Sitzung
bei diesem Produkt. **Erst nach dessen vollständigem Abschluss** einen Nachfolgebrief
für die iOS-Version von Private Brain Pro erstellen. Private Brain wurde hier weder
verändert noch als bereits beauftragt gebaut.

Keine Grundsatzfragen zu bereits gewähltem Speicher, Android-Identität oder
Windows-Signierung wiederholen. Vorhandene GitHub-Anmeldung normal nutzen. Freibrief
ersetzt keine Apple-Mitgliedschaft, Zertifikate, Plattformrechte oder realen Geräte.
Keine Zugangsdaten auslesen, keine kostenpflichtigen Konten oder Abos erfinden.

## Wo weiterarbeiten

Repository: lausiklauskn-png/Workflow-PDF-Pro.
Branch: `codex/ios-native-host`, **Entwurf-PR #17**:
https://github.com/lausiklauskn-png/Workflow-PDF-Pro/pull/17

Bestehenden Checkout benutzen, keinen Worktree ohne Auftrag anlegen. Zuerst
`git status`, HEAD, remote main und den PR-Stand prüfen. Keine ungesicherten Änderungen
zurücksetzen. Neuere Commits nicht aus diesem Brief durch alte SHAs ersetzen.

Ausgangspunkt war main `4bf83efcac603d654abba1e0a87d816987a75667`, nach Prüfung per
Fast-Forward übernommen. Enthalten sind Kern 1.1.0, Versionsanzeige, „Alle prüfen“
und Tresor-Ersatzschlüssel 3 von 5. Der gemeinsame Quellkern stammt aus
`db3830e23b1207498efa083d00678f2de31379f7`; **193 Dateien** werden bytegleich geprüft.
Historische Angaben zu 191 Dateien und dem 7227c543-Commit sind für diesen Stand veraltet.

## Bereits implementiert

- `ios/`: Capacitor 8.5.3 mit SPM, iPhone/iPad, vorhandenes Pro-Icon, lokaler gemeinsamer
  Kern. Keine Änderungen an `upstream/workflow-pdf`, `native/`, Android oder Windows.
- `npm run sync:ios`: gemeinsamer Web-Bündler → Capacitor-Sync → Apple-spezifische CSP
  und Hostkennung ausschließlich im generierten Apple-Bündel. Einzelnes `cap sync ios`
  ersetzt die Dekoration; danach `ios/tools/finalize-web.mjs` ausführen.
- Native Dateiübergaben mit begrenzten Blöcken, Abschlusskontrolle, Datei-Export mit
  erneutem SHA-256-Vergleich, Systemteilen, Druckdialog und kontrollierten externen Links.
- Ordnerimport als vollständige koordinierte Kopie, ohne stillen Teilimport.
- Dateieingang über „Öffnen mit“, dauerhafte Warteschlange, explizite Bestätigung,
  Empfangsarchiv und erneutes Anbieten. Beschädigte/fehlende Empfangsmetadaten werden
  nicht als leere erfolgreiche Warteschlange behandelt.
- Herkunfts-/Hauptframeprüfung vor Capacitors Plugin-Dispatch. Nur lokale Hauptseite,
  keine externen oder eingebetteten Aufrufer. WebView-Inspektion deaktiviert.
- Swift-Paket mit echten Dateisystemtests; app-gehostete WKWebView-Tests und Apple-CI.

Dies ist noch kein implementierter portabler verschlüsselter Haupttresor, keine
vollständige iOS-Abnahme und keine veröffentlichte App.

## Unbedingt lesen und prüfen

1. `AGENTS.md`, `docs/portierung/BAUSTAND-IOS.md`, `ios/README.md`.
2. Ursprünglicher iOS-Brief `BRIEF_NACHFOLGE_2026-10-22_IOS.md` und vollständiger
   Native-Auftrag vom 20.10.; neue Herkunft und Speichererweiterungen beachten.
3. Aktuelle `FUNKTIONSMATRIX.md`, `SPEICHERORT-UND-TRESOR.md`, `SPEICHERINVENTAR.md`
   und `ENTSCHEIDUNGEN.md`. Historische offene Einträge anhand neuerer Nachweise einordnen.
4. Windows-Bündler/-Brücke, `windows/core`, neue Recovery-Implementierungen und aktuelle
   Android-Verträge. Der Windows-Host ist eine Referenz, kein iOS-Gerätenachweis.

## Nächste technische Schritte

1. **Den neuesten Apple-Lauf des exakten PR-Commits prüfen.**
   `.github/workflows/ios-app.yml` führt Paketintegrität, Swift-Dateitests,
   WKWebView-Simulatorprüfungen und unsignierten Gerätebau aus. Fehler über Checks-
   Annotationen und gespeicherte Log-/xcresult-Artefakte untersuchen. Xcode-Abhängigkeit
   des Testtargets zum App-Target wurde explizit angelegt; die Projektbibliothek hatte
   sie ohne vorhandene PBX-Sektionen still nicht erzeugt. Frühere fehlgeschlagene oder
   abgebrochene Läufe nicht als Erfolg melden.
2. **Vollständigen Dokumenttresor anbinden:** dauerhafte Ordnerfreigaben und
   Anbieterkoordination, Keychain, Sperren/Entsperren, Hauptablage, Journal/Index,
   Migration, Einstellungen sowie Ersatzschlüssel 3 von 5. Neuere Android-/Windows-
   Formate erhalten. Gegenproben in beide Richtungen mit beiden Plattformen ausführen.
   Der reine Rust-Kern unter `windows/core` ist eine mögliche Wiederverwendungsquelle;
   nicht ungeprüft Windows-Pfadzugriffe auf Apple-Dateianbieter übertragen.
3. **WKWebView messen:** PDF/Formulare, Originale, Unicode, OCR/WASM/Worker, lokale
   Modelle, CacheStorage/Service Worker und vollständige Offlinewege. Capacitors
   Standardschema ist `capacitor://localhost`; ein Chromium-Nachweis sagt darüber nichts.
   Keine Workerfunktionen still entfernen und keine privaten Dokumente extern hosten.
4. **Übersetzung/Rückweg:** Android-Vordergrunddienst und Windows-Loopback sind nicht
   auf iOS belegt. Lokale APIs, Sprachpaare, Modell-/Offlineverhalten und Browserwechsel
   messen; Reinigung, Einwilligung, Abbruch und Wiederaufnahme erhalten. Das bestehende
   `native/native-translate.js` enthält explizite Google-ML-Kit-Texte, keine Apple-
   Übersetzung dahinter behaupten. Bei echter Funktionsabweichung konkrete Möglichkeiten
   mit Klaus besprechen, keine neue externe/kostenpflichtige Lösung still aktivieren.
5. Spracheingabe (der gemeinsame Adapter benennt derzeit Android), Kamera, Mikrofon,
   Share Extension, iPad-Tastatur/Fenster/Drehung, RTL und Dateianbieter vervollständigen.
6. Funktionsmatrix vollständig mit neuen Befunden abnehmen, einschließlich Sicherung/
   Rückimport, voller/fehlender Speicher, falsches Passwort, widerrufene Rechte und
   Unterbrechung/Neustart. Kein stiller Reset, kein Erfolg vor dauerhaftem Schreiben.
7. Erst dann vorhandenes Apple-Team, konkrete Bundle-ID-Verfügbarkeit und signierte
   Geräte-/Vertriebsrechte klären. Bundle-ID ist vorläufig dieselbe logische Produkt-ID;
   auf Apple ist ihre Zuordnung noch nicht bestätigt. Kein signiertes Paket existiert.

## Werkzeuge und Nachweise

Linux-Cloud mit Node 24; kein lokales Xcode. GitHub-API, Branch-Push und PR-Erstellung
wurden tatsächlich genutzt. macOS-CI ist verfügbar: erster gemessener Runner Xcode
16.4 (16F6), Swift 6.1.2, iOS-Simulator-SDK 18.5. Framework-Untergrenze ist iOS 15,
aber vollständige Mindestversionsabnahme und physische iPhone-/iPad-Proben fehlen.

Neue lokale Prüfungen: 193/193 Herkunftsdateien, 33/33 gemeinsame Browserfälle,
41/41 Tresorkomponenten und 3/3 Apple-Bündelprüfungen bestanden, jeweils ohne Skips.
Erster Apple-Lauf `39810507308`: sechs native Dateitests bestanden, Simulatorbau
fehlgeschlagen. Danach wurden eine siebte Dateigegenprobe und Korrekturen ergänzt.
Maßgeblich für aktuelle Apple-Ergebnisse ist der neueste Eintrag im iOS-Baustand.
Kein Testergebnis aus dieser Notiz auf ungeprüfte neuere Commits übertragen.

Cloud-Installations-/Startanweisungen wurden aktualisiert. Netzergänzungen
`api.github.com` und `results-receiver.actions.githubusercontent.com` wurden als
Entwurf gespeichert; tatsächlicher API-/Logzugriff gelang nach erneutem Prüfen.
Entwurfsspeicherung ist keine Veröffentlichung oder bestätigte Wiederherstellung
in einer neuen Cloud-Task.

Bei der Übergabe verbleibende Fähigkeiten und Grenzen konkret nennen. Erst wenn
Workflow PDF Pro für iOS vollständig fertig und geprüft ist, den gewünschten Brief
für die iOS-Version von Private Brain Pro schreiben.
