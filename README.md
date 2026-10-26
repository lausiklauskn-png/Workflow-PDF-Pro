# Workflow PDF Pro

**[Android-APK 1.0.3 herunterladen](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/v1.0.3/Workflow-PDF-Pro-1.0.3.apk)** · [Erstinstallation](docs/ANDROID-START.md)

**[Windows 1.0.3 herunterladen](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/windows-v1.0.3/Workflow-PDF-Pro-Windows-1.0.3-Setup.exe)** (Windows 10/11, 64 Bit) ·
[Prüfsumme](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/windows-v1.0.3/Workflow-PDF-Pro-Windows-1.0.3-Setup.exe.sha256) ·
[Windows-Baustand](docs/portierung/BAUSTAND-WINDOWS.md). Doppelt anklicken; keine Administratorrechte nötig.
Noch unsigniert: Bei „Der Computer wurde durch Windows geschützt“ auf „Weitere Informationen“ und dann
„Trotzdem ausführen“ klicken. Keine automatischen Updates: eine neue Version von Hand über die alte
installieren. Auf einem eigenen Windows-PC ist die App noch nicht gemessen.

Version 1.0.4 (26.10.2026, auf main vorbereitet, noch nicht veröffentlicht): Webkern 1.1.1 mit Direktstart des
Scanners aus BookLedgerPro (`?scan=1&von=<App>`); Android-Buildnummer 5. Downloads oben bleiben 1.0.3.

Version 1.0.3 (22.10.2026): Versionsnummer unten bei „Impressum & Datenschutz“ und in den
Einstellungen, Knopf „▶ Alle prüfen“, Webkern 1.1.0.

Version 1.0.1 enthält das bestätigte Pro-Icon: roter Hintergrund bis außen,
weicher weißer Verlauf, großer W-Floh und rotes „PDF Pro“ auf dem Zettel.
Als Update über die vorhandene App installieren; vorher nicht deinstallieren.

Native Android-App mit dem vollständigen
[Workflow PDF](https://github.com/lausiklauskn-png/Workflow-PDF)-Kern.
Das Quellrepository und die übernommenen 191 Quelldateien bleiben unverändert.

Android enthält den lokalen PDF-/Formular-Editor, Scanner und OCR, Ausgabe und
Drucken, Arbeitsstände und Sicherungen, Suche, Spracheingabe und die bestehenden
Schutzmodule. Native Adapter verbinden Dateiauswahl, Kamera, Teilen, verschlüsselte
Hauptablage und Übersetzungswege mit dem unveränderten Kern.

Der verschlüsselte Tresor kann in einem selbst gewählten Ordner im Gerätespeicher
oder auf einem verfügbaren Datenträger liegen. Eine SD-Karte ist optional. Ohne
Ordnerwahl ist die interne Arbeitsablage nutzbar. Originale, Formularfelder und
seitenweise Übersetzungsstände werden bei der Tresorübernahme mitgenommen.

Übersetzen ist lokal mit Android-Sprachmodellen, über Google Chrome mit lokalem
geschütztem Hin-/Rücktransport oder freiwillig über bestehende KI-Anbieter mit
eigenem Schlüssel möglich. Der Chrome-Weg verwendet die gewählte sichtbare
Laufmeldung mit Abbruch; Reinigung und Bestätigung bleiben erhalten.

Die reguläre APK 1.0.1 ist nach vollständiger Freigabeprüfung, bestehender Signatur
und erfolgreicher Produktionsinstallation unter [Releases](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/v1.0.1)
verfügbar. Aktueller Stand und tatsächliche Nachweise:
[Android-Baustand](docs/portierung/BAUSTAND-ANDROID.md). Die erste physische
Geräteabnahme ist für Samsung Galaxy Tab S6 und S21 vorgesehen. Windows (Tauri 2)
ist als 1.0.1 veröffentlicht; iOS folgt.

[Erstinstallation und Speicherwahl](docs/ANDROID-START.md) ·
[Entwicklungsfortsetzung](docs/FOLGESITZUNG.md) ·
[Ursprünglicher Auftrag](BRIEF_NACHFOLGE_2026-10-21_APP_FERTIGSTELLEN.md) ·
[Gemeinsamer Signierweg](docs/SIGNIERUNG-UND-GITHUB.md)
