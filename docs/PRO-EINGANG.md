# Dauerhafter Eingang in Workflow PDF Pro

Android und Windows verwenden für empfangene Dateien denselben Importadapter.
Nach „Einlesen“ werden die nativen Empfangskopien vollständig auf Größe und
SHA-256 geprüft. PDF, Foto und Arbeitsstand gehen anschließend durch den normalen
Workflow-Import. Eine feste Kennung wird vorher gespeichert; nach einem Abbruch
wird derselbe Eintrag fortgesetzt. Eine bereits abgeschlossene Übernahme ersetzt
keine späteren Änderungen und erzeugt kein zweites Dokument.

Die Empfangsbestätigung folgt erst auf das Zurücklesen des gespeicherten PDF,
des unveränderten Originals und die abgeschlossene Quittungstransaktion. Bei
Teilimport, vollem Speicher oder verlorener Bestätigung bleibt die native Kopie
offen. „Erneut versuchen“ setzt fort. „Nicht einlesen“ verwirft den angebotenen
Eingang ausdrücklich. Empfangene Kopien lassen sich wie bisher in der
Empfangshistorie erneut anbieten oder löschen.

Quittungen gehören zur jeweiligen Ablage. Ohne eigenen Dokumenttresor liegen sie
in der zusätzlichen Datenbank `WorkflowProTransfers1`; Name und Version der
Kern-Datenbank `WorkflohPDF1` bleiben gleich. Bei einer eingerichteten Ablage liegen
sie zusätzlich in deren vorhandenen verschlüsselten `settings`-Datensätzen. Der
Wechsel der Ablage wartet auf laufende Importe und übernimmt die Quittungen in
derselben Zielgeneration. Ein abgebrochener Wechsel überschreibt keinen Konflikt.

Die native `.wfps`-Sicherung trägt die Quittungen als optionales Metadatenfeld im
bestehenden verschlüsselten Kopf mit. Erst ein vollständig authentifiziertes
Sicherungsende erlaubt ihre Wiederherstellung. Alte Sicherungen bleiben lesbar;
ältere App-Fassungen kennen das neue Metadatenfeld noch nicht. Das unveränderte
Eingangsoriginal liegt im bestehenden Originalfach und reist mit der Sicherung.

Der kanonische Kern stammt aus Workflow-PDF 1.1.7, Commit
`ee5547f5cca7c99b8c99397b7e6962948923951d` (PR #140). Er wird ausschließlich mit
`python3 tools/onboarding/nachziehen.py /pfad/zu/Workflow-PDF COMMIT` nachgezogen.
Das Werkzeug prüft zuerst die bisherige Kopie und schreibt die vollständigen
Herkunftsnachweise neu. Es verändert keine Quellmodule. Im nativen Einstiegspunkt
ersetzt der vorhandene native Netzadapter den inzwischen hinzugekommenen
Web-Netzadapter, damit nur ein Schalter das Antworten im Mycel steuert.

Die Browserproben laufen mit dem echten Kern und IndexedDB; nur Betriebssystem-
und Ordnerzugriffe sind dort Protokollgegenstellen. Die Android- und installierten
Windows-Prüfungen bleiben für die Übernahme erforderlich. Dieser Abschnitt
behandelt den Betriebssystem-Eingang. Die unabhängige Verbindung zum gemeinsamen
Pro-Tresor und deren Hin- und Rückweg werden im folgenden Bauabschnitt ergänzt.
