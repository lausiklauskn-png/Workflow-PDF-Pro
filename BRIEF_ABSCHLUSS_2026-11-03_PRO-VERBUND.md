# Abschluss: Workflow PDF Pro im Familienakte-Verbund

Stand der Abschlussaufzeichnung: 03.11.2026, 01:10:30 Uhr MEZ.
Android und Windows **1.0.11** sind veröffentlicht. Kern **1.1.8** bleibt bytegleich.
Jede App ist einzeln nutzbar; die Verbindung über einen vorhandenen gemeinsamen
Pro-Tresor bleibt freiwillig. Eine Verbindung verschiebt noch keine ganze Bibliothek.

## Ergebnis

Ausgewählte Originale durchlaufen den gewöhnlichen Import und werden nach dauerhaftem
Speichern erneut gelesen. Erst danach folgt die Empfängermarke. Ausgangsbytes,
Quittungen und Quellbezug gehören zur gewählten Arbeitsablage. Wiederholung erzeugt
keinen zweiten Eingang; bearbeitete Rückgaben erhalten einen Bezug zur Quelle.
Der gewöhnliche Teilen-Dialog bietet bei verbundenem Tresor ein Pro-Ziel an, unter
Windows vor dem System-Teilen. Gestreamte Sicherung Fassung 3 erhält offene Ausgänge
und Herkunft; bisherige Formate bleiben lesbar. Die Verbindung unter Windows enthält
die kanonische Java-Laufzeit; ein zusätzlich installiertes Java ist nicht nötig.
Der bisherige Einzug der eigenen Ablage (D1) bleibt Android-spezifisch; der freiwillige
Windows-Zugang setzt diesen Einzug nicht voraus. iOS bleibt vorbereitet, unveröffentlicht.

## Tatsächlich veröffentlichte Dateien

- [Workflow-PDF-Pro-1.0.11.apk](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/v1.0.11/Workflow-PDF-Pro-1.0.11.apk), 83.337.922 Byte; SHA-256 `b659def8d0d10826e8c892feda0a3cd0d75697711be2c71d6299f91765ca387c`.
  Erfolgreiche Veröffentlichung: [Lauf 41547904611](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/41547904611); Quelle `0affaf162a6c58057c643c1d3b9b797a6512725b`.
- [Workflow-PDF-Pro-Windows-1.0.11-Setup.exe](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/windows-v1.0.11/Workflow-PDF-Pro-Windows-1.0.11-Setup.exe), 26.379.338 Byte; SHA-256 `70cc12d732f25b65852e831f0ec707d0118ef9949e678a0eaf8ca49bb9c96c84`.
  Erfolgreiche Veröffentlichung: [Lauf 41509257161](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/41509257161); Quelle `e2c57b3f514c0c3f118c23f243bf5ee9fe756bb7`.

Android behält die dauerhafte Signatur und die Paketkennung. Die reguläre signierte
Produktions-APK wurde installiert, ein erfundener Ordner über die sichtbare Oberfläche
angelegt und nach Überinstallation wiedergefunden. Ihr Download wurde anschließend
anonym geladen; Größe und SHA-256 stimmen mit dem öffentlichen Asset überein.
Windows behält seinen bereits geprüften veröffentlichten Installer. Der Installer
ist unsigniert; Updates werden von Hand über die bisherige Fassung installiert.
Der erfolgreiche Windows-Release prüfte auch den öffentlichen Download erneut.
Die unterschiedlichen Quellcommits betreffen den Android-Freigabeprüfer und dessen
Workflow; Android-/Windows-Anwendung, Kern und Formate blieben dabei bytegleich.

## Konkrete Korrektur am Freigabeprüfer

Der erste reguläre Android-Lauf 41526813777 bestand den vollständigen Bau, scheiterte
aber zweimal nach Überinstallation am unmittelbar auf die System-Startmeldung
folgenden pidof-Check. Erstinstallation und sichtbare Ordneranlage waren gelungen.
Die Veröffentlichung wurde deshalb angehalten. Die damalige eigentliche Ursache der
zwei fehlenden Prozessmeldungen ist nicht nachträglich bewiesen.

PR #55 (425d9d704996ef2d2f12131f97863ca92bc26092) kontrolliert den Prozess nach der
bereits vorhandenen sichtbaren Startbereitschaft beziehungsweise dem Testordner.
Der Prozesscheck bleibt bei Erstinstallation und Überinstallation zwingend. Kein
automatischer Neustart, keine zusätzliche Pause, keine längere UI-Frist. Bei Fehler
werden Aktivitätsantworten und vollständiges Logcat jetzt als Artefakt hochgeladen.

Gezielte Mock-ADB-Probe: alte Reihenfolge rot, korrigierte Reihenfolge grün; ein alter
sichtbarer Ordner ohne lebenden Prozess wird weiter abgewiesen. Entfernen des zweiten
Prozesschecks erzeugt eine falsche Quittung und wird von dieser Gegenprobe aufgedeckt.
Die vorherige 30-Sekunden-/Frühabbruch-Probe besteht weiterhin. Optimierte APK-Gegenproben
mit temporärer Prüfsignatur bestanden vor/nach der Korrektur (41533779700 / 41535547754).
Sie sind keine Produktionssignatur-Nachweise. Der erste Nachsteller 41532990772 stoppte
vor dem App-Test am falsch erwarteten Runtime-Quellstand; ein Werkzeugfehler, kein APK-Ergebnis.

Trotz PR #55 scheiterte der neue Produktionslauf 41539647722 nach der
Überinstallation. Jetzt lag das vollständige Logcat vor: START um 23:13:18.776 UTC,
System-Force-stop „pkg removed“ um .782 und Entfernung der Activity um .857.
Android bearbeitete die Paket-Ersetzung noch nach der Installationsantwort und
entfernte den bereits gestarteten Activity-Eintrag. Das belegt diesen Lauf; die
älteren zwei Ursachen bleiben mangels vollständiger Logs unbewiesen.

PR #56 (0affaf162a6c58057c643c1d3b9b797a6512725b) wartet nach Installation vor dem
einmaligen Start auf Androids ausdrückliche Bestätigung von am wait-for-broadcast-idle.
Der vorhandene 45-Sekunden-ADB-Timeout bleibt; keine zusätzliche UI-Frist, kein Neustart
und keine App-Änderung. Eine Mock-Gegenprobe ohne diese Barriere scheitert an der
nachgebildeten Systementfernung; eine unbekannte/unbestätigte Barriere scheitert
ebenfalls. Der vollständige Beleg steht in docs/portierung/ANDROID-RELEASE-INSTALLATION.md.

Alle regulären PR-Prüfungen und native Abnahme 41544678113 sind am exakten Kopf 0affaf1
grün (API 31, API 35, Quellen/Produktoberflächen und native-smoke). Derselbe geprüfte
Commit wurde ohne neue Mergeänderung auf main übernommen. Die anschließende reguläre
Veröffentlichung mit dauerhafter Signatur und sichtbarer Datenprüfung besteht ebenfalls.
Kein App-, Speicher-, Versions-, Format- oder Identitätswechsel für diese Prüferkorrektur.

Die vollständige lokale Webkette im neu gestarteten Arbeitscontainer konnte nicht
abgeschlossen werden: festgelegter Playwright-Browser und Roboto-Referenzschrift
fehlten, der Versuch mit System-Chromium 154 schloss das Prüffenster. Das ist kein
lokaler Erfolg. Die reguläre CI verwendet die vorgesehenen Abhängigkeiten und prüft
die vollständige unveränderte Kette. Lokal bestanden die gezielten Python-Gegenproben.

## Nachweise und Grenzen der Zusammenarbeit

Das Windows-Paar mit Familienakte ist vollständig bestanden: Familienakte-Lauf
41506243317, Job 125490024575. Zwei Originale, Kalt-/Warmstart, Prozessneustart,
Wiederholung, dauerhafte Quittung, bearbeitete Rückgabe und Abweisung einer falschen
Bestätigung liefen durch die tatsächlich installierten Produkte. Das ist ein
Prüfaufbau auf GitHub, kein persönlicher Windows-PC.

Android mit Familienakte ist weiterhin nicht vollständig als App-Paar geprüft:
Lauf 41514065036, Job 125515603016, Testmaschine während nativer Ordner-/Passwortbedienung
nicht mehr erreichbar; Ursache ungeklärt. Familienakte #59 bleibt Entwurf. Die reguläre
Einzel-App-Abnahme und die signierte Überinstallation ersetzen diesen Paar-Nachweis nicht.
Kein Scanner, keine persönliche SD/USB-Ablage und keine eigenen Geräte behauptet.
Dafür nur die bereits vorhandenen passenden Praxisreihen mit erfundenen Dateien verwenden;
keine neue allgemeine Kombination aller Geräte und Wege.

## Stundennachweis

Gemeinsame belegte Fenster: 1. November 2026, 14:09:02–16:32:52 Uhr MEZ
(13:09:02–15:32:52 UTC); 2. November ab 08:06:21 Uhr MEZ (07:06:21 UTC) bis zur
Aufzeichnung 03.11.2026, 01:10:30 Uhr MEZ (2026-11-03 00:10:30 UTC).
Sie enthalten CI und Wartezeit; aktive Stunden und Klaus' persönliche Anwesenheit sind
nicht gemessen. Die Nachtpause bleibt ausgenommen; parallele Repository-Zeiten werden
nicht addiert. Der endgültige gemeinsame Datensatz steht in Kimhub, keine zweite Buchung.

## Startauftrag zum Einfügen

```text
Repository lausiklauskn-png/Workflow-PDF-Pro, aktuellen main laden.
Zuerst AGENTS.md, docs/PRODUKTSTAND.md und BRIEF_ABSCHLUSS_2026-11-03_PRO-VERBUND.md lesen.
Android und Windows 1.0.11 sind veröffentlicht; dieselben Versionen nicht erneut auslösen.
Androids Freigabeprüfer prüft nach sichtbarer Bereitschaft weiterhin einen lebenden Prozess und erhaltene Daten.
Windows-Paar mit Familienakte vollständig geprüft; Android-Paar nicht vollständig geprüft, Familienakte #59 bleibt Entwurf.
Als Nächstes eine konkrete Rückmeldung aus den vorhandenen Testbögen auswerten oder die VM-Ursache gezielt klären.
Kein weiterer allgemeiner Testumbau, keine neue Pflichtzentrale. Kern bytegleich, Originale und Identitäten bewahren.
Forschung nur in Kimhub; Zeitfenster mit CI nicht als aktive oder persönliche Stunden ausgeben.
```
