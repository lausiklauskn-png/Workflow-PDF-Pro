# Produktstand: was es gibt und was veröffentlicht wird

Aktualisiert am 03.11.2026. Die Gleichstandsregel wurde von Klaus in der Sitzung
`session_01HPcxRUAQ4njoMSMPSUhGae` festgelegt. Veröffentlichte Versionen wurden gegen GitHub Releases abgeglichen.

## Aktuelle Übersicht nach der Appwechsel-Korrektur

| Produkt | Plattform | Tatsächlicher Stand | Öffentlich? |
| --- | --- | --- | --- |
| Workflow PDF | Browser/PWA | Kern 1.1.9 auf main 0ed15e5; unverändert im Pro-Bündel | Quelle öffentlich; Auslieferung des Webprojekts separat |
| Workflow PDF Pro | Android | **1.0.13 / Build 14**, dauerhafte Signatur; sichtbare Erst-/Überinstallation mit Datenerhalt geprüft | [v1.0.13](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/v1.0.13) |
| Workflow PDF Pro | Windows | **1.0.13**, wirklicher Installer und öffentlicher Download geprüft; unsigniert, manuelles Update | [windows-v1.0.13](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/windows-v1.0.13) |
| Workflow PDF Pro | iOS | vorbereitet, nicht veröffentlicht | nein |
| Private Brain Pro | Android | **1.0.44**, eigener erfolgreicher Release 41508739185 | [v1.0.44](https://github.com/lausiklauskn-png/Privat-Brain-Pro/releases/tag/v1.0.44) |
| Private Brain Pro | Windows | **1.0.44**, eigener erfolgreicher Release 41508795969 | [windows-v1.0.44](https://github.com/lausiklauskn-png/Privat-Brain-Pro/releases/tag/windows-v1.0.44) |
| Private Brain Pro | iOS | noch nicht veröffentlicht | nein |

Konkrete Quellen, Läufe, Größen und vollständige Prüfsummen:
[Appwechsel-Abschluss](../BRIEF_ABSCHLUSS_2026-11-03_APPWECHSEL.md),
[maschinenlesbare Nachweise 1.0.13](APPWECHSEL-VEROEFFENTLICHUNG-1.0.13.json).
Bereits veröffentlichte Versionen nicht erneut auslösen.

## Zwischenzeitlich veröffentlicht: Kern 1.1.9 / App 1.0.12

Kern bytegleich aus Workflow-PDF main `0ed15e5` (PR #142, #143): Schriftgröße
je Feld, Feld wächst mit, Einrasten, eigene Feldarten, Erkennung ohne Belegtes, ⟳ ohne Verlust (Notstand-Schnappschuss),
Umlaute im Namen aus dem PDF-Titel. App **1.0.12 / Build 13** (Android, Windows). Keine Adapteränderung.
GitHub-Abgleich am 03.11.2026: Android v1.0.12 (Lauf41645443670) und Windows windows-v1.0.12
(41644590893) sind von main448c158 veröffentlicht. Dieselben Versionen nicht erneut auslösen.
Die PWA-Seite (Pages) liefert 1.1.9 seit dem Merge von #142.

## Veröffentlicht: Appwechsel 1.0.13 / Build 14

Klaus meldet den eigenständigen Android-PDF-Editor: Nach Teilen an Familienakte bleibt
deren Fenster im Arbeitsbereich des Editors. Die eingebettete Familienakte-PDF-App ist
ausdrücklich nicht betroffen. Korrektur ausschließlich im Android-Ausgabeadapter:
Empfänger mit eigenem Task starten, Teilen ohne Aktivitäts-Rückkanal öffnen und nur
das Öffnen bestätigen. Kein Beleg für Zustellung. Die gültigen PDF-Bytes und Lesefreigaben bleiben.

Android und Windows werden als1.0.13 gemeinsam geführt; Windows behält sein eigenes
Teilen und manuelles Update. Der PWA-Kern 1.1.9 bleibt bytegleich: Android-Task-Flags
haben im Browser keine Entsprechung. iOS ist weiter nur vorbereitet, nicht freigegeben.
Neue gezielte OS-Probe: wirklicher Android-Chooser, veröffentlichte Familienakte 2.28.16,
kalter/warmer Empfänger, getrennte wiederverwendete Tasks und erhaltener Senderstand.
Die zusätzliche vollständige Tresor-App-Paar-Abnahme wird dadurch nicht nachgeholt.
Android und Windows 1.0.13 sind nach den vollständigen Freigaben von main 1ea49db veröffentlicht und öffentlich nachgeprüft. Aktuell: [Appwechsel-Abschluss](../BRIEF_ABSCHLUSS_2026-11-03_APPWECHSEL.md) und [Dateinachweise](APPWECHSEL-VEROEFFENTLICHUNG-1.0.13.json).

## Fertiggestellter Produktbau und offene zusätzliche Paarprobe

PR #53/#54 verbinden den vorhandenen gemeinsamen Tresor auf Android und Windows,
einschließlich ausgewähltem Eingang, gewöhnlicher Ausgabe, dauerhaften Quittungen,
gestreamter Sicherung und Quellbezug. Der Betriebssystem-Eingang verwendet denselben
dauerhaften Kernimport. Reguläre native Abnahme 41544678113 auf dem geprüften
Freigabeprüfer-Stand ist vollständig bestanden; beide Produktionspakete sind veröffentlicht.
Das Windows-Paar mit Familienakte ist vollständig geprüft (41506243317 / 125490024575).
Die zusätzliche Android-Paarprobe mit Familienakte bleibt nach Abbruch der Testmaschine
offen; keine vollständige Sechs-Paare-Gesamtabnahme behaupten.

Der Einzug der eigenen Ablage (D1) bleibt Android-spezifisch; die freiwillige Verbindung
unter Windows benötigt diesen Einzug nicht. PWA und iOS besitzen keine gleichwertige
native Tresorverbindung. Persönliche Geräte, Scanner und SD/USB werden nur aus konkreten
Rückmeldungen geprüft. Vorhandene Praxisbögen verwenden, keine neue allgemeine Testserie.

## Gleichstandsregel (Klaus, 22.10.2026, gilt immer)

Wird eine Fassung verbessert und fertig gemacht, ob PWA, Android-APK, Windows oder später iOS,
dann werden **alle anderen Fassungen derselben App gleich mit nachgezogen**. Keine Fassung
bleibt zurück. Ziel: keine Lücken und keine Frage, welche Fassung was schon hat.

- Gilt für Workflow PDF (Pro), Private Brain Pro und jede künftige App.
- Klaus muss das nicht jedes Mal sagen. Es ist Teil jedes Auftrags.
- Eine Arbeit ist erst fertig, wenn alle Fassungen den neuen Stand haben oder hier ausdrücklich
  steht, welche Fassung noch fehlt und warum (zum Beispiel iOS: nur vorbereitet, nicht veröffentlicht).
- Nach jeder Veröffentlichung die Übersicht oben aktualisieren.

## Historischer Ausgangsstand des Tresorordners (27.10.2026)

Der heutige optionale Zugang auf Android und Windows steht oben. Die folgenden
Absätze beschreiben die früheren Schritte B und D1; der Windows-Einzug D1 bleibt offen.

Paket `de.familyprojekt.tresor` wird **hier** gepflegt (Klaus' Wahl), byte-gleich in BookLedgerPro und Private Brain Pro.
Stand: Java-Paket mit JVM-Proben, noch **nicht** in der Workflow-PDF-Pro-App verdrahtet (Schritt D) und **ohne** Rust-Zwilling
für Windows (Windows-Sitzung). Keine Veröffentlichung. Einzelheiten: `docs/TRESORORDNER.md`.

**Schritt D1 (27.10.2026): Android zieht ein** — Knopf im Tresor-Kasten, Ordnerprüfung über die Kennung, Inhaltsverzeichnis aus der
Bibliothek. **Lücke Windows:** kein Einzug, weil das Paket dort keinen Rust-Zwilling hat; kommt mit der Windows-Sitzung (Gleichstandsregel).
PWA (Workflow-PDF): ohne Tresorordner, bewusst (PWAs bleiben bei Teilen/Links). Nicht veröffentlicht.

## Gesammelt für die nächste gemeinsame Version

Kleine Korrekturen werden gesammelt und dann zusammen in alle Fassungen gebracht (Klaus, 22.10.2026).

1. Handy-Editorleiste: Der Zurück-Pfeil „←“ steht hinter ✂️ 💾 📤 an vierter Stelle statt ganz links,
   in allen Sprachen. Ursache: `#edZuschneiden`, `#edSpeichern`, `#edTeilen` haben im Kern
   (`assets/style.css`, Regel unter 640 px) keine `order`, alle anderen schon.
   Der Fehler aus der Videoaufnahme (russisch, „← Библиотека“ außerhalb) ließ sich in der
   Web-App nicht nachstellen.
2. Ordnerwahl und Tresor-Schutz (3.11.2026, Zweig `ccr-709c886f-8v07gh`, nicht veröffentlicht): Android hat die
   Regeln (`OrdnerWahl.java`, `TresorSchutz.java`), die Hilfe „Wo liegt was?“ (`native/native-wo-liegt-was.js`) gilt
   für Android und Windows. **Lücke Windows:** die eigene Ordnerwahl und „Speichern unter“ laufen dort über
   `windows/src-tauri` und `windows/java` und kennen die neuen Prüfungen (Verwaltung/fremdes Fach ablehnen,
   Rückfrage, Warnung beim Speichern in den Tresor) noch nicht. Grund: eigener Weg (Tauri-Dialog, Dateipfade),
   eigene Sitzung. Beschreibung: `docs/TRESORORDNER.md`, letzter Abschnitt.

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

## Gleichstand Bildbeschreibung (Claude Code, 26.10.2026, Sitzung 4 mit Private Brain Pro)

Klaus (26.10.2026, Sitzung 3 von Private Brain Pro): „Die soll Workflow PDF Pro und Workflow PDF bekommen. Auch die
Suche … Alle.“ Kurzer Name überall **„Bildbeschreibung“**. Die PWA (Workflow-PDF, Zweig `ccr-2068cf6c-0u3a7n`,
Commit `3bf07ab`, **1.1.3**, Cache v108) hat an jedem Foto ein flaches Feld für eigene Worte (Text oder Mikrofon), getrennt
von der Beschreibung eines Modells; die Wortsuche findet beide (Fundzeile „Bildbeschreibung“); ein Schalter unter der Suche
zeigt nur beschriebene Fotos; „Fotos beschreiben lassen“ holt das Bildmodell (`vit-gpt2-image-captioning`, 256 MB) erst
auf Knopfdruck in den Browser-Vorrat – mit den **gemessenen** Zahlen im Dialog (Prüfrechner: 256 MB Download, 1,2 GB
Arbeitsspeicher in der Spitze, rund 3 s je Foto; **nicht am Tablet gemessen**). Keine Emojis, Liniensymbole.

Workflow PDF Pro übernimmt denselben Kern bytegleich: `upstream/workflow-pdf` = `3bf07ab` (200 Dateien,
`verify-upstream` 0 Abweichungen), Anker `app.js?v=71` in `tools/native/prepare-web.mjs` und
`windows/tools/build-web.mjs`, `native-bootstrap.js` `sourceCommit` nachgezogen, gemeinsame Version **1.0.5**,
Android-Buildnummer **6**. In der App läuft das Modell in der WebView (Android) bzw. WebView2 (Windows) wie in der
PWA: Download aus dem Netz in den Browser-Vorrat der App, kein Paket mit dem Modell. Mikrofon im Feld: der native
Sprachadapter (`native-speech.js`) hängt sich an jedes Textfeld, also auch an das neue.

**Auf main seit 26.10.2026 (#26, Klaus' Wort) und am selben Abend als 1.0.5 veröffentlicht** (siehe „Veröffentlichen“). Nicht gemessen: Gerät, WebView-Arbeitsspeicher
beim Beschreiben (1,2 GB im Prüfrechner sind für ein Tablet ein Risiko), ob `family-projekt.de` das Modell liefert.

## Pro-Umbau 5, Schritt 4: Kern 1.1.4, Scanner-Direktstart, Eingangsfach (28.10.2026)

PWA (Workflow-PDF #136, **1.1.4**, Cache v109): nichts startet beim Öffnen (Einordnen erst auf „Einordnen“, Bildbeschreibung erst auf
„Beschreiben“), „Prüfen“ und „Einordnen“ nebeneinander für die Auswahl oder „Alle N …?“, Datei für Datei mit Stand und Abbrechen, Anmeldung bei
`window.ProHintergrund`, Strichgrafiken statt Emojis, Knöpfe 32 px, die Bibliothek öffnet beim Anzeigen kein PDF. Workflow PDF Pro übernimmt den
Kern bytegleich (`upstream/workflow-pdf` = `2ac96d4` (main nach #136, 203 Dateien), `verify-upstream` 0 Abweichungen), Anker `app.js?v=72`, App **1.0.8**/Buildnummer 9.
Nur in der App: Scanner-Direktstart per Intent (`de.familyprojekt.workflowpdf.pro.SCANNEN`, Extra `von`) und das Fach „Eingang-WorkflowPDF“.
Windows bekommt den Kern gleich; den Intent gibt es dort nicht (Windows hat keinen Weg, mit dem BookLedgerPro Windows den Scanner direkt
öffnet — benannte Lücke). Nicht veröffentlicht, nicht am Gerät gemessen.

## Veröffentlichen

**1.0.5 veröffentlicht 2026-10-26 (Klaus: „wenn das die aktuellste ist, muss die raus“):** [Android-APK](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/v1.0.5/Workflow-PDF-Pro-1.0.5.apk) (Lauf 40383096577, Tag `v1.0.5`, 83.147.148 B, SHA-256 `c9b8e67ef67bb1d38b0497d484937c271ed7f54e085b8e615d7200298512af65`, Buildnummer 6, Zertifikat `0da805c9…`, signierte Erstinstallation mit erhaltenem Ordner im Lauf) · [Windows-Setup](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/windows-v1.0.5/Workflow-PDF-Pro-Windows-1.0.5-Setup.exe) (Lauf 40384462589, Tag `windows-v1.0.5`, 15.866.577 B, SHA-256 `7e4e9195d2aa5c60ff3c7fcbf617532b6800cd4e2c60f2884c330fc06516f70c`, unsigniert, Installer aus dem Windows-Bau 40383101175 auf main, dort Installieren/Starten/Entfernen geprüft). Quelle `ba5d54e2e97e654881ebe8037995963c7d9dcef1`. Beide Downloads unabhängig geladen, Größe und SHA-256 gleich den veröffentlichten Prüfsummen. Geschenk für Jens trägt 1.0.5. Diese Veröffentlichung ist erledigt; nicht erneut auslösen. ⚠ Am Tablet und am eigenen Windows-PC nicht gemessen.
Ablauf war: `workflow-pdf-release.yml` (tag `v1.0.5`, commit main) direkt nach grünem `native-acceptance` auf main; `windows-app.yml` auf main einmal von Hand gestartet, weil der
Anker-Commit #27 seine Pfadfilter nicht traf, dann `windows-release.yml` (tag `windows-v1.0.5`). Beide über `workflow_dispatch` aus der Claude-Code-Sitzung, kein Git-Brückenbranch nötig.

Ein Push, ein gespeicherter Workflow oder ein grüner Simulatorlauf ist keine Veröffentlichung.
