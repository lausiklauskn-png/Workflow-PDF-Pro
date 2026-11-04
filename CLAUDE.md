**🔬 Regel: Forschung nur in Kimhub (Klaus 2026-10-31: „einheitlich alles in Kimhub … in den einzelnen Repos soll keine Forschungseinträge sein“):** jeder Forschungseintrag (Sitzungs-Befunde, Messungen, Stunden-Auswertungen, Forschungsnotizen) kommt nach **Kimhub `forschung/messungen/`**; in diesem Repo werden keine Forschungseinträge geführt und keine Forschungsdateien angelegt. Öffentliche Forschungs**aufgaben** stehen in Sage-Protokol.

# Workflow PDF Pro — Claude Code und Codex

Alle Regeln stehen in [`AGENTS.md`](AGENTS.md). Zuerst dort lesen.

**Android-Testfassung 1.0.14/Build 15 veröffentlicht (04.11.2026, Klaus' Wort):** Tresor-Plan (#62) und Version (#63), Lauf 41749829952, APK SHA-256 `ba438634…df2a`, 83.350.299 B, von GitHub unabhängig geprüft; Nachweis `docs/VEROEFFENTLICHUNG-1.0.14.json`. Windows bleibt 1.0.13. Nicht erneut veröffentlichen. Am Tablet nicht geprüft.

**Ordnerwahl und Tresor-Schutz (3.11.2026, Zweig, nicht veröffentlicht):** Hauptablageordner oder „Workflow PDF Pro“ öffnen dieselbe Ablage, keine Verschachtelung, Rückfrage vor neuer Ablage, „Speichern unter“ in den Tresor fragt nach, Hilfe „Wo liegt was?“ — `docs/TRESORORDNER.md` letzter Abschnitt.

**Aktueller Abschluss: Appwechsel 1.0.13 veröffentlicht.** Android 1.0.13/Build 14
und Windows 1.0.13 sind vom geprüften main 1ea49db veröffentlicht und öffentlich per SHA-256
nachgeprüft. Aktuell: `BRIEF_ABSCHLUSS_2026-11-03_APPWECHSEL.md`,
`BRIEF_NACHFOLGE_2026-11-03_NACH-APPWECHSEL.md` und
`docs/APPWECHSEL-VEROEFFENTLICHUNG-1.0.13.json`. Kern 1.1.9 bleibt bytegleich;
iOS nur vorbereitet. Diese Fassungen nicht erneut veröffentlichen. Familienakte 2.28.17
enthält denselben kanonischen Ausgabeadapter mit Herkunftspin 1ea49db und hält beim
Android-Zurück am Anfang geöffnet. Die ältere vollständige Android-Tresor-Paar-Abnahme
bleibt separat offen; Familienakte PR #59 bleibt Entwurf.

**Historischer Abschluss des Pro-Verbunds:** Android und Windows **1.0.11 veröffentlicht**,
Kern **1.1.8** bytegleich. Downloads/Hashes und Prüfgrenzen:
`BRIEF_ABSCHLUSS_2026-11-03_PRO-VERBUND.md`, `docs/PRODUKTSTAND.md`.
Nachfolge: `BRIEF_NACHFOLGE_2026-11-03_NACH-PRO-VERBUND.md`. Dieselben Versionen nicht erneut
veröffentlichen. Windows-Paar mit Familienakte vollständig geprüft; Android-Paar noch
nicht vollständig geprüft (Familienakte #59 bleibt Entwurf). Keine vollständige
Gesamtabnahme behaupten. Die folgenden datierten Abschnitte sind historische Stände.

**Bausteine Fassung 7 (31.10.2026, nach PB #121):** „Überall suchen“ kennt die drei neuen Fächer; nachgezogen mit `tools/native/bedienung-nachziehen.mjs --quelle ../Privat-Brain-Pro`. Proben `test-pro-bedienung` 64 · `test-ueberall` 16.

**Pro-Umbau 14 A3 (31.10.2026, Klaus' Antworten 1, 2, 5, 6):** Tresor-Paket mit damals acht Fächern (neu „Private Brain V3“, „Familienakte“, „Eingang-Familienakte“; JUnit 10 grün; seit 1.11.2026 **neun** mit „Eingang-Private-Brain“, siehe `Fach.java`). **Im Netz antworten** (`native/native-netz.js`, Kasten unter dem Chefcode, ab Werk aus): öffentlich nur Dateiname (verglichen auch nur mit ihm), im eigenen Netz mit Schalter „Mit Ausschnitt“ der Seitentext in Abschnitten aus den gespeicherten Vektoren der Bedeutungssuche (Anfang + Briefende, ≤ 60 je Dokument), eine Zeile je Dokument, Korpus live (Funktion, nach `enableAnswering` gesetzt), Datenbank des Kerns nur lesend ohne Version. Braucht das geladene Sprachmodell (Bibliothek → Suche nach Bedeutung). Probe `test-netz` 16 · Gegenprobe 4/4. Nicht am Gerät, kein Relais; Workflow-PDF (PWA) noch nicht.

**Pro-Umbau 14, Sitzung A (31.10.2026):** Chef getrennt — Bedien-Bausteine **Fassung 6** aus Private Brain Pro (`native/pro-chefcode.js` Fassung 2): Chef-PIN (6–12 Ziffern, nur Prüfwert gespeichert), gesperrt nur Zustand; Mitarbeiter treten mit dem Beitritts-Zettel `CHEF1-…` bei und ändern nur mit Chef-PIN. App **1.0.11**/12 (nicht veröffentlicht). Probe `test-ueberall` (Chef richtet ein, gesperrt ohne Code-Feld, entsperren → entfernen). Ausführlich: Private Brain Pro `docs/UEBERALL-SUCHEN.md`. Nicht am Gerät.

**Pro-Umbau 13 (30.10.2026):** Chefcode (Klaus: „Ja, Schritt 1+2“, „Chef legt fest, alle 3“) — gemeinsamer Baustein `native/pro-chefcode.js` (Quelle Private Brain Pro, Bedien-Bausteine Fassung 5) in den Einstellungen unter Sicherung/Tresor (`native/native-chefcode.js`): gleicher Code = eigenes Netz über Modul 23 des Kerns, mindestens 12 Zeichen, Feld danach leer. App weiter **1.0.10**/11 (nicht veröffentlicht). `test:native-web` 72/0. Nicht am Gerät.

**Pro-Umbau 12 (30.10.2026):** „Überall suchen“ unter der Bibliothekssuche (`native/native-ueberall.js`; Kasten = gemeinsamer Baustein `native/pro-ueberall.*` aus Private Brain Pro, Fassung 4): Bibliothek mit Seitentext, Tresorordner-Fächer der anderen Pro-Apps (`WorkflowVault.tresorFach`, nur Zeilen, nur offen), Netz über Modul 23 nur mit Haken. `native/native-kopf.js`: Schriftgröße „A··A“ vor dem Zahnrad, Version klein neben dem Namen (Tipp prüft auf Updates). Android `setTextZoom(100)`. App **1.0.10**/Buildnummer 11, nicht veröffentlicht. Proben `test:native-web` 69/0. Nicht am Gerät. Beschreibung: Private Brain Pro `docs/UEBERALL-SUCHEN.md`.

**Stand 26.10.2026 (Sitzung 4 mit Private Brain Pro, Claude Code):** Kern **1.1.3 Bildbeschreibung** bytegleich in
`upstream/workflow-pdf` (`3bf07ab`), App **1.0.5**/Buildnummer 6, Anker `app.js?v=71` – **auf main übernommen 2026-10-26** (#26, Klaus' Wort; Workflow-PDF 1.1.3 ebenso, #134).
**1.0.5 veröffentlicht 2026-10-26 (Klaus: „wenn das die aktuellste ist, muss die raus“):** [Android-APK](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/v1.0.5/Workflow-PDF-Pro-1.0.5.apk) (Lauf 40383096577, Tag `v1.0.5`, 83.147.148 B, SHA-256 `c9b8e67ef67bb1d38b0497d484937c271ed7f54e085b8e615d7200298512af65`, Buildnummer 6, Zertifikat `0da805c9…`, signierte Erstinstallation mit erhaltenem Ordner im Lauf) · [Windows-Setup](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/windows-v1.0.5/Workflow-PDF-Pro-Windows-1.0.5-Setup.exe) (Lauf 40384462589, Tag `windows-v1.0.5`, 15.866.577 B, SHA-256 `7e4e9195d2aa5c60ff3c7fcbf617532b6800cd4e2c60f2884c330fc06516f70c`, unsigniert, Installer aus dem Windows-Bau 40383101175 auf main, dort Installieren/Starten/Entfernen geprüft). Quelle `ba5d54e2e97e654881ebe8037995963c7d9dcef1`. Beide Downloads unabhängig geladen, Größe und SHA-256 gleich den veröffentlichten Prüfsummen. Geschenk für Jens trägt 1.0.5. Diese Veröffentlichung ist erledigt; nicht erneut auslösen. ⚠ Am Tablet und am eigenen Windows-PC nicht gemessen. [Abschluss](BRIEF_ABSCHLUSS_2026-10-26_BILDBESCHREIBUNG.md),
[Produktstand](docs/PRODUKTSTAND.md). Unterlagen der Sitzung im Pro-Repo:
[ABSCHLUSS-SITZUNG-04](https://github.com/lausiklauskn-png/Privat-Brain-Pro/blob/main/docs/design/aenderungen-2026-10-26/ABSCHLUSS-SITZUNG-04.md).

**1.0.8 veröffentlicht 2026-10-29 (nur Android, Klaus: APK zur Gegenprobe; Windows später):** [Android-APK](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/v1.0.8/Workflow-PDF-Pro-1.0.8.apk)
(Lauf 40794715829, Versuch 2; Tag `v1.0.8`, Quelle `f614e4adb07f3698fb891dac655c56b607a46080` = #41, Buildnummer 9, 83.238.351 B, SHA-256
`dabab89ec3623d118b88fa0cd482e7472433b9e2e7eb8eb9494a4b87c825f4b6`, Zertifikat `0da805c9…`, unabhängig geladen und gleich). Enthält Kern 1.1.4,
Scanner-Direktstart per Intent `de.familyprojekt.workflowpdf.pro.SCANNEN` (BookLedgerPro 0.1.2 ruft ihn), Fach `Eingang-WorkflowPDF`. Versuch 1 scheiterte in der
Emulator-Probe (nach Enter im Ordner-Dialog stand der Startbildschirm da, Ursache offen; im Browser nachgespielt fehlerfrei). Nicht erneut auslösen. ⚠ Am Tablet nicht gemessen.

**1.0.9 veröffentlicht 2026-10-29 (nur Android, Klaus: „die Downloads für die aktuellen Versionen bereitstellen“):** [Android-APK](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/v1.0.9/Workflow-PDF-Pro-1.0.9.apk)
(Lauf 40840592772, Versuch 1; Tag `v1.0.9`, Quelle `3ff194c` = #43, Buildnummer 10, 83.242.447 B, SHA-256 `c1abd2dd7171176364fae582a01ee313f19b0c846ff9e17995bfa8fee599474f`,
unabhängig geladen und gleich). Neu nach Klaus' Tablet-Befund: Arbeitsstand im Tresor **gesammelt** geschrieben (`vault-db` mit `sammeln`: 10 s Ruhe, Speichern,
Schließen, Hintergrund, Sperren; Meldung nur bei > 1,2 s), Haken „Durchsuchbar“ beim Direktstart sichtbar. Nicht erneut auslösen. ⚠ Am Tablet nicht gemessen.

**Gemeinsamer Tresorordner (27.10.2026, Klaus: Paket wird hier gepflegt):** `android/app/src/main/java/de/familyprojekt/tresor/`
ist die Quelle für alle Pro-Apps (BookLedgerPro, Private Brain Pro kopieren byte-gleich). Nach jeder Änderung
`node tools/tresor/pins.mjs --schreiben`, dann in den anderen Repos nachziehen. Format und Regeln: [docs/TRESORORDNER.md](docs/TRESORORDNER.md).
**Einstellungen nach Leitfaden (28.10.2026, Umbau 2):** Kasten „Tresor & Ablage“ (Ablage + Tresor, ● Zustand, Pfad + „In Dateien öffnen“, ein farbiger Knopf), keine Web-Reste in der App (`native/native-ohne-web.js`, Probe `tools/native/test-ohne-web.mjs`), „Auf Updates prüfen“ mit Version (`WorkflowUpdates`). Gemeinsame Bedien-Datei `native/pro-bedienung.*` nur in Private Brain Pro ändern. Details: [docs/TRESORORDNER.md](docs/TRESORORDNER.md) letzter Abschnitt.
**Pro-Umbau 3 (28.10.2026):** Sicherung gestreamt (`native/native-sicherung.js`, `.wfps`, 60 MB ohne Speicherzuwachs; Kern-Weg +900 MB), Einordnen erst auf Knopf „Einordnen“, „Alle prüfen“ fragt, Prüfen für die Auswahl, Start-Knöpfe nur bei Tipp auf ihnen (`native/native-hintergrund.js`): [docs/SICHERUNG-UND-HINTERGRUND.md](docs/SICHERUNG-UND-HINTERGRUND.md). Nicht am Gerät.
**Pro-Umbau 4 (28.10.2026):** Bildbeschreibung startet nicht mehr von selbst („Beschreiben“, `native/native-hintergrund.js`), Sichern/Prüfen/Einordnen/Beschreiben laufen als Hintergrundaufgabe weiter (gemeinsamer Baustein `native/pro-hintergrund.js` + `de.familyprojekt.hintergrund`, Quelle Private Brain Pro, Pin Fassung 2): [docs/SICHERUNG-UND-HINTERGRUND.md](docs/SICHERUNG-UND-HINTERGRUND.md) letzter Abschnitt. Nicht am Gerät.
**Updates unter Windows (28.10.2026):** der Tauri-Updater war nie eingerichtet (`windows/signing/updater.pub` leer, keine `latest.json`) — „Auf Updates prüfen“ meldete „nicht eingerichtet“. Jetzt wie Android: die Brücke (`windows/bridge/capacitor-tauri.js`, `WorkflowUpdates`) liest die öffentlichen Veröffentlichungen `windows-vX.Y.Z` mit Setup, „Herunterladen“ öffnet deren Seite; der Tauri-Knopf erscheint nur, wenn er eingerichtet ist. Probe `windows/tools/test-github-updates.mjs`.
**Scanner und Kamera unter Windows (Pro-Umbau 5, 28.10.2026):** gemeinsamer Baustein, hier gepflegt (`native/pro-scanner.*`, `windows/scanner/`, Pin `native/pro-scanner-herkunft.json`, `node tools/native/scanner-pins.mjs --schreiben`), byte-gleich nach BookLedgerPro: [docs/SCANNER-UND-KAMERA-WINDOWS.md](docs/SCANNER-UND-KAMERA-WINDOWS.md). Kein echter Scanner gemessen.
**Pro-Umbau 5, Schritt 4 (28.10.2026):** Kern **1.1.4** (Workflow-PDF #136) bytegleich in `upstream/` — nichts startet von selbst, „Prüfen“/„Einordnen“ für die Auswahl, Hintergrundaufgabe im Kern, Strichgrafiken, nur Vorschaubilder; die Umwege in `native/native-hintergrund.js` sind weg (nur der Tipp-Schutz bleibt). Neu: **Scanner-Direktstart per Intent** `de.familyprojekt.workflowpdf.pro.SCANNEN` (Extra `von`, `ScanDirekt.java`, `native/native-scan-direkt.js`) und **Fach „Eingang-WorkflowPDF“** in Tresor & Ablage und über den Karten (`ProTresorordner.eingang*`, Paket unverändert). App **1.0.8**/Buildnummer 9, nicht veröffentlicht: [docs/SICHERUNG-UND-HINTERGRUND.md](docs/SICHERUNG-UND-HINTERGRUND.md), [docs/TRESORORDNER.md](docs/TRESORORDNER.md) letzte Abschnitte. Nicht am Gerät.
**Schritt D1 (27.10.2026):** Workflow PDF Pro zieht in den Tresorordner ein — Knopf im Tresor-Kasten der Einstellungen, Ordner über
„Workflow PDF Pro“ (auch eine Kopie zur Probe, geprüft über die Kennung), Inhaltsverzeichnis aus der Bibliothek. Nicht am Gerät gemessen.
# Dauerhafter Betriebssystem-Eingang (Pro-Verbund)

`native/native-durable-import.js` verwendet den normalen Kernimport mit einer vorab reservierten Kennung,
liest PDF und Original zurück und speichert erst dann die Quittung. `pro-transfer-store.js` bindet sie an
die gewählte Ablage; Sicherung und Ablagewechsel nehmen sie mit. Kein Quittieren allein nach einem
Datei-Ereignis. Der Kern ist jetzt bytegleich aus Workflow-PDF **1.1.8**, PR #141; zum Nachziehen nur
`tools/onboarding/nachziehen.py` verwenden. Der native Einstieg lädt genau einen Netz-Antwortadapter.
Verhalten und Grenzen: [docs/PRO-EINGANG.md](docs/PRO-EINGANG.md). Die gemeinsame Pro-Tresor-Verbindung und die Veröffentlichungen 1.0.11 sind abgeschlossen;
die zusätzliche vollständige Android-App-Paar-Abnahme bleibt offen.

Die native Grundlage der freiwilligen Verbindung ist nun auf Android und Windows vorhanden:
`WorkflowVault.tresorVerbinden`, `tresorUebergabe` und `tresorFach`. Sie richtet keine eigene
Arbeitsablage ein. Windows bündelt den kanonischen Java-Tresor mit minimaler Laufzeit und nutzt
eigene Passwortdialoge sowie DPAPI. PR #53 ist nach vollständiger Android- und installierter
Windows-Abnahme auf main; Installer 1.0.11 veröffentlicht. [Vertrag und Grenzen](docs/PRO-VERBUND-NATIV.md).

Die anschließende Bedienung verwendet den bytegleichen Kern **1.1.8**, Workflow-PDF PR #141.
`native-pro-transfers.js` bindet Quittungen, Ausgangsbytes und Herkunft an dieselbe Arbeitsablage;
`native-pro-verbund.js` bietet die freiwillige Verbindung, ausgewählten Eingang und normalen
Teilen-Dialog in DE/EN/RU/AR. Gestreamte Sicherung Fassung 3 enthält offene Ausgaben und erhält
Rückbezüge; alte Formate bleiben lesbar. Der frühere Android-Eingang quittiert jetzt ebenfalls erst
nach dauerhafter Übernahme und erneuter nativer Hash-Prüfung. Die Bedienung hat die regulären nativen Plattformprüfungen bestanden;
die zusätzliche Android-Paarprobe mit Familienakte bleibt offen. [Bedienung, Sicherung und Nachweise](docs/PRO-VERBUND-BEDIENUNG.md).
