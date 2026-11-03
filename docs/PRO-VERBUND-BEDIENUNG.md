# Freiwillige Zusammenarbeit mit Pro-Apps

Aktueller Veröffentlichungsstand: Android und Windows **1.0.11**.
[Downloads, erfolgreiche Prüfungen und offene zusätzliche Android-Paarprobe](../BRIEF_ABSCHLUSS_2026-11-03_PRO-VERBUND.md).


In den Einstellungen führt „Pro-Apps“ zur Verbindung mit einem vorhandenen
Tresorordner. Derselbe Zugang steht unter „Tresor & Ablage“. Jede App behält ihre
eigene Arbeitsablage; eine Verbindung übernimmt oder sendet noch keine Datei.
Die Verbindung verwendet auf Android und Windows den [nativen Zugang](PRO-VERBUND-NATIV.md).

Im Eingang werden Dateien einzeln ausgewählt. „Auswahl übernehmen“ führt über den
gewöhnlichen Workflow-Import, bewahrt das Original und liest die gespeicherte
PDF-Fassung erneut nach. Erst danach wird die Empfängermarke gesetzt. Ungeeignete
Dateien, gesperrter Speicher und fehlgeschlagene Marken bleiben sichtbar offen.
Eine Wiederholung verwendet dieselbe Quittung und überschreibt keine spätere
Bearbeitung oder bewusst gelöschte Bibliothekskarte. Die Dateiprüfung bleibt ein
bewusster eigener Schritt; Übernehmen behauptet keinen bestandenen Schutztest.

„Teilen“ verwendet weiterhin die gewöhnliche Ausgabe des Kerns. Bei verbundenem
Tresor bietet ein zusätzlicher Dialog Familienakte Pro, Private Brain Pro,
BookLedgerPro und das Betriebssystem an. Die Pro-Übergabe nimmt bis 20 MiB pro
Datei an; BookLedgerPro erhält PDF, Bilder oder E-Mail-Dateien. HTML und kleine
Workflow-Arbeitsstände können an passende andere Ziele gehen. Ohne Verbindung
bleibt der bisherige Betriebssystemweg erhalten. Eine Betriebssystemauswahl
bestätigt keinen Empfang in der Ziel-App. Unter Windows entscheidet derselbe
Pro-Dialog vor dem WebView2-Teilen-Fenster; ist dieses nicht verfügbar, bleibt
der bisherige Explorer-Weg erhalten.

Die Herkunft gehört zum tatsächlich ausgegebenen File, nicht zum später offenen
Editor. Eine einzelne bearbeitete Eingangsdatei erhält die ursprüngliche
Dokumentkennung und einen Bezug zur vorigen Übergabe. Zusammengefasste Ausgaben
bekommen eine eigene Kennung. Ein Wechsel der Arbeitsablage während einer
vorbereiteten Ausgabe verlangt eine neue Ausgabe aus der gewünschten Bibliothek.

Im Ausgang sind „vorbereitet“, „bereitgestellt“ und „in der Ziel-App gespeichert“
getrennt. Vor dem ersten Senden liegen die ausgegebenen Bytes und die stabile
Kennung dauerhaft in der ausgewählten Arbeitsablage. Erneutes Bereitstellen nach
Neustart sendet genau diese Fassung. Nur die Marke der adressierten Ziel-App
bestätigt den Empfang. Danach wird eine nicht mehr benötigte Arbeitskopie entfernt;
Originale im gemeinsamen Übergabefach und eigene Bibliotheksdokumente bleiben erhalten.

## Sicherung und Ablagewechsel

Quittungen und ausstehende Ausgaben wechseln zusammen mit der eigenen Bibliothek
in eine gewählte verschlüsselte Ablage. Die interne Datenbank ist dabei kein
zweiter maßgeblicher Bestand. Der gesamte Sicherungs- und Wiederherstellungslauf
hält dieselbe Arbeitsablage fest; ein Speicherwechsel wartet auf diesen Lauf.

Gestreamte Sicherungen mit den neuen Pro-Metadaten verwenden Fassung 3. Ausstehende
Dateien werden einzeln, in verschlüsselten Stücken von 192 KiB geschrieben. Sie
werden nicht zu einem großen Base64-Paket zusammengefasst. Quittungen werden erst
nach dem authentifizierten Schluss übernommen. Abgebrochene Sicherungen erzeugen
keine angenommenen Quittungen; neu angelegte, unbenutzte Ausgangsdateien werden
wieder entfernt. Alte JSON-Sicherungen und gestreamte Fassung 2 bleiben lesbar.
Fassung 3 benötigt diese neue App-Fassung zum Zurückholen; ältere Leser können die
zusätzlichen Pro-Daten nicht zuverlässig wiederherstellen.

## Nachweise und Grenzen

`test-pro-verbund.mjs` verwendet den wirklichen gebündelten Kern und IndexedDB,
aber gestellte native Protokollmethoden. Die Gegenproben entfernen gezielt das
Warten auf Speicherung, die Ausgangsquittung, die Herkunftsbindung, die echte
Empfängermarke, Sicherungsdateien oder die Ablagebindung und müssen scheitern.
Weitere Gegenproben zeigen, dass Eingangsaktionen erst nach vollständig geladenem
Dialog erreichbar sind und Windows-Systemteilen die Pro-Auswahl nicht umgeht.
Die bisherigen Eingangs-, Ablage-, Schutz- und großen Sicherungsproben bleiben aktiv.

Die neuen Android- und Windows-Produktproben führen denselben Bedienweg in der
installierten Workflow-App aus. Ihr Gegenüber ist ein kanonischer Familienakte-
Java-Akteur. Das ist ausdrücklich noch kein Nachweis für zwei installierte Apps
oder für Klaus' Tablet/PC. Die vollständigen Plattformläufe müssen vor Übernahme
dieses Bausteins grün sein. Der Java-Prozess wurde zusätzlich mit einer wirklichen
20-MiB-Datei bei der ausgelieferten Speichergrenze geprüft.

Die PWA hat die allgemeine Ausgabeherkunft im Kern 1.1.8, aber keine native
Pro-Tresorverbindung. iOS bleibt ohne geprüfte native Gegenstelle vorbereitet.
Neue APK-/Windows-Veröffentlichungen und das Geschenk folgen erst nach dem
vollständigen übergreifenden Bauauftrag.
