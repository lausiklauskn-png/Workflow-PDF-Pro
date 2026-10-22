# Abschluss der Windows Sitzung für Workflow PDF Pro

Stand 22.10.2026. Klaus beendet die Windows-Arbeit vorerst. Nächste geplante Plattform ist iOS; dazu liegt ein eigener [Nachfolgebrief](BRIEF_NACHFOLGE_2026-10-22_IOS.md) vor. In dieser Abschlussfortsetzung werden nur Übergabe und Entscheidungen dokumentiert; kein neuer Installer wird veröffentlicht.

## Veröffentlichtes Windows Programm

Für Windows 10 und 11, jeweils 64 Bit, ist weiterhin **Version 1.0.1** verfügbar:

[Workflow-PDF-Pro-Windows-1.0.1-Setup.exe](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/windows-v1.0.1/Workflow-PDF-Pro-Windows-1.0.1-Setup.exe)

Die Veröffentlichung `windows-v1.0.1` stammt von `e824e73666bc7775bca034877a63f81ceb76055e`. Der Installer hat 15.147.075 Bytes und SHA-256 `f7d5bffd800c7bd01915744d71aea42b3f7c6b05c3de60a37ecc2f18d179a099`. Veröffentlichung, zugehöriger Quellstand und Releaseablauf wurden erneut abgeglichen. Klaus' konkrete heruntergeladene Kopie lag nicht zur Dateiprüfung vor.

Der Installer ist unsigniert. Die App enthält in dieser Version keine automatische Update-Funktion und keinen Update-Schlüssel. Windows kann eine Warnung anzeigen; verwaltete Rechner oder strengere Sicherheitseinstellungen können die Ausführung verhindern. Eine allgemeine Installationsgarantie besteht daraus nicht.

## Abschließende Entscheidungen von Klaus

- Verteilung zunächst weiterhin per Setup.exe beziehungsweise Downloadlink. Eine neue Version wird bei geschlossener App über die vorhandene Installation installiert; vorheriges Deinstallieren ist nicht nötig.
- Kein kostenpflichtiges Windows-Signierkonto, kein selbstsigniertes Windows-Herausgeberzertifikat.
- Solange Updates manuell installiert werden, wird kein Update-Schlüssel benötigt und deshalb keiner eingerichtet.
- Ein kostenlos selbst erzeugter Tauri/minisign-Schlüssel ist erst bei späterer Aktivierung der automatischen Updates nötig. Er sichert die Echtheit der Updates innerhalb der App und ersetzt keine von Windows anerkannte Herausgebersignatur.
- Die erste Version mit aktivierten automatischen Updates müsste einmal manuell über 1.0.1 installiert werden. Eine solche Aktivierung ist jetzt nicht beauftragt.

## Bereits übernommene Verbesserungen

[PR #13](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/pull/13) ist in main übernommen, Merge `6ad70071fb1076f365c58a1f749cba2498f2382f`. Stand vor diesem Abschlussbrief: `03599afc9959446878aeaf83a602c8ded2995261`.

Der Windows-Quellstand trägt **1.0.2**, ist aber noch nicht als Download veröffentlicht. Enthalten sind wieder aktivierter WebView2-SmartScreen, eine Content Security Policy, engere Prüfungen der nativen Aufrufe und der vorbereitete Update-Adapter. Adapter und Dialoge verwenden Inhaltsprüfsummen in ihren URLs gegen veraltete Cachefassungen. Der leere öffentliche Schlüssel unter `windows/signing/updater.pub` hält die Updatefunktion deaktiviert; es erfolgen dadurch keine automatischen Updateabfragen.

Nachweis: [Windows-Lauf 39768752969](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39768752969) auf `7cf2f51a396a64592349546a74ffc6944341f544` erfolgreich. Geprüft wurden unter anderem PDF/Formulare, OCR, Exporte, Tresor, Neustart und Datenerhalt nach Neuinstallation, CSP, Schreibbarrieren vor Updates sowie die Update-Signaturregeln mit flüchtigen Testschlüsseln. 191/191 übernommene Quelldateien blieben unverändert. Einzelheiten und korrigierte Vorfehler stehen im [Windows-Baustand](docs/portierung/BAUSTAND-WINDOWS.md).

Das belegt weder eine echte Installation auf Klaus' Windows-PC noch eine erfolgreich durchgeführte automatische Aktualisierung oder Windows-Herausgebersignierung. Die Sicherheitsverbesserungen aus 1.0.2 sind im veröffentlichten Installer 1.0.1 noch nicht enthalten.

## Speicher und Datenerhalt

Die Programmdateien liegen auf dem Rechner. Bei eingerichteter Tresornutzung liegen dauerhafte Dokumente und wiederherstellbare Arbeitsstände verschlüsselt im gewählten Ordner: auf dem Rechner, einer SD-Karte oder einem USB-Laufwerk. SD-Karte und externe Ablage sind optional. Einstellungen, Bibliotheks-/Suchindex und nötige Arbeitsdaten liegen zusätzlich lokal unter `%LOCALAPPDATA%\de.familyprojekt.workflowpdf.pro`; API-Schlüssel bleiben gerätelokal.

Ein reguläres Update behält App-Identität und Datenorte bei und soll diese Daten erhalten; der Datenerhalt ist im Windows-Prüflauf belegt. Das ersetzt keine Sicherung. Passwort, Sicherungen und vorhandenen Tresor bewahren; fehlender Tresor darf keine leere Ersatzbibliothek erzeugen.

## Bei einer späteren Windows Fortsetzung

Der aktuell eingecheckte Releaseablauf `.github/workflows/windows-release.yml` verlangt noch Microsoft Artifact Signing und einen Update-Schlüssel. Diese technische Pflicht stammt aus der vorherigen Vorbereitung und **entspricht nicht mehr Klaus' abschließender Wahl**. Sie wurde in dieser Abschlussfortsetzung nicht umgebaut.

Vor der nächsten Windows-Veröffentlichung diesen Ablauf für einen geprüften, unsignierten manuellen Installer korrigieren. Beibehaltung der Identität, Versionsanstieg, Abnahme desselben main-Commits, Prüfsummen und unabhängigen Downloadvergleich erhalten. Signaturprüfungen nicht durch vorgetäuschte Signierung ersetzen. Kein Konto und keinen Schlüssel allein zum Überwinden des alten Gates anlegen.

Jetzt keine weiteren Windows-Bauten, Releaseversuche oder Kontoarbeiten starten. Android-App, deren Signieridentität, Quellrepo und `upstream/workflow-pdf` bleiben erhalten.
