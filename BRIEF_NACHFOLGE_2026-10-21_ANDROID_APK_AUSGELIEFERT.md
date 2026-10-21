# Workflow PDF Pro: reguläre Android-APK ausgeliefert

Dies ist der aktuelle Nachfolgebrief. AGENTS.md, beide ursprünglichen Briefe
vom 20./21.10., Speicher-/Signierungsunterlagen und den aktuellen Baustand
weiterhin berücksichtigen. Historische Prüfungen bleiben historische Prüfungen.

## Aktuelles Update: Pro-Icon 1.0.1

Regulärer Release **v1.0.1**, versionCode **2**, unveränderlicher App-/Tag-Commit
`46ee4ce18ccafd13f206be5b8ee9fca293d7443c`.
[APK direkt herunterladen](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/v1.0.1/Workflow-PDF-Pro-1.0.1.apk).
83.110.198 Bytes, SHA-256
`86f9f55bb519e446359a6c33bd42545870a3e7c712cd7552fe50a2dbe4c549a2`.

Klaus hat die Pro-Gestaltung ausdrücklich bestätigt: roter Hintergrund bis an
alle Außenkanten, weißer weicher Verlauf ins Rot hinter dem größeren W-Floh,
rotes „PDF Pro“ auf dem Zettel. Der Floh steht mit kleinem Abstand innerhalb der
Android-Maske. Originalmotivdatei und Quellrepo bleiben erhalten; die neue Grafik
liegt getrennt in `drawable-nodpi/workflow_pro_icon.png`. Adaptives Icon und
Startbildschirm verwenden denselben neuen Pro-Entwurf. Der zuerst versuchte
inset-Rahmenentwurf wird nicht ausgeliefert. Keine weitere Gestaltungsfrage nötig.

[Vollständige neue Freigabe 39630794393](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39630794393),
Versuch 2, native-smoke `119339858010`: Originalkette, 33 Browserfälle, elf
Chrome-Helferfälle, 49 Speicher-/Release-/Berichtsfälle und je **47 native Fälle
auf API31/API35**, null Fehler/Skips sowie sichtbare Installation mit Datenerhalt.
API31, Quelle und Laufzeit stammen aus dem erfolgreichen Erstversuch; Telefon
wurde unverändert erneut ausgeführt. Zusätzlicher Grundlagenlauf `39630793961`
ist nach unveränderter gezielter Wiederholung ebenfalls erfolgreich.

[Regulärer Release 39634219828](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39634219828),
Versuch 2, Publishjob `119345978713`, erfolgreich: vorhandene Signieridentität,
echte signierte Produktionsinstallation auf API31 und Neuinstallation mit
erhaltenem Ordner, `developmentProbe:false`, `versionCode:2`, öffentlicher
Download bytegleich geprüft. Derselbe Download wurde lokal erneut gehasht und
mit apksigner auf v2/v3 sowie den unveränderten öffentlichen Zertifikats-Pin
geprüft. Der Build stammt aus dem erfolgreichen ersten Releaseversuch.

Erste Fehler nicht verbergen: zusätzlicher Chrome-Negativtest mit Socket-Reset;
Telefon: 47 Produktfälle erfolgreich, danach UIAutomator-Dump mit Fehlercode;
erste signierte Produktionsprüfung: noch keine sichtbaren UI-Labels innerhalb
der Abfragefrist. Diese Versuche waren keine Freigaben und erzeugten keinen
Release. Die gezielten Wiederholungen desselben unveränderten Commits bestanden.
Rohdaten und Grenzen: `docs/portierung/nachweise/2026-10-21-pro-icon-1.0.1.json`.

Update direkt über die vorhandene App installieren, vorher nicht deinstallieren.
Der tatsächliche Erhalt wurde bei Neuinstallation derselben APK geprüft;
Kompatibilität zum vorigen Release durch Signatur/App-ID und höhere Version.
Keine zusätzliche physische Alt-zu-Neu-Upgradeprüfung behaupten. Die simulierte
Kreis-/Squircle-/Rundquadratvorschau ist keine physische Samsung-Messung.
Geräteabnahmen, Windows und iOS bleiben wie unten beschrieben offen.

Hinweis für spätere Testpflege: Der Debug-Installationshelfer trägt noch eine
historisch fest kodierte Buildnummer 1 ein; daraus keine Versionsprüfung ableiten.
Die Produktionsversion 2 ist durch aapt, Signaturreceipt und tatsächliche
Produktionsinstallation unabhängig belegt. Keine App-/Signiergates absenken.

## Historischer Erstinstallationsstand 1.0.0

- Regulärer Release **v1.0.0**, Android-Buildnummer **1**, App-ID
  `de.familyprojekt.workflowpdf.pro`; kein Debug-/Preview-Paket.
- [Direkte APK](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/v1.0.0/Workflow-PDF-Pro-1.0.0.apk),
  81.619.142 Bytes, SHA-256
  `ca4df652472c08d23ab3e7dde44da5328bb84f10bac032ad294f74f952f097f6`.
- Unveränderlicher APK-/Tag-Commit:
  `cf32a13a0b51433cf73a59ad2a76d4892f2a83a2`. Er wurde nach erfolgreicher
  Gesamtfreigabe ohne History-Umschreibung per Fast-forward auf main übernommen.
  PR #8 ist zusammengeführt. Spätere reine Dokumentationscommits sind keine
  neu signierte oder neu geprüfte APK-Version.
- [Vollständige Freigabe 39618209136](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39618209136):
  Originalkette mit 28 Skripten, 33 Browserfälle, elf reale Loopback-/Helferfälle,
  Speicher-/Release-Gegenproben, sieben Berichtsgate-Gegenproben, Bau/Lint/JVM,
  je **47 native Fälle auf API31 und API35**, null Fehler/Skips, sichtbare
  Erst-/Neuinstallation mit Datenerhalt. native-smoke `119291199794` erfolgreich.
- [Regulärer Signier-/Releaseweg 39620394480](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39620394480)
  erfolgreich: vorhandene Identität, tatsächliche Produktions-APK auf API31
  sichtbar installiert, Ordner angelegt, APK erneut installiert, Ordner erhalten;
  `developmentProbe:false`. Öffentlicher Download vom Publisher bytegleich
  geprüft. Dieselbe APK wurde danach lokal heruntergeladen, gehasht und mit
  apksigner erneut verifiziert: v2/v3 gültig, bestehender Zertifikats-Pin.
- Öffentlicher Pin bleibt
  `0da805c9ad11ded86227fa4398e9237766f9f2d12bec66d65cb20309cbea3837`.
  Keinen Schlüssel neu initialisieren. Entschlüsselungsfreigabe bleibt ausschließlich
  im Environment `android-production`, Secret `WF_PDF_SIGNING_UNLOCK`.
- Quellrepo Workflow-PDF bleibt sauber auf
  `7227c543d4a536cf8f3354a56fbba7574645703e`; alle 191 übernommenen Dateien
  wurden erneut bytegleich geprüft. Keine Originaldatei wurde geändert.

## Produkt und Entscheidungen

Vollständiger lokaler Workflow-PDF-Kern und Schutzmodule; native Datei-/Ordnerwahl,
Kameraeingang, dauerhafte Empfangswarteschlange, PDF-Anzeige, Drucken/Teilen,
Sprache und lokale ML-Übersetzung sind angebunden. Keine reduzierte Preview
als reguläre App ausgegeben. Android 8/API26 und System WebView ab 120.

Interne Arbeitsdatenbank plus verschlüsselter frei gewählter Ordner als dauerhafte
Hauptablage sind produktiv angebunden. SD bleibt optional; ohne Ordnerwahl ist
interne Arbeit möglich. Migration, Originale, Felder, Übersetzungsstände,
Journal, Wiederherstellung und bisherige Sicherungen erhalten. Private
Empfangs-Arbeitskopien sind ausdrücklich getrennt und wiederherstellbar;
der Nutzer kann sie separat löschen. Geräte-/Netzschlüssel werden nicht
automatisch in portable Tresorpräferenzen übernommen.

Klaus hat den Chrome-Vordergrunddienst mit sichtbarer Meldung und Abbruch
ausdrücklich gewählt. Nicht erneut danach fragen. Lokaler authentisierter
Hin-/Rücktransport, Bereinigung vor Übermittlung, Abbruch/Fristen und
seitenweise Fortsetzung sind angebunden. Optionale Google-ML-Modelle starten
erst nach Hinweis und Zustimmung; Texte/Ergebnisse werden lokal verarbeitet,
das SDK übermittelt technische Metriken. Die unveränderte Original-Engine
übernimmt Auswahl, Wiederholung, Satzzerlegung und PDF-Ausgabe.

## Prüfgrenzen und nächste Arbeiten

Klaus verwendet Galaxy Tab S6 und Galaxy S21, nach eigener Auskunft möglichst
aktuell. Exakte Android-/One-UI-/Chrome-/WebView-Versionen sind ungemessen.
Eine physische Installation auf diesen Geräten wurde nicht behauptet.

Echte lokale ML-Übersetzung, OCR, Scanmodell, PDF-/Tresorfunktionen wurden im
Emulator ausgeführt. Kamera-/Sprachanbieteraktivitäten verwenden zusätzlich
synthetische Fixtures. Physische Kamera-/Mikrofonqualität, Samsung-Druck/Teilen,
DeX/Fensterbetrieb, physische SD-Entnahme/Neuvergabe und die tatsächliche
Google-Chrome-Menüübersetzung bleiben Geräteabnahmen. DOM-Übersetzung im
Helfertest ist keine echte Google-Chrome-Menüübersetzung.

Danach Windows mit frei gewähltem Rechnerordner fertigstellen, anschließend iOS.
Keine plattformspezifischen Hintergrund-/Browsergrenzen als erledigt ausgeben.
Vor der nächsten Änderung Arbeitsbaum, Remote-Stände und Parallelbranches
prüfen; vorhandene Arbeit erhalten. Kein Reset/Force-Push/unnötiger Worktree.
Klaus beauftragte zuletzt selbstständige, logische und nutzerfreundliche
Fertigstellung ohne weitere Rückfragen bis zum APK-Download.

## CI-Fortsetzung ohne falsche Nachweise

Ein älterer Telefonlauf scheiterte am Pixel-Systemlauncher, nicht an einem
behaupteten bestandenen Produktfall. Ein weiterer Gesamtcheck lud nach einer
Wiederholung den alten Fehlerbericht gleichen Namens. Beides ist im Baustand
belegt. Berichtsnamen enthalten jetzt API und Prüfversuch; die Aggregation
verlangt ausschließlich den neuesten Versuch. Fehlende neue Berichte dürfen
keinen alten Erfolg übernehmen. Alte Befunde bleiben erhalten.

Der zusätzliche unveränderte main-Lauf `39620337637` bestand die 47 Telefonfälle,
scheiterte danach aber am ADB/UIAutomator-Dump-Transport. Die reguläre
Telefonwiederholung in Versuch 2 ist inzwischen vollständig grün, einschließlich
47 Produktfällen, sichtbarer Neuinstallation und Gesamtfreigabe native-smoke
`119305514696`. Quell-/Tabletprüfungen wurden dabei aus dem erfolgreichen ersten
Versuch wiederverwendet. Diese Wiederholung ersetzt oder verändert weder den
ursprünglichen Freigabelauf noch die veröffentlichte Produktions-APK.

Eigene vorhandene GitHub-Verbindung verwenden und reale Rechte prüfen. Lange
lokale gh-watch-Prozesse können vorübergehend 401 erhalten; frische kurze
Abfragen funktionierten. Keine Zugangstoken auslesen oder übertragen.
MCP `github_fetch_workflow_job_logs` liefert Text in `structuredContent.content`.
Lokale Azure-Actions-Artefaktdownloads waren proxygesperrt; nicht umgehen.
Reguläre öffentliche GitHub-Release-Dateien konnten normal heruntergeladen werden.
