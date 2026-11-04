# Gemeinsamen PDF-Kern aktualisieren

Die gemeinsame Quelle bleibt `lausiklauskn-png/Workflow-PDF`. Pro übernimmt diesen
Kern ausschließlich bytegleich mit `tools/onboarding/nachziehen.py`. Die Familienakte
verwendet dieselbe Quelle und behält ihre eigene Brücke und Gestaltung. Kein neues Repo.

Direkt im Pro-Quellprojektordner:

```sh
npm run update:pdf
npm run update:pdf -- --anwenden
```

Der erste Befehl lädt die öffentliche Quelle unter `work/Workflow-PDF` und zeigt
nur den Vergleich. Der zweite übernimmt einen neuen Stand mit dem vorhandenen
kanonischen Kopierer und prüft die Herkunft. Für eine bereits vorhandene Quelle:
`npm run update:pdf -- --lokal --anwenden`. Git, Node.js und Python 3 werden benötigt.
Das ist kein Befehl für den installierten APK-/EXE-Ordner und kein App-Updater.
Native Adapter, eigene Einstellungen, Signieridentitäten und Nutzerdokumente bleiben
außerhalb des Kopierbereichs. Danach die vollständigen Prüfketten ausführen.

Der tägliche Workflow `Gemeinsamen PDF-Kern aktualisieren` läuft um 06:03 UTC
(07:03 MEZ bzw. 08:03 MESZ), außerdem auf manuelle Wahl. Er bereitet einen neuen
Stand vor und prüft Originalkette und native Webanbindungen. Erst danach öffnet ein
getrennter Job einen Entwurfs-PR mit einem Zweig je Quellcommit. Vorhandene Vorschläge
werden nicht überschrieben. Android-Abnahme und Windows-Prüfbau werden ausdrücklich
am Updatezweig angefordert, weil der GitHub-eigene Token gewöhnliche PR-Ereignisse
nicht erneut auslöst. Ein PR-Lauf selbst erhält nur Leserechte.

Die Repository-Einstellung muss GitHub Actions das Erstellen von PRs erlauben.
Das nutzt den temporären Workflow-Token; kein persönlicher Schlüssel in der App.
Verweigerte Rechte erzeugen einen Fehler, keine behauptete erfolgreiche Aktualisierung.
Update-Patch und Quellstände werden als Artefakt aufbewahrt. Ein Artefakt aus einem
Fehlerlauf gilt nicht als Freigabe. Kein automatischer Merge und keine Veröffentlichung.

Nach geprüftem Merge kann der tägliche Familienakte-Abgleich denselben Kern übernehmen.
Dort verhindern zusätzliche Designprüfungen eine ungeprüfte Übernahme von HTML/CSS und
anderen Gestaltungsdateien; eigene Adapter und Datenbanktrennung bleiben erhalten.
Die beiden Quellprojekte aktualisieren sich damit aus einer gemeinsamen Quelle. Die
installierten Apps folgen erst mit ihrer gesondert freigegebenen Veröffentlichung.

Prüfungen dieser Einrichtung: temporäre echte Git-Repositories mit dem kanonischen
Python-Kopierer; Vorschau, Update, Adaptererhalt und Abbruch bei lokalen Kernänderungen.
Die PR-Probe verwendet einen echten lokalen Git-Push und einen ausdrücklich simulierten
GitHub-CLI. Sie prüft Entwurf, explizite Prüfläufe, Wiederholung und unerlaubte Patchpfade.
Ein erfolgreicher zukünftiger Online-Update-PR benötigt einen tatsächlich neuen Kern.
