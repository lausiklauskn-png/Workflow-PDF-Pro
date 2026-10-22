# Produktstand: was es gibt und was veröffentlicht wird

Stand 22.10.2026 abends. Festgelegt von Klaus in der Claude-Code-Sitzung
`session_01HPcxRUAQ4njoMSMPSUhGae`. Diese Datei ist der Ort, an dem wir den Überblick halten.

## Übersicht

| Produkt | Plattform | Stand | Öffentlich? |
|---|---|---|---|
| Workflow PDF (Web) | Browser/PWA | 1.1.0, live: <https://lausiklauskn-png.github.io/Workflow-PDF/> | ja |
| Workflow PDF Pro | Android (APK) | 1.0.3: [v1.0.3](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/v1.0.3) | ja |
| Workflow PDF Pro | Windows (Setup.exe, unsigniert) | 1.0.3: [windows-v1.0.3](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/windows-v1.0.3) | ja |
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

## Veröffentlichen

Als Nächstes veröffentlicht wird nur **Private Brain Pro für Windows**. Daran arbeitet gerade
eine andere Sitzung. Aus diesem Repo wird dafür nichts gestartet.

Ein Push, ein gespeicherter Workflow oder ein grüner Simulatorlauf ist keine Veröffentlichung.
