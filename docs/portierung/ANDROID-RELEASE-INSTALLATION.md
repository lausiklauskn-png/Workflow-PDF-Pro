# Android: abgeschlossene Installation vor dem Start abwarten

## Belegter Fehler

Regulärer Produktionslauf [41539647722](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/41539647722),
Quelle `425d9d704996ef2d2f12131f97863ca92bc26092`, Job `125612193804`:
Erstinstallation und sichtbare Ordneranlage bestanden. Nach `adb install -r`
meldete `am start -W` zwar `Status: ok`, aber keinen abgeschlossenen Kaltstart.
Das jetzt gesicherte vollständige Logcat zeigt am 2. November 2026 (UTC):

```text
23:13:18.776 ActivityTaskManager: START ... workflowpdf.pro/.MainActivity
23:13:18.782 ActivityManager: Force stopping ... user=0: pkg removed
23:13:18.857 WindowManager: Force removing ActivityRecord ... MainActivity
```

Die Paket-Ersetzung entfernte den unmittelbar gestarteten Activity-Eintrag.
Die abschließende Oberfläche war der Android-Startbildschirm, kein App-Absturzdialog.
Das erklärt diesen Lauf; die zwei älteren Fehlschläge ohne vollständiges Logcat
werden damit nicht nachträglich zu bewiesenen gleichen Ursachen erklärt.

## Korrektur und Grenzen

`verify-signed-install.py` wartet nach jeder Installation vor dem einmaligen
gewöhnlichen Start auf `am wait-for-broadcast-idle` und dessen ausdrückliche
Bestätigung `All broadcast queues are idle!`. Android 12 stellt diesen Shellbefehl
bereit. Der vorhandene ADB-Aufruf bleibt auf 45 Sekunden begrenzt; fehlende
Bestätigung oder Timeout verhindern die Veröffentlichung. Kein Neustartversuch,
kein längeres UI-Zeitfenster und keine Änderung der Anwendung, ihrer Daten oder Signatur.

Die Prüfung verlangt weiterhin sichtbare Ordneranlage, laufenden Prozess,
Überinstallation und anschließend erhaltenen Ordner bei laufendem Prozess.
Der zuvor in PR #55 ergänzte Fehler-Artefakt-Upload bleibt erhalten und sichert
zusätzlich die Antworten der Installationsbarriere.

Die lokale Mock-ADB-Gegenprobe bildet die verspätete Systementfernung nach:
ohne Barriere keine Installationsquittung, mit Barriere vollständiger Prüffluss.
Eine unbekannte oder unbestätigte Barriere scheitert ausdrücklich. Diese
Werkzeugproben sind keine Emulator- oder Produktionssignatur-Nachweise.
Die reguläre native Abnahme und die tatsächliche Veröffentlichung mit dauerhafter
Signatur müssen anschließend auf dem neuen exakten Quellstand bestehen.

Die Anwendungspfade sind gegenüber der veröffentlichten Windows-Fassung 1.0.11
bytegleich; es wird kein zweiter Windows-Installer derselben Version erstellt.
