# Produktstand: was es gibt und was veröffentlicht wird

Stand 22.10.2026 abends. Festgelegt von Klaus in der Claude-Code-Sitzung
`session_01HPcxRUAQ4njoMSMPSUhGae`. Diese Datei ist der Ort, an dem wir den Überblick halten.

## Übersicht

| Produkt | Plattform | Stand | Öffentlich? |
|---|---|---|---|
| Workflow PDF (Web) | Browser/PWA | 1.1.2 (Direktstart; Worker löscht nur eigene Schalen, 26.10.), live: <https://lausiklauskn-png.github.io/Workflow-PDF/> | ja |
| Workflow PDF Pro | Android (APK) | 1.0.3 veröffentlicht; 1.0.4 (Direktstart) auf main vorbereitet, nicht veröffentlicht. Letztes Release: [v1.0.3](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/v1.0.3) | ja |
| Workflow PDF Pro | Windows (Setup.exe, unsigniert) | 1.0.3 veröffentlicht; 1.0.4 (Direktstart) auf main vorbereitet, nicht veröffentlicht. Letztes Release: [windows-v1.0.3](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/windows-v1.0.3) | ja |
| Workflow PDF Pro | iOS (iPhone/iPad) | in Vorbereitung durch Codex, Zweig `codex/ios-native-host` | **nein, nur privat** |
| Private Brain Pro | Android (APK) | vorhanden (laut Klaus; eigenes Repo, hier nicht geprüft) | ja |
| Private Brain Pro | Windows | in Arbeit (laut Klaus; eigenes Repo, nicht in dieser Sitzung) | geplant |
| Private Brain Pro | iOS | noch nicht begonnen | später: nur vorbereiten |

## Gleichstandsregel (Klaus, 22.10.2026, gilt immer)

Wird eine Fassung verbessert und fertig gemacht, ob PWA, Android-APK, Windows oder später iOS,
dann werden **alle anderen Fassungen derselben App gleich mit nachgezogen**. Keine Fassung
bleibt zurück. Ziel: keine Lücken und keine Frage, welche Fassung was schon hat.

- Gilt für Workflow PDF (Pro), Private Brain Pro und jede künftige App.
- Klaus muss das nicht jedes Mal sagen. Es ist Teil jedes Auftrags.
- Eine Arbeit ist erst fertig, wenn alle Fassungen den neuen Stand haben oder hier ausdrücklich
  steht, welche Fassung noch fehlt und warum (zum Beispiel iOS: nur vorbereitet, nicht veröffentlicht).
- Nach jeder Veröffentlichung die Übersicht oben aktualisieren.

## Gesammelt für die nächste gemeinsame Version

Kleine Korrekturen werden gesammelt und dann zusammen in alle Fassungen gebracht (Klaus, 22.10.2026).

1. Handy-Editorleiste: Der Zurück-Pfeil „←“ steht hinter ✂️ 💾 📤 an vierter Stelle statt ganz links,
   in allen Sprachen. Ursache: `#edZuschneiden`, `#edSpeichern`, `#edTeilen` haben im Kern
   (`assets/style.css`, Regel unter 640 px) keine `order`, alle anderen schon.
   Der Fehler aus der Videoaufnahme (russisch, „← Библиотека“ außerhalb) ließ sich in der
   Web-App nicht nachstellen.

## Entscheidung zu iOS (Klaus, 22.10.2026)

- Die iOS-Version von Workflow PDF Pro wird **fertig vorbereitet**, aber **nicht veröffentlicht**.
- Grund: Ohne bezahlte Apple-Developer-Mitgliedschaft (rund 99 € pro Jahr) gibt es weder
  TestFlight noch App Store. Ein kostenloses Apple-Konto erlaubt nur die Installation über
  einen Mac mit Xcode, auf höchstens 3 eigenen Geräten, und die App läuft nach 7 Tagen ab.
- Später ist ein Hochladen **nur für uns persönlich** möglich (Klaus und die Arbeitsdienste),
  also kein öffentlicher Vertrieb. Kein Apple-Konto und keine Kosten ungefragt anlegen.
- Für Freunde mit iPhone oder iPad gibt es kostenlos die Webversion:
  [Anleitung](IPHONE-WEBVERSION.md).
- Private Brain Pro für iOS gilt genauso: nur als vorbereitete Version.

## Gleichstand Direktstart (Claude Code, 26.10.2026)

Klaus (26.10.2026, BookLedgerPro-Sitzung): „du darfst Workflow für den Direktstart anfassen. PWA, Android und
Windows gleich.“ Die PWA (Workflow-PDF #132, main `5d32527`, 1.1.1, Cache v106) öffnet mit `./?scan=1&von=<App>`
sofort den Scanner mit „Durchsuchbar“ und nennt den Rückweg (Teilen → App). Workflow PDF Pro übernimmt denselben
Kern bytegleich: `upstream/workflow-pdf` = `5d32527` (194 Dateien, `verify-upstream` 0 Abweichungen), Anker
`app.js?v=70` in `tools/native/prepare-web.mjs` und `windows/tools/build-web.mjs`, gemeinsame Version **1.0.4**,
Android-Buildnummer **5**. Noch **nicht veröffentlicht**: Release nur auf Klaus' Wort (Android nach grünem
`native-acceptance`, Windows nach grünem `windows-app`, jeweils `request-release.mjs`).

Was den Direktstart in der nativen App begrenzt (ehrlich): Die Pro-App nimmt keine https-Links ihrer
Web-Adresse an (kein Android-App-Link); der `intent://`-Link aus BookLedgerPro öffnet die Pro-App nur, wenn
Android ihr Paket kennt und den Link zustellt, sonst die Web-Fassung. Windows (Tauri) hat keinen Link-Empfang.
Der Scanner selbst steht in allen drei Fassungen gleich. Nicht am Gerät gemessen.

**Nachtrag 26.10. (Claude Code):** Kern **1.1.2** (Workflow-PDF #133: Worker löscht nur noch eigene Schalen `workfloh-pdf-v…`,
Kopfzeile mit breiter Systemschrift, neue Browser-CI) ist bytegleich in `upstream/workflow-pdf` (`56b45ec`, 197 Dateien);
Windows-Kern-Fixes (#23: Unicode-Dateinamen behalten die Endung, Tresor stürzt an fremden Namen nicht ab) sind auf main.
Die Inhalte der Codex-Entwürfe sind damit hier neu gebaut; die Entwürfe selbst bleiben unberührt.

Offene Codex-Entwürfe (Klaus 26.10.: Codex wird für diese Sitzungen nicht angerührt): Workflow-PDF #131
(fremde App-Caches erhalten, schmale Kopfleiste, Cache v107) und Workflow-PDF-Pro #20 (Windows-Dateinamen,
Tresor-Grenzfall, Version 1.0.4). Beide liegen auf eigenen Zweigen neben main und sind nicht übernommen. #131 ist
für denselben github.io-Ursprung wichtig (Workflow PDFs Worker löscht sonst beim Aktualisieren fremde Vorräte,
auch BookLedger). Entscheidung von Klaus nötig: Inhalt hier neu einbauen oder die Entwürfe liegen lassen.

## Veröffentlichen

Als Nächstes veröffentlicht wird nur **Private Brain Pro für Windows**. Daran arbeitet gerade
eine andere Sitzung. Aus diesem Repo wird dafür nichts gestartet.

Ein Push, ein gespeicherter Workflow oder ein grüner Simulatorlauf ist keine Veröffentlichung.
