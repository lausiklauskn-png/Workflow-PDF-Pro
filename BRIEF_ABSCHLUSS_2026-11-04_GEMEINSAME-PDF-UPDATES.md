# Gemeinsamer PDF-Updateweg

Auftrag: PDF-Funktionen aus der gemeinsamen Quelle aktualisieren und in Familienakte
unter Beibehaltung der dortigen Gestaltung verfügbar halten. Eigenständig online prüfen.

Ergänzt: `npm run update:pdf` (Online-Vorschau) und `-- --anwenden` (kanonische Übernahme).
Der bestehende Python-Kopierer und seine Herkunftsprüfung werden weiterverwendet.
Ein täglicher/manueller Workflow bereitet bei neuem Kern einen geprüften Entwurfs-PR
vor und fordert die bestehenden Android-/Windows-Prüfungen am Updatezweig an.

Online geprüft: Workflow-PDF 0ed15e5 entspricht bereits dem eingebetteten Kern.
Deshalb kein künstliches Kernupdate, keine neue App-Version und kein Release.
216 Quelldateien bestehen die Herkunftsprüfung. Der gebündelte Webbau besteht.
Update- und PR-Proben mit echten temporären Git-Repositories bestehen; die GitHub-CLI
in der PR-Probe ist simuliert. Gegenproben: lokale Kernänderung und unerlaubter Patch.

Der zugehörige Familienakte-PR ergänzt den täglichen Folgeabgleich und erhält dort
Brücke, Farben und Datenbanktrennung. Details: `docs/PDF-KERN-UPDATES.md`.
Android/Windows/iOS-Laufzeitquellen unverändert; vorhandene Plattformgrenzen bleiben
in `docs/PRODUKTSTAND.md` dokumentiert. Keine neue Geräteabnahme behauptet.

Zeit: keine gesonderte aktive Stundenmessung; keine persönliche Arbeitszeit behauptet.
