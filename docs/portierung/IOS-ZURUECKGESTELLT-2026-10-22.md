# iOS als Vorbereitung gesichert — Entscheidung vom 22.10.2026

Klaus stellt Workflow PDF Pro für iOS bis zu einer späteren Veröffentlichung zurück.
Es gibt derzeit kein Apple-Gerät für Tests und keine Bereitschaft, die jährliche
Apple-Developer-Mitgliedschaft zu bezahlen. Keine Anmeldung, Zahlung, signierte
Veröffentlichung oder erneute Nachfrage nach einem Testgerät daraus ableiten.

Der bisherige Bau ist eine nützliche Vorbereitung, keine fertig abgenommene App.
Der bestehende Branch `codex/ios-native-host` und der offene Entwurf
[PR #17](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/pull/17) bleiben erhalten.
Der identische gemeinsame Kern wie bei Windows wurde nicht verändert.

## Letzter vollständig erfolgreicher Code-Nachweis

Code-Commit `7f66c7f9320b476f0eae32d67c7dbf7f459d0a40`, Apple-Lauf
[39856502604](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39856502604):
21 Swift-Tests, jeweils 15 WKWebView-Hosttests auf iPhone- und iPad-Simulator,
54 Datei-Kryptografie-Gegenproben, drei Unicode-Passwort-Gegenproben,
90 Ersatzschlüssel-Kombinationen, neun vollständige Tresor-Ordner-Gegenproben
mit unveränderten Android-/Windows-Implementierungen und unsignierter
Release-Gerätebau bestanden. 193 Herkunftsdateien und drei Apple-Bündeltests grün.
Simulator: iOS/iPadOS 18.5, Xcode 16.4. Kein Test auf Klaus' Hardware.

Offen bleiben insbesondere tatsächliche Übersetzung und Browser-Rückweg,
Geräte-/Dateianbieter-/Lebenszyklusprüfung, echte Spracheingabe, vollständige
Offline-Modellrechnung, Mindestversionsabnahme und signierter Vertrieb.
Die Share Extension ist gebaut und ihr Speichervertrag geprüft; der echte
Teilen-Dialog aus fremden Apps ist nicht auf einem Gerät abgenommen.

## Neuer Arbeitsauftrag

Die vorhandenen Varianten auf konkrete Fehler und Mängel prüfen: Workflow PDF Pro
Windows und Android, Workflow PDF PWA sowie die bestehenden Private-Brain-Varianten.
Private Brain Pro hat am geprüften main `8dae28113f7fa19a4446406f492e0c307c4ef0cb`
keinen Windows-Host; aktuell existiert Android als Vorschau (zuletzt .27).
Die separate PWA liegt in `lausiklauskn-png/Privat-Brain`.

Keinen neuen Private-Brain-Windows-Port aus diesem Prüfauftrag ableiten.
Den früher gewünschten Private-Brain-iOS-Nachfolgebrief weiterhin erst nach
vollständigem Abschluss von Workflow PDF Pro für iOS erstellen.
