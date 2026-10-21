# Workflow PDF Pro auf Android

**[Workflow PDF Pro 1.0.0 als APK herunterladen](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/v1.0.0/Workflow-PDF-Pro-1.0.0.apk)**

Die reguläre APK ist veröffentlicht. Signatur, öffentliche Downloadbytes und
tatsächliche Produktionsinstallation mit erhaltenen Daten nach erneuter
APK-Installation sind geprüft. Die Veröffentlichung enthält Prüfsumme und
Signatur-/Installationsnachweise; der Android-Baustand nennt die genauen Läufe.

## Erstinstallation

Voraussetzung: Android 8 oder neuer mit aktueller Android-System-WebView
(ab Version 120). Ist die Systemkomponente zu alt, zeigt die App einen
Aktualisieren-Weg, bevor die Dokumentfunktionen starten.

1. Die APK auf dem Android-Gerät herunterladen und öffnen. Falls Android fragt,
   die Installation für den verwendeten Browser oder Dateiordner erlauben.
2. **Workflow PDF Pro** starten. Die bestehende Workflow-PDF-Web-App hat eine
   eigene Ablage und bleibt erhalten. Vorhandene PDFs, Arbeitsstände und
   verschlüsselte Workflow-Sicherungen lassen sich über die bisherigen Wege
   einlesen.
3. Die App funktioniert ohne SD-Karte. Für die dauerhafte Hauptablage in den
   Einstellungen **Speicher und Dokumenttresor** öffnen, einen eigenen Ordner
   auswählen und den Tresor in der App einrichten oder entsperren. Die ausdrückliche
   Übernahme nimmt Dokumente, Originale, Felder und Übersetzungsstände mit.
   Frühere Ordner und Sicherungen bleiben erhalten.

## Übersetzen

- **Mit Google auf dem Gerät übersetzen:** Die benötigten Android-Sprachmodelle werden beim
  ersten Gebrauch geladen. Anschließend wird der Text lokal verarbeitet. Vor dem ersten Gebrauch erklärt
  die App, dass das Google-SDK technische Nutzungs-/Leistungsdaten übermittelt.
  Erst nach Zustimmung wird dieses optionale SDK initialisiert.
- **Mit Chrome übersetzen:** Die Laufmeldung mit Abbruch benötigt die
  Benachrichtigungsfreigabe. Nach der bestehenden Reinigung öffnet sich Chrome.
  Dort **⋮ → Übersetzen** und die gewünschte Zielsprache wählen. Der bereinigte
  Text geht dabei an Google. Das Ergebnis gelangt lokal zurück in die App, die
  daraus das PDF erstellt. Fertige Seiten werden für eine Fortsetzung gespeichert.
- **Mit KI:** Bestehende Anbieter, eigener Schlüssel und bisherige Bestätigung.
  Schlüssel und gerätelokale Netzidentitäten werden nicht automatisch in den
  Dokumenttresor übernommen.

## Empfangen und wiederherstellen

PDFs, Bilder und Arbeitsstände können per Android **Teilen** oder **Öffnen mit**
an die App gegeben werden. Erst **Einlesen** übergibt die vollständigen Dateien
an die Bibliothek. Private Empfangskopien sind getrennte Arbeitskopien; über
**Empfangene Dateien wiederherstellen** in den Einstellungen lassen sie sich
erneut anbieten oder ausdrücklich löschen. Erneutes Einlesen kann Duplikate
erzeugen. Das Löschen einer Empfangskopie entfernt keine importierten Dokumente.

## Prüfstand

Automatisierte native Prüfungen unterscheiden echte PDF-/Speicher-/Modell-/OCR-
Ausführung von synthetischen Kamera- und Sprachaktivitäten. Eine physische
Samsung-Geräteprüfung und eine manuelle Google-Chrome-Menüübersetzung werden
aus Emulatorläufen nicht abgeleitet. Genaue Versionen von Android, Chrome und
System WebView der Zielgeräte sind noch nicht gemessen.
