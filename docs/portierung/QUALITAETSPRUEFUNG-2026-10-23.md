# Qualitätskorrektur für Android und Windows

Klaus hat die vorhandenen Varianten zur erneuten Fehlerprüfung beauftragt.
iOS bleibt als Vorbereitung für später auf seinem bestehenden Bauzweig gesichert.
Es gibt dafür weder eine Geräteabnahme noch eine Veröffentlichung.

Der Windows-Dateiname wird auf vollständigen Unicode-Zeichen begrenzt, nach NFC
normalisiert und unter den Grenzen des Dateisystems gehalten. Eine vorhandene
Dateiendung bleibt erhalten. Der Tresor weist ungültige Dateinamen kontrolliert
ab, statt beim Schneiden eines UTF-8-Zeichens abzustürzen. Gegenproben benutzen
echte Dateien und laufen auch auf Windows.

Der gemeinsame Webkern stammt bytegleich aus Workflow-PDF
`f253205702ea07710ca9ca249328b21b1a9dd3ed`: 196 Dateien samt Herkunftsmanifest.
Die PWA löscht beim Aktualisieren keine fremden App-Caches mehr; die schmale
Kopfleiste bleibt vollständig sichtbar. Diese Korrekturen werden gemeinsam
übernommen, nicht getrennt im nativen Bündel nachgebaut.

Die vollständigen Prüfketten auf `ebfd6cd` sind grün:

- Windows, gemeinsame Kern-/Android-Gegenprobe und reale WebView2-Abnahme:
  [39863145596](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39863145596).
- Gesamte Produktkette einschließlich Android-Tablet/API-35-Telefon,
  Modell/OCR und Sammelabnahme:
  [39863145589](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39863145589).

Damit die Korrektur als Update installierbar wird, ist die gemeinsame Version
`1.0.4`, Android-Buildnummer `5`, vorbereitet. Paketkennungen und Signieridentität
bleiben erhalten. Die vollständige Abnahme wird für diesen Versionsstand erneut
ausgeführt. Vorhandene Versionen und Releases werden nicht überschrieben.

Noch keine Übernahme nach main und keine Veröffentlichung: Nach den konkreten
Ergebnissen erfolgt die ausdrückliche Freigabe. Diese Notiz ist kein neuer
Gerätetest auf Klaus' Hardware.
