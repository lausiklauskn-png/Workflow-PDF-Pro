# Funktionsmatrix für die native Übernahme

Stand 20.10.2026. Quelle `7227c543d4a536cf8f3354a56fbba7574645703e`.
Diese Matrix beschreibt den vorhandenen Umfang, keine fertige native App.
**Alle nativen Nachweise sind offen.** Testnamen bezeichnen vorhandene Prüfungen,
keine hier behaupteten Erfolge. Aktuelle Ergebnisse stehen separat in PRUEFSTAND.md.

Quellstellen beziehen sich auf Workflow-PDF am genannten Commit. Native Anbindung
ist ein Prüfbedarf/Vorschlag; komplexe Lösungen sind nicht vorentschieden.

Die ergänzenden Dateien BEDIENELEMENTE.json (414 statische HTML-Vorkommen, auch
Vorlagen mit dynamischen Platzhaltern), FUNKTIONEN-QUELLINDEX.json und
QUELLDATEIEN-SHA256.json halten die Einzelstellen und den vollständigen Dateibestand
fest. Die statische Erfassung ist kein Beweis, dass sämtliche Laufzeitkombinationen
abgedeckt sind. Dynamische Knopfreihen werden in den folgenden Zeilen mit ihren
Varianten benannt; die native Abnahme muss jede davon ausüben.

| ID | Funktion und bisheriges Verhalten | Quellstelle | Vorhandene Tests (`tests/*.mjs`) | Native Anbindung / Nachweis offen |
|---|---|---|---|---|
| F001 | **Bibliothek**: Alle, Ohne Ordner, eigene und Übersetzungsordner; Dokumentzahlen und leere Zustände | `assets/app.js:181` `zeichneBibliothek` | bibliothek,ordner,sprache | lokaler Webkern/IndexedDB; **offen** |
| F002 | **Dateien importieren**: PDF, Bild, mehrere Dateien, Arbeitsstand; Dateifehler einzeln melden | `assets/app.js:1144` `importDateien` | e2e,eingang | System-Dateiauswahl und content-URI lesen; **offen** |
| F003 | **Ordner importieren**: Ganzen Ordner einlesen, natürliche Dateireihenfolge, Ordnername | `assets/app.js:1144` `importDateien` | ordner | nativer Ordnerwähler; Freigaben und Wiederwahl prüfen; **offen** |
| F004 | **Drag-and-drop**: Dateien in Bibliothek ziehen | `assets/app.js:2997` `start` | e2e | WebView/Desktop-Dateiübergabe prüfen; **offen** |
| F005 | **Teilen empfangen**: Worker-POST, Übernahmespeicher leeren, keine/leere/fehlerhafte Dateien melden | `assets/app.js:3109` `geteiltUebernehmen` | teilen-empfang | Android SEND/SEND_MULTIPLE und iOS-Share-Erweiterung gesondert; **offen** |
| F006 | **Öffnen mit**: launchQueue-Dateien lesen, PDF/Bilder übernehmen | `assets/app.js:3129` `oeffnenMitEmpfangen` | teilen-empfang | native Dateizuordnung und Neustart-/Warmstart-Übergabe; **offen** |
| F007 | **Ordner anlegen**: Name abfragen; Abbruch ohne Anlage | `assets/app.js:624` `neuerOrdner` | ordner,sprache | Webkern unverändert; **offen** |
| F008 | **Ordner umbenennen**: Abgeleitete Namen ziehen mit; selbst umbenannte bleiben | `assets/app.js:181` `zeichneBibliothek` | chrome,ordner | Webkern unverändert; **offen** |
| F009 | **Ordner löschen**: Rückfrage; Dokumente bleiben unter Ohne Ordner | `assets/app.js:181` `zeichneBibliothek` | ordner | Webkern unverändert; **offen** |
| F010 | **Verschieben**: Ein oder mehrere Dokumente in vorhandenen/neuen Ordner | `assets/app.js:629` `verschieben` | teilen | Webkern unverändert; **offen** |
| F011 | **Duplikat/Vorlage**: Dokumentkopie mit eigenen Kennungen | `assets/app.js:817` `duplizieren` | e2e | Webkern unverändert; **offen** |
| F012 | **Dokument löschen**: Rückfrage; Datei, Seitentext, Vektoren und Originalfoto entfernen | `assets/app.js:823` `loeschen` | eingang,teilen | Webkern unverändert; **offen** |
| F013 | **Mehrfachlöschen**: Eine Rückfrage mit Namen/Anzahl; Auswahl aufheben | `assets/app.js:831` `loeschenMehrere` | teilen | Webkern unverändert; **offen** |
| F014 | **Auswahl**: Kästchen, langer Druck, Alle, Teilen, Verschieben, Löschen, Fertig | `assets/app.js:667` `wahlLeiste` | teilen | Touch/Maus/DeX prüfen; **offen** |
| F015 | **Ziehen mit Verweilen**: 450 ms Langdruck, 250 ms Verweilen, Autoscroll, Schattenbild, neue Ordner | `assets/app.js:699` `ziehenBinden` | teilen | echte Touch-/DeX-Prüfung; **offen** |
| F016 | **Nach oben**: Kartenpfeil nach Scrollen | `assets/app.js:285` `ganzNachOben` | bibliothek | Touch/Maus prüfen; **offen** |
| F017 | **Sortieren**: Name natürlich, Änderung, Größe, Seiten, Erstellung; Suche nach Trefferstärke | `assets/app.js:167` `sortiere` | ordner,bibliothek | Webkern unverändert; **offen** |
| F018 | **Erstellungszeitraum**: Von/bis einschließlich, widersprüchliche Enden korrigieren, Rücksetzen | `assets/app.js:181` `zeichneBibliothek` | bibliothek | Systemkalender prüfen; **offen** |
| F019 | **Öffnen/Benennen**: PDF rendern; Namen ändern, zurück zur Bibliothek | `assets/app.js:1214` `oeffneDok` | e2e | Webkern/Dateispeicher; System-Zurück; **offen** |
| F020 | **Vorhandene Formularfelder**: AcroForm-Felder und Werte importieren | `assets/app.js:888` `vorhandeneFelder` | e2e | Webkern unverändert; **offen** |
| F021 | **Offline-Erkennung**: Linien, Rahmen, Kästchen, graue Flächen, Beschriftung; Rahmen um mehrere Felder kein Feld | `assets/app.js:1838` `erkenneDok` | e2e,beispiele | lokaler PDF-/Canvas-Kern; **offen** |
| F022 | **KI-Erkennung**: Freiwillig BYOK, nummerierte Kandidaten, Bildreinigung, Einwilligung, Abbruch | `assets/app.js:1816` `kiSeitenBild` | e2e,reinigung | bestehende Anbieter; kein automatischer Dienstwechsel; **offen** |
| F023 | **Erkennungsdialog**: Dokumentwahl; offline/KI/selbst setzen; Fortschritt und Fehler | `assets/app.js:1717` `erkennenDialog` | e2e,sprache | Webkern unverändert; **offen** |
| F024 | **Vorschläge**: Orange bis geprüft; einzeln Passt, alle bestätigen; ungeprüfte beim Export nennen | `assets/app.js:1512` `zeichneBand` | e2e | Webkern unverändert; **offen** |
| F025 | **Feldposition**: Bewegen und Größe ändern, Prozent der angezeigten Seite, CropBox/Drehmatrix | `assets/app.js:1465` `ziehen` | e2e,layout | Pointer/Stift/Touch prüfen; **offen** |
| F026 | **Feldeigenschaften**: Bezeichnung, Art, vorbelegter Inhalt, Mehrzeiligkeit, Kopie, Löschen | `assets/app.js:1524` `zeichneFuss` | e2e,sprache | passende Systemtastaturen; **offen** |
| F027 | **Ausfüllen**: Text, Datum, Kästchen, E-Mail, Telefon, URL, Kunden-/Artikelnummer, QR, Unterschrift | `assets/app.js:1361` `feldElement` | e2e,behoerde | Tastatur/Kalender/Stift prüfen; **offen** |
| F028 | **Felder setzen**: Alle zehn Feldarten; Positionstipp; Abbrechen | `assets/app.js:1497` `platzierenStart` | e2e | Webkern unverändert; **offen** |
| F029 | **Unterschrift**: Zeichnen mit Finger/Stift, leeren, übernehmen, transparentes PNG zuschneiden | `assets/app.js:1574` `unterschreiben` | e2e,zuschneiden | echter Stift/Touch; **offen** |
| F030 | **Links**: Mail/Browser/Telefon; Zahlen in Text kein Anruf; Ändern über Stift | `assets/app.js:1409` `linkZiel` | e2e | native externe Links; kein ungefragtes Senden; **offen** |
| F031 | **Kunden-/Artikelnummer**: Dokumente mit gleicher Nummer; optionale WF_KUNDE_OEFFNEN/WF_ARTIKEL_OEFFNEN | `assets/app.js:1451` `nummerOeffnen` | e2e | keine neue Kundenverwaltung; vorhandene Hooks erhalten; **offen** |
| F032 | **Erkannter Text**: Textansicht und Übernahme vorhandener Erkennung | `assets/app.js:1621` `erkannterText` | e2e,sprache | Webkern unverändert; **offen** |
| F033 | **Zoom**: Minus/Plus, Seiten neu rendern; nur Breitenänderung triggert Resize | `assets/app.js:1344` `zoom` | e2e,schieber | Bildschirmtastatur/Fensterwechsel prüfen; **offen** |
| F034 | **Seiten anhängen**: PDF/Bilder oder Scanner; bestehende Feldlagen bleiben | `assets/app.js:1631` `seiteDialog` | e2e | Dateiauswahl/Kameraadapter; **offen** |
| F035 | **Editor-Zuschnitt**: Scanner pro Seite, zweite Dokumentkopie, Original unverändert; Abbruch ohne Änderung | `assets/app.js:1676` `seiteZuschneiden` | zuschneiden | Webkern; Dateispeicher; Verlust Textebene als bestehende Grenze; **offen** |
| F036 | **Autospeichern**: IndexedDB, Debounce, pagehide/visibilitychange, Fehlerhinweis | `assets/app.js:1309` `speichernJetzt` | e2e | Prozessende/Neustart und Updates prüfen; **offen** |
| F037 | **Arbeitsstand exportieren**: PDF und Felder samt Entfernungsvermerk in .workfloh.json | `assets/app.js:1100` `standDatei` | e2e,reinigung | nativer Speichern-/Teilen-Adapter; **offen** |
| F038 | **Arbeitsstand importieren**: Wieder öffnen; fremden Prüfbefund nicht glauben | `assets/app.js:1104` `staendeEinlesen` | eingang | Dateiauswahl; kompatibles Format erhalten; **offen** |
| F039 | **Festes PDF**: Werte in Seite einzeichnen; Unicode mit vollständiger Schrift, QR/Unterschrift als Bild | `assets/app.js:1932` `ausgabeBytes` | e2e,schrift,behoerde | native Datei-Ausgabe; **offen** |
| F040 | **Ausfüllbares PDF**: Echte Widgets vorbelegt, Positionen/Drehung/Transparenz erhalten | `assets/app.js:1997` `exportDialog` | e2e,schrift,behoerde | native Datei-Ausgabe; **offen** |
| F041 | **Leere Vorlage**: Formularfelder ohne Werte, Warnung zu Vorschlägen | `assets/app.js:1997` `exportDialog` | e2e | native Datei-Ausgabe; **offen** |
| F042 | **HTML-Ausgabe**: Eigenständige Datei mit Seitenbildern und echten Eingaben; Warnung ohne Felder | `assets/html-export.js:10` `htmlFormular` | e2e | Speichern/Öffnen/Drucken testen; **offen** |
| F043 | **Ansehen/Drucken**: Festes PDF öffnen, Download bei blockiertem Fenster | `assets/app.js:1997` `exportDialog` | e2e | nativer PDF-Viewer/Druckadapter; **offen** |
| F044 | **Originalausgabe**: Unverändertes Original pro Dokument im Ordnerexport | `assets/app.js:1944` `ordnerAusgabe` | ordner | nativer Export; **offen** |
| F045 | **Ordner ZIP**: Fest/ausfüllbar/Vorlage/Original; UTF-8, doppelte Namen nummerieren | `assets/app.js:1944` `ordnerAusgabe` | ordner | Speichern/Teilen; **offen** |
| F046 | **Ordner Einzeldateien**: Alle Dateien teilen nach frischem Tipp | `assets/app.js:1944` `ordnerAusgabe` | ordner | native Mehrfachfreigabe; **offen** |
| F047 | **Ordner zusammenfügen**: Sortierte Dokumente als ein PDF, Felder fest | `assets/app.js:1944` `ordnerAusgabe` | ordner | nativer Export; **offen** |
| F048 | **Schnell teilen**: Karte/Editor/Auswahl; mit Einträgen fest, sonst Original; frischer Tipp/ZIP-Rückfall | `assets/app.js:775` `teilenDocs` | teilen | nativer Share-Adapter mit Abbruch-/Fehlerwegen; **offen** |
| F049 | **Scanner öffnen**: Bibliothek, Übersetzung und Anhängen verwenden denselben Scanner | `assets/scanner.js:276` `oeffnen` | scan | Kamera und Galerie; getrennte Berechtigungen; **offen** |
| F050 | **Scanner verwerfen**: Rückfrage bei aufgenommenen Seiten; Schließen/Listener beenden | `assets/scanner.js:276` `oeffnen` | scan | System-Zurück und Berechtigungsabbruch; **offen** |
| F051 | **Foto einlesen**: Fotos verkleinern bis 2400 px; nicht wegen Größe abweisen | `assets/scanner.js:43` `fotoLesen` | scan | Kameraformat/EXIF-Orientierung prüfen; **offen** |
| F052 | **Blatt finden**: Scanic ML + Scanic Kanten + Blatt; Unsicherheit statt still schneiden | `assets/scanner.js:67` `erkennen` | scan | lokale WASM/Worker/Modell-Ressourcen; **offen** |
| F053 | **Ecken und Lupe**: Vier Eckpunkte, kleine Lupe seitlich, automatisch/ganzes Foto | `assets/scanner.js:390` `zeichneZuschnitt` | scan | Stift/Touch/DeX, Hoch-/Querformat; **offen** |
| F054 | **Perspektive und Größe**: Automatisch/Original/A4/A5/A6/US Letter; erkannte Wahl nennen | `assets/scanner.js:638` `formatIst` | scan | Webkern unverändert; **offen** |
| F055 | **Drehen**: Links/rechts; OCR und Zeilenänderungen nach Geometrieänderung verwerfen | `assets/scanner.js:539` `zeichneWerkzeug` | scan | Webkern unverändert; **offen** |
| F056 | **Filter**: Original/Farbe/Grau/Dokument/Schwarzweiß; Schattenkorrektur | `assets/scanner.js:539` `zeichneWerkzeug` | scan | Webkern unverändert; **offen** |
| F057 | **Bildregler**: Helligkeit/Kontrast/Schärfe; auf alle Seiten anwenden | `assets/scanner.js:539` `zeichneWerkzeug` | scan | Webkern unverändert; **offen** |
| F058 | **Scannerseiten**: Wählen, vor/zurück sortieren, hinzufügen, entfernen | `assets/scanner.js:622` `zeichneLeiste` | scan | Webkern unverändert; **offen** |
| F059 | **OCR**: DE/EN/RU lokal, Fortschritt, unsichere Zeilen, Fehler | `assets/scanner.js:188` `ocrSeite` | scan | Tesseract Worker/WASM/Sprachdateien lokal; **offen** |
| F060 | **Zeilen ändern**: Text, leere Zeile entfernen, Grundlinie, Ausrichtung, Größe 40–300 %, Zurücksetzen/Abbruch | `assets/scanner.js:483` `zeileAendern` | scan | Touch/Stift/Tastatur prüfen; **offen** |
| F061 | **Original/Kopie**: Original/Nebeneinander/Kopie; Zeile in beiden markieren, Kopie verschieben | `assets/scanner.js:440` `zeichneErgebnis` | scan | Webkern unverändert; **offen** |
| F062 | **Scanner-PDF-Auswahl**: Pro Seite Foto oder echte Textkopie; Bilder/Stempel fehlen in Textkopie | `assets/scanner.js:539` `zeichneWerkzeug` | scan | Webkern unverändert; **offen** |
| F063 | **Erneut erkennen**: 300 dpi, Warnung vor Verlust der Zeilenänderungen | `assets/scanner.js:539` `zeichneWerkzeug` | scan | Webkern unverändert; **offen** |
| F064 | **Neu fotografieren**: Ersetzt genau diese Seite; Abbruch hebt Ersetzen auf | `assets/scanner.js:539` `zeichneWerkzeug` | scan | Kameraadapter; **offen** |
| F065 | **ChatGPT-Bild hin**: 300-dpi-Seitenbild + Auftrag teilen, Zwischenablage; Speichern/Browser als Rückfall | `assets/scanner.js:523` `zuChatGPT` | scan | Share/Clipboard/externer Browser; freiwilliger externer Dienst; **offen** |
| F066 | **ChatGPT-Bild zurück**: Ergebnisbild als neue Seite direkt dahinter; ganzes Bild, eigene Auflösung | `assets/scanner.js:328` `hinzu` | scan | Systembildauswahl; kein echter ChatGPT-Lauf nachgewiesen; **offen** |
| F067 | **Textmaske**: Transparentes PNG aus Textkopie | `assets/scanner.js:539` `zeichneWerkzeug` | scan | nativer PNG-Export; **offen** |
| F068 | **Scanner Qualität**: Name, DPI/JPEG-Qualität, durchsuchbar; gemerkte Einstellungen | `assets/scanner.js:645` `zeichneFuss` | scan | Webkern/Storage; **offen** |
| F069 | **Scanner PDF**: Mehrseitig, optional OCR-Textebene, Noto vollständig eingebettet | `assets/scanner.js:225` `pdfBauen` | scan,schrift | lokaler PDF-Kern; **offen** |
| F070 | **Scanner Ablage**: Herunterladen/Teilen/Fertig auch Bibliothek; wiederholte Ablage ersetzt dasselbe Dokument | `assets/scanner.js:645` `zeichneFuss` | scan | nativer Export und IndexedDB; **offen** |
| F071 | **Scanner Bilder-ZIP**: Seiten als JPEG in Reihenfolge; keine Bibliotheksablage | `assets/scanner.js:645` `zeichneFuss` | scan | nativer ZIP-Export; **offen** |
| F072 | **Scanner Unsicherheit**: Fertig fragt bei ungeprüften Ecken; Fehler ehrlich melden | `assets/scanner.js:645` `zeichneFuss` | scan | Webkern unverändert; **offen** |
| F073 | **Übersetzungsbereich**: Ordner/Dateien/Fotos/Beispiele; eigene Ergebnisordner und Originalverknüpfung | `assets/app.js:2081` `uebersetzenStart` | uebersetzung,chrome | Dateiauswahl/Kamera; **offen** |
| F074 | **Sprachrichtungen**: DE→RU, RU→DE, DE→EN, EN→DE, RU→EN, EN→RU; Dokumentwahl | `assets/app.js:2333` `uebersetzenDialog` | uebersetzung | Translator-Verfügbarkeit je Paar am Zielgerät; **offen** |
| F075 | **Browserübersetzer**: Translator, Modellfortschritt, einmal neu starten, Satzzerlegung; kein Retry bei Abbruch/429 | `assets/uebersetzung.js:382` `browserUebersetzer` | teile,uebersetzung | WebView-API messen; Alternative nur nach Entscheidung; **offen** |
| F076 | **Chromeübersetzer**: Reinigen, Textfläche, Chrome-Menü, DOM-Ergebnis, Schriftprüfung; keine Gegenprobe | `assets/uebersetzung.js:459` `chromeUebersetzer` | chrome,reinigung | sicherer Hin-/Rücktransport erforderlich; Entscheidung offen; **offen** |
| F077 | **Chrome öffnen/teilen**: Android/DeX sofort teilen, sonst öffnen/kopieren; Abbruch sendet nichts | `assets/app.js:2191` `inChromeOeffnen` | chrome,behoerde | getrennte Datenspeicher; URL mit IDs allein reicht nicht; **offen** |
| F078 | **Chrome Rückweg**: Übersetzung oder Einträge rückübertragen; fehlendes Dokument melden | `assets/app.js:2241` `chromeTabRueckweg` | chrome,behoerde | authentisierter lokaler Transport zu entwickeln und praktisch prüfen; **offen** |
| F079 | **KI-Übersetzung**: Mistral/Anthropic/OpenAI BYOK, Freigabe je Anbieter, Kontingent/Netz/Antwortfehler | `assets/uebersetzung.js:568` `kiUebersetzer` | uebersetzung,teile,reinigung | bestehende Anbieter behalten; kein neuer Dienst beschlossen; **offen** |
| F080 | **Layout Übersetzung**: Blocklage/Farbe/Seiten/Bilder; NFC, Kyrillisch, Kreissymbole, gedrehte/CropBox-Seiten | `assets/uebersetzung.js:823` `pdfBauen` | layout,kreis,schrift | Webkern unverändert; **offen** |
| F081 | **Bildtext optional**: Digitale Seiten: Bildtext nur opt-in; Scans weiterhin OCR; Filter gegen Scheinerkennung | `assets/uebersetzung.js:336` `bildZeileTaugt` | bilder | lokale OCR; **offen** |
| F082 | **Übersetzungsfortschritt**: Seite für Seite speichern, Abbruch/Fortsetzen, Fehler und sichtbares Teil-PDF | `assets/app.js:2554` `uebersetzeViele` | uebersetzung,teile | Prozessneustart und Modell-/Netzunterbrechung prüfen; **offen** |
| F083 | **Originalauflösung**: Übersetzung nie weiterübersetzen; Original suchen; fehlt es, ehrlich melden | `assets/app.js:2263` `originalVon` | chrome | Webkern unverändert; **offen** |
| F084 | **Ergebnisordner**: Stammordner verfolgen; Umbenennen ohne Verlust der Verknüpfung | `assets/app.js:2069` `ergebnisOrdner` | chrome | Webkern unverändert; **offen** |
| F085 | **Große Dokumente**: Teilplan ab 41 Seiten/8 MB, veränderliche Grenzen; echte Teil-PDFs, keine Duplikate | `assets/app.js:2305` `teileAnlegen` | teile | Webkern; Speicher am Zielgerät messen; **offen** |
| F086 | **Gegenprobe**: Gespeicherte Übersetzung rückübersetzen, eigenes PDF; nicht Originaltext neu lesen | `assets/uebersetzung.js:779` `rueck` | uebersetzung | nur vorhandene geeignete Wege; Chrome ausgeschlossen; **offen** |
| F087 | **Formulare übersetzen**: Geprüfte Felder/Labels/Textwerte, feste Sondertypen unverändert, quellFeld | `assets/app.js:2445` `felderUebersetzen` | behoerde | Webkern unverändert; **offen** |
| F088 | **Einträge ins Original**: Kopie des Originals; Werte zurückübersetzen, Original nie überschreiben | `assets/app.js:2496` `rueckwegLaufen` | behoerde | Chrome-Rücktransport ist Entscheidungspunkt; **offen** |
| F089 | **Gerät messen**: Translator und sechs Sprachpaare, Textebene, Speicher anzeigen | `assets/app.js:2532` `messen` | uebersetzung | echtes Zielgerät fehlt; **offen** |
| F090 | **Wortsuche**: Namen/Ordner/Felder/Seitentext, UND, Umlaute/Nummern/Datumsangleichung | `assets/suche.js:100` `sucheDok` | suche | Webkern unverändert; **offen** |
| F091 | **Suchindex**: Ältere PDFs nachholen, fehlenden Index anzeigen, bei Dateiersatz löschen | `assets/app.js:605` `texteNachholen` | suche | lokaler Speicher/Neustart; **offen** |
| F092 | **Suchfundstellen**: Trefferzahlen, Markierungen, n/m, vor/zurück, Tipp entfernt Markierung | `assets/app.js:1245` `imDokSuchen` | suche | Webkern unverändert; **offen** |
| F093 | **Bedeutung einschalten**: Freiwilliger Modelldownload, Fortschritt, Fehler/nochmal/aus | `assets/app.js:379` `bedeutungDialog` | bedeutung | Netz/Modelldownload separat prüfen; **offen** |
| F094 | **Bedeutungsindex**: Satzabschnitte, Vektorblöcke 64, Signatur, Wiederaufnahme, Suche während Einordnung | `assets/app.js:451` `vektorenNachholen` | bedeutung | Modell/WebView/WASM/Speicher praktisch messen; **offen** |
| F095 | **Bedeutungstreffer**: Keine doppelten Worttreffer, schwache Treffer markieren, passende Stelle | `assets/app.js:545` `bedeutungZusatz` | bedeutung | echte Modellqualität ist eigener Nachweis; **offen** |
| F096 | **Spracheingabe**: Laufender Text/Balken, Stopp/2,6 s Pause, danach Suche; Balken kein Pegel | `assets/app.js:2684` `spracheingabe` | sprechen | native Erkennung braucht Rücksprache zu Anbieter/Offlineverhalten; **offen** |
| F097 | **Prüfung starten**: Manuell Karte/Editor; normale Importe ungeprüft, zwei Hilfebeispiele automatisch | `assets/app.js:996` `pruefungNachholen` | eingang | Prüfkern bytegleich, kein zusätzlicher Virenscanner; **offen** |
| F098 | **Prüfkern**: PDF/Bild/OCR/versteckte Anweisungen/Tarnungen/Anhänge; feste Muster, keine Virenprüfung | `assets/eingang.js:97` `pruefen` | eingang | lokale Bibliotheken/Worker/Sprachdateien; **offen** |
| F099 | **Prüfstatus**: Offen/läuft/Warnung/sauber/unvollständig; fehlender Kern niemals sauber | `assets/app.js:1009` `pruefMarke` | eingang | Webkern unverändert; **offen** |
| F100 | **Prüfbericht**: Funde, Stellen/markierte Kopien, Handlungshinweis, Angaben, Herkunft, Entfernungsvermerk | `assets/app.js:1062` `pruefDialog` | eingang,reinigung | lokale Anzeige; **offen** |
| F101 | **Bericht exportieren**: UTF-8 mit BOM, vollständige Abschnitte, keine Virenprüfung | `assets/app.js:1031` `pruefBerichtText` | eingang | nativer Textdatei-Export; **offen** |
| F102 | **Herkunft C2PA**: PDF/JPEG/PNG/WebP; Herkunft kein Gefahrenfund; Signatur nicht nachgerechnet | `assets/eingang.js:97` `pruefen` | eingang | gepinnten Prüfkern unverändert übernehmen; **offen** |
| F103 | **Originalfoto**: Ungeprüftes Foto behalten, nach Prüfung löschen, bei Löschen/Ersetzen mitnehmen | `assets/app.js:909` `neuesDok` | eingang,sicherung | lokaler Speicher und Lebenszyklus; **offen** |
| F104 | **Reinigung Übersetzung**: Vor KI und Chrome versteckten Text aus Sendefassung entfernen; Original unverändert | `assets/app.js:73` `kiReiniger` | reinigung | vor Transport durchführen; **offen** |
| F105 | **Reinigung KI-Bild**: Blassen/versteckten Text zudecken, JPEG-Metadaten entfernen; ICC/Adobe behalten | `assets/app.js:1816` `kiSeitenBild` | reinigung | lokaler Canvas-Kern; **offen** |
| F106 | **Sende-Rückfrage**: Einmal pro Vorgang; Ohne ihn senden/Abbrechen; Abbruch sendet und vermerkt nichts | `assets/app.js:73` `kiReiniger` | reinigung | alle nativen Transportwege einbeziehen; **offen** |
| F107 | **Entfernungsvermerk**: Weg/Seite/Text/Grund/Zeit; DB, Arbeitsstand, Sicherung, Bericht; Grenzen erhalten | `assets/app.js:1056` `kiEntferntHtml` | reinigung,sicherung | kompatible Datenformate; **offen** |
| F108 | **Verschlüsselt sichern**: Bestehendes Format Fassung 1, Passwort zweimal/min. 8; kein Schlüssel/keine Einstellungen | `assets/sicherung.js:79` `verschliessen` | sicherung | Dateispeichern; Tresor gepinnt unverändert; **offen** |
| F109 | **Wiederherstellen**: Nur hinzufügen; alte Sicherung, fehlende Ordner/Dateien, falsches Passwort/Format melden | `assets/sicherung.js:98` `zusammenfuehren` | sicherung | Systemauswahl; PWA-Datenmigration per Sicherung/Arbeitsstand; **offen** |
| F110 | **Originale sichern**: Ungeprüfte Originalfotos und Entfernungsvermerke mitnehmen | `assets/sicherung.js:57` `inhaltBauen` | sicherung,reinigung | kompatibles Sicherungsformat; **offen** |
| F111 | **Sicherung erinnern**: Eigene Dokumente, 14 Tage, Später für Sitzung | `assets/app.js:2728` `sicherungErinnerung` | sicherung | Webkern/Storage; **offen** |
| F112 | **Dauerspeicher**: ja/nein/unbekannt ehrlich, anfordern, Belegung anzeigen | `assets/app.js:2720` `dauerStand` | sicherung | native Aufbewahrung/Backups unterscheiden; **offen** |
| F113 | **App-Sprachen**: DE/EN/RU/AR/RTL, Benutzernamen nie übersetzen, Auswahl offline gespeichert | `assets/sprache.js:91` `T` | sprache | Webkern unverändert; **offen** |
| F114 | **Tooltips/Barrierefreiheit**: Hinweise an/aus, aria/placeholder/title, reduzierte Bewegung | `assets/app.js:2662` `spracheWaehlen` | sprache,bibliothek | Screenreader/Tastatur/Touch am Zielgerät; **offen** |
| F115 | **Einstellungen**: Anbieter/Schlüssel/Erkennungs- und Übersetzungsmodell, Verbindungstest, Linien, Sprache, Speicher | `assets/app.js:2803` `einstellungen` | sprache,e2e | bestehende BYOK-Speicherung; Änderung nur nach Rücksprache; **offen** |
| F116 | **Installation/Aktualisieren**: PWA-Angebot/Anleitung, als installiert verborgen; Hard-Reload erhält Dokumente | `assets/app.js:2850` `installHinweis` | manifest-id,bibliothek | reguläre native Version/Updateadapter; PWA-Cachefunktionen nicht verlieren; **offen** |
| F117 | **Hilfe/Beispiele**: Handbuch, Amtsformular, zwei Schutzbeispiele, Videos, Webseite | `assets/app.js:2959` `hilfe` | beispiele,eingang | öffentliche Ressourcen lokal bündeln; externe Links gezielt öffnen; **offen** |
| F118 | **Erklärvideos**: DE/EN/RU, AR→EN-Hinweis; zwei Filme/Kapitel, Lagewechsel gleiche Zeit, Ende→Schutzfilm | `assets/app.js:2884` `erklaervideo` | video | Online/Range-Antworten, tatsächliche Wiedergabe prüfen; **offen** |
| F119 | **W-Floh/Design**: Maskottchen, flache Knöpfe, kleine Ansichten/DeX, rollende Leisten | `assets/app.js:51` `hops` | bibliothek,schieber,scan | echte Fenster-/Tastatur-/Lagewechsel prüfen; **offen** |
| F120 | **Mycel/SBKIM**: Kanon-Reihenfolge, Lampen/Siegel/Blase/Gerätename; kein Netz vor Tipp | `assets/sbkim-init.js:1` | knoten | WebSocket/WebCrypto/Identität lokal prüfen; **offen** |
| F121 | **Netzwahl**: Öffentlich/eigenes Netz, Beitrittslink, Geräte-/Netzspeicher, Membran allowedOrigins leer | `assets/sbkim-init.js:1` | knoten | Deep-Link/Relaisadapter; keine fremden Schlüssel übernehmen; **offen** |
| F122 | **Lizenzen/Datenschutz**: LICENSE, RECHTE, THIRD_PARTY, impressum und Sicherheitshilfe erhalten | `assets/app.js:2959` `hilfe` | schieber | native Hosting-/Adapterangaben nach gewähltem Weg ergänzen; **offen** |

## Bestehende Grenzen und Widersprüche

- Normale Importe werden manuell geprüft; ältere Hilfetexte behaupten noch automatische
  Prüfung. Zwei Schutzbeispiele sind die Ausnahme. Kein Virenscanner und kein
  allgemeines Versprechen einer Schadsoftwareerkennung.
- Lernen aus geöffneten Bedeutungstreffern ist laut vollständiger CLAUDE.md noch
  nicht gebaut. Es wird nicht als vorhandene Funktion ausgegeben und nicht heimlich ergänzt.
- Chrome hat keine automatische Gegenprobe. Translator und KI sind getrennte Wege.
- THIRD_PARTY.md nennt noch Schrift-Teilmenge; aktueller Code/CLAUDE.md und
  Schriftprüfung verlangen `subset: false`. Keine Schriften optimieren/ersetzen.
- HTML/PDF-Ausgaben, Übersetzungsabdeckung (Originaltext bleibt darunter),
  verlorene Textebene nach Editor-Zuschnitt und fehlende Export-Link-Anmerkungen
  sind bestehende Grenzen. Verbesserungen wären separate Entscheidungen.
- API-Schlüssel bleiben bisher unverschlüsselt in localStorage. Nicht als nativen
  Schlüsseltresor bezeichnen. Der gepinnte Tresor schützt Sicherungsdateien.
- Keine native Abnahme, Gerätemessung oder reguläre Auslieferung erfolgt.
