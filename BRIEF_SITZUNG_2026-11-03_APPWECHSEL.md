# Konkrete Rückmeldung: eigenständige Android-App beim Teilen

Klaus: Workflow PDF Pro soll beim Teilen an Familienakte Pro die andere eigenständige
App öffnen. Der PDF-Editor muss anschließend über seinen eigenen Task erreichbar bleiben,
mit unverändertem Arbeitsstand. Die eingebettete PDF-App funktioniert und bleibt bytegleich.
Familienakte selbst soll bei wiederholtem Zurück am Anfang geöffnet bleiben; das wird in
Meine-Familienakte PR67 getrennt umgesetzt. Im Browser bestätigt Klaus den vorhandenen Rückweg.

Workflow-PDF-Pro PR59: Nur Geräteadapter; ursprünglicher PDF-Kern unverändert.
Android-Ausgabe per startActivity statt startActivityForResult; FLAG_ACTIVITY_NEW_TASK
am Zielintent, bestehende ClipData/Lesefreigaben. Ergebnis bedeutet geöffnet, niemals
zugestellt. Die Meldung in den vier vorhandenen Sprachen entspricht diesem Zeitpunkt.
Normales Speichern mit Dateiauswahl behält seinen Aktivitäts-Rückkanal.

Version1.0.13 / Build14, bestehende Kennung und Signieridentität. Windows ebenfalls1.0.13;
PWA-Kern1.1.9 unverändert, iOS nicht veröffentlichen. Version1.0.12 ist entgegen der älteren
Notiz bereits veröffentlicht; GitHub vor jeder Freigabe erneut abgleichen.

Abnahme endet nach dem konkreten Appwechsel und den unveränderten regulären Freigabeketten.
Neue OS-Probe mit wirklichem Chooser und tatsächlicher veröffentlichter Familienakte-APK:
kalter und warmer Empfänger, unterschiedliche Tasks, Wiederverwendung und Rückkehr zum
unveränderten PDF-Fenster. Auf Android15 muss die zunächst eingeklappte Teilen-Liste
wirklich aufgezogen werden. Ein fehlgeschlagener Auswahlversuch räumt sein Systemfenster
auf, damit unabhängige Folgeproben ihren Eingabefokus behalten. Bisheriger Ausgabeadapter
als ausdrückliche Gegenprobe; ein bloßer SDK- oder Auswahlfehler zählt dafür nicht.

Stand vor Freigabe: Adapter-Browserprüfungen98/0; bytegleicher Ursprung216Dateien.
Vollständige Android12-Probe51/0 aufa334bf6, einschließlich Appwechsel und Überinstallation.
Android15 fand im ersten Stand den sichtbaren Empfänger noch nicht; danach fehlte drei
unabhängigen Folgeproben der Fokus. Beides wird im Probenablauf korrigiert und neu geprüft.
Keinen alten Lauf als Nachweis des späteren main-Commits ausgeben. Physische Samsung-/DeX-
und Mausbelegung ist nicht als im Emulator bewiesen zu bezeichnen. Die ältere vollständige
Android-Tresor-Paarprobe bleibt gesondert offen; Familienakte PR59 bleibt Entwurf.

Belegbarer gemeinsamer Arbeitsbeginn: Git-Zweig2026-11-03T16:44:19Z (17:44:19MEZ).
Fenster enthält CI und Warten, keine persönliche Aktivstundenmessung. Abschluss, tatsächliche
Freigaben und öffentliche Dateiprüfsummen folgen nach den Pflichtprüfungen. Messnotiz nur in Kimhub.
