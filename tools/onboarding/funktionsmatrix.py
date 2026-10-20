from pathlib import Path
import re
src=Path('/workspace/Workflow-PDF'); out=Path('/workspace/Workflow-PDF-Pro/docs/portierung')
# Funktion | Verhalten | Tests | native Anbindung (keine Umsetzung beschlossen)
rows='''
Bibliothek|app.js:zeichneBibliothek|Alle, Ohne Ordner, eigene und Übersetzungsordner; Dokumentzahlen und leere Zustände|bibliothek,ordner,sprache|lokaler Webkern/IndexedDB
Dateien importieren|app.js:importDateien|PDF, Bild, mehrere Dateien, Arbeitsstand; Dateifehler einzeln melden|e2e,eingang|System-Dateiauswahl und content-URI lesen
Ordner importieren|app.js:importDateien|Ganzen Ordner einlesen, natürliche Dateireihenfolge, Ordnername|ordner|nativer Ordnerwähler; Freigaben und Wiederwahl prüfen
Drag-and-drop|app.js:start|Dateien in Bibliothek ziehen|e2e|WebView/Desktop-Dateiübergabe prüfen
Teilen empfangen|app.js:geteiltUebernehmen|Worker-POST, Übernahmespeicher leeren, keine/leere/fehlerhafte Dateien melden|teilen-empfang|Android SEND/SEND_MULTIPLE und iOS-Share-Erweiterung gesondert
Öffnen mit|app.js:oeffnenMitEmpfangen|launchQueue-Dateien lesen, PDF/Bilder übernehmen|teilen-empfang|native Dateizuordnung und Neustart-/Warmstart-Übergabe
Ordner anlegen|app.js:neuerOrdner|Name abfragen; Abbruch ohne Anlage|ordner,sprache|Webkern unverändert
Ordner umbenennen|app.js:zeichneBibliothek|Abgeleitete Namen ziehen mit; selbst umbenannte bleiben|chrome,ordner|Webkern unverändert
Ordner löschen|app.js:zeichneBibliothek|Rückfrage; Dokumente bleiben unter Ohne Ordner|ordner|Webkern unverändert
Verschieben|app.js:verschieben|Ein oder mehrere Dokumente in vorhandenen/neuen Ordner|teilen|Webkern unverändert
Duplikat/Vorlage|app.js:duplizieren|Dokumentkopie mit eigenen Kennungen|e2e|Webkern unverändert
Dokument löschen|app.js:loeschen|Rückfrage; Datei, Seitentext, Vektoren und Originalfoto entfernen|eingang,teilen|Webkern unverändert
Mehrfachlöschen|app.js:loeschenMehrere|Eine Rückfrage mit Namen/Anzahl; Auswahl aufheben|teilen|Webkern unverändert
Auswahl|app.js:wahlLeiste|Kästchen, langer Druck, Alle, Teilen, Verschieben, Löschen, Fertig|teilen|Touch/Maus/DeX prüfen
Ziehen mit Verweilen|app.js:ziehenBinden|450 ms Langdruck, 250 ms Verweilen, Autoscroll, Schattenbild, neue Ordner|teilen|echte Touch-/DeX-Prüfung
Nach oben|app.js:ganzNachOben|Kartenpfeil nach Scrollen|bibliothek|Touch/Maus prüfen
Sortieren|app.js:sortiere|Name natürlich, Änderung, Größe, Seiten, Erstellung; Suche nach Trefferstärke|ordner,bibliothek|Webkern unverändert
Erstellungszeitraum|app.js:zeichneBibliothek|Von/bis einschließlich, widersprüchliche Enden korrigieren, Rücksetzen|bibliothek|Systemkalender prüfen
Öffnen/Benennen|app.js:oeffneDok|PDF rendern; Namen ändern, zurück zur Bibliothek|e2e|Webkern/Dateispeicher; System-Zurück
Vorhandene Formularfelder|app.js:vorhandeneFelder|AcroForm-Felder und Werte importieren|e2e|Webkern unverändert
Offline-Erkennung|app.js:erkenneDok|Linien, Rahmen, Kästchen, graue Flächen, Beschriftung; Rahmen um mehrere Felder kein Feld|e2e,beispiele|lokaler PDF-/Canvas-Kern
KI-Erkennung|app.js:kiSeitenBild|Freiwillig BYOK, nummerierte Kandidaten, Bildreinigung, Einwilligung, Abbruch|e2e,reinigung|bestehende Anbieter; kein automatischer Dienstwechsel
Erkennungsdialog|app.js:erkennenDialog|Dokumentwahl; offline/KI/selbst setzen; Fortschritt und Fehler|e2e,sprache|Webkern unverändert
Vorschläge|app.js:zeichneBand|Orange bis geprüft; einzeln Passt, alle bestätigen; ungeprüfte beim Export nennen|e2e|Webkern unverändert
Feldposition|app.js:ziehen|Bewegen und Größe ändern, Prozent der angezeigten Seite, CropBox/Drehmatrix|e2e,layout|Pointer/Stift/Touch prüfen
Feldeigenschaften|app.js:zeichneFuss|Bezeichnung, Art, vorbelegter Inhalt, Mehrzeiligkeit, Kopie, Löschen|e2e,sprache|passende Systemtastaturen
Ausfüllen|app.js:feldElement|Text, Datum, Kästchen, E-Mail, Telefon, URL, Kunden-/Artikelnummer, QR, Unterschrift|e2e,behoerde|Tastatur/Kalender/Stift prüfen
Felder setzen|app.js:platzierenStart|Alle zehn Feldarten; Positionstipp; Abbrechen|e2e|Webkern unverändert
Unterschrift|app.js:unterschreiben|Zeichnen mit Finger/Stift, leeren, übernehmen, transparentes PNG zuschneiden|e2e,zuschneiden|echter Stift/Touch
Links|app.js:linkZiel|Mail/Browser/Telefon; Zahlen in Text kein Anruf; Ändern über Stift|e2e|native externe Links; kein ungefragtes Senden
Kunden-/Artikelnummer|app.js:nummerOeffnen|Dokumente mit gleicher Nummer; optionale WF_KUNDE_OEFFNEN/WF_ARTIKEL_OEFFNEN|e2e|keine neue Kundenverwaltung; vorhandene Hooks erhalten
Erkannter Text|app.js:erkannterText|Textansicht und Übernahme vorhandener Erkennung|e2e,sprache|Webkern unverändert
Zoom|app.js:zoom|Minus/Plus, Seiten neu rendern; nur Breitenänderung triggert Resize|e2e,schieber|Bildschirmtastatur/Fensterwechsel prüfen
Seiten anhängen|app.js:seiteDialog|PDF/Bilder oder Scanner; bestehende Feldlagen bleiben|e2e|Dateiauswahl/Kameraadapter
Editor-Zuschnitt|app.js:seiteZuschneiden|Scanner pro Seite, zweite Dokumentkopie, Original unverändert; Abbruch ohne Änderung|zuschneiden|Webkern; Dateispeicher; Verlust Textebene als bestehende Grenze
Autospeichern|app.js:speichernJetzt|IndexedDB, Debounce, pagehide/visibilitychange, Fehlerhinweis|e2e|Prozessende/Neustart und Updates prüfen
Arbeitsstand exportieren|app.js:standDatei|PDF und Felder samt Entfernungsvermerk in .workfloh.json|e2e,reinigung|nativer Speichern-/Teilen-Adapter
Arbeitsstand importieren|app.js:staendeEinlesen|Wieder öffnen; fremden Prüfbefund nicht glauben|eingang|Dateiauswahl; kompatibles Format erhalten
Festes PDF|app.js:ausgabeBytes|Werte in Seite einzeichnen; Unicode mit vollständiger Schrift, QR/Unterschrift als Bild|e2e,schrift,behoerde|native Datei-Ausgabe
Ausfüllbares PDF|app.js:exportDialog|Echte Widgets vorbelegt, Positionen/Drehung/Transparenz erhalten|e2e,schrift,behoerde|native Datei-Ausgabe
Leere Vorlage|app.js:exportDialog|Formularfelder ohne Werte, Warnung zu Vorschlägen|e2e|native Datei-Ausgabe
HTML-Ausgabe|html-export.js:htmlFormular|Eigenständige Datei mit Seitenbildern und echten Eingaben; Warnung ohne Felder|e2e|Speichern/Öffnen/Drucken testen
Ansehen/Drucken|app.js:exportDialog|Festes PDF öffnen, Download bei blockiertem Fenster|e2e|nativer PDF-Viewer/Druckadapter
Originalausgabe|app.js:ordnerAusgabe|Unverändertes Original pro Dokument im Ordnerexport|ordner|nativer Export
Ordner ZIP|app.js:ordnerAusgabe|Fest/ausfüllbar/Vorlage/Original; UTF-8, doppelte Namen nummerieren|ordner|Speichern/Teilen
Ordner Einzeldateien|app.js:ordnerAusgabe|Alle Dateien teilen nach frischem Tipp|ordner|native Mehrfachfreigabe
Ordner zusammenfügen|app.js:ordnerAusgabe|Sortierte Dokumente als ein PDF, Felder fest|ordner|nativer Export
Schnell teilen|app.js:teilenDocs|Karte/Editor/Auswahl; mit Einträgen fest, sonst Original; frischer Tipp/ZIP-Rückfall|teilen|nativer Share-Adapter mit Abbruch-/Fehlerwegen
Scanner öffnen|scanner.js:oeffnen|Bibliothek, Übersetzung und Anhängen verwenden denselben Scanner|scan|Kamera und Galerie; getrennte Berechtigungen
Scanner verwerfen|scanner.js:oeffnen|Rückfrage bei aufgenommenen Seiten; Schließen/Listener beenden|scan|System-Zurück und Berechtigungsabbruch
Foto einlesen|scanner.js:fotoLesen|Fotos verkleinern bis 2400 px; nicht wegen Größe abweisen|scan|Kameraformat/EXIF-Orientierung prüfen
Blatt finden|scanner.js:erkennen|Scanic ML + Scanic Kanten + Blatt; Unsicherheit statt still schneiden|scan|lokale WASM/Worker/Modell-Ressourcen
Ecken und Lupe|scanner.js:zeichneZuschnitt|Vier Eckpunkte, kleine Lupe seitlich, automatisch/ganzes Foto|scan|Stift/Touch/DeX, Hoch-/Querformat
Perspektive und Größe|scanner.js:formatIst|Automatisch/Original/A4/A5/A6/US Letter; erkannte Wahl nennen|scan|Webkern unverändert
Drehen|scanner.js:zeichneWerkzeug|Links/rechts; OCR und Zeilenänderungen nach Geometrieänderung verwerfen|scan|Webkern unverändert
Filter|scanner.js:zeichneWerkzeug|Original/Farbe/Grau/Dokument/Schwarzweiß; Schattenkorrektur|scan|Webkern unverändert
Bildregler|scanner.js:zeichneWerkzeug|Helligkeit/Kontrast/Schärfe; auf alle Seiten anwenden|scan|Webkern unverändert
Scannerseiten|scanner.js:zeichneLeiste|Wählen, vor/zurück sortieren, hinzufügen, entfernen|scan|Webkern unverändert
OCR|scanner.js:ocrSeite|DE/EN/RU lokal, Fortschritt, unsichere Zeilen, Fehler|scan|Tesseract Worker/WASM/Sprachdateien lokal
Zeilen ändern|scanner.js:zeileAendern|Text, leere Zeile entfernen, Grundlinie, Ausrichtung, Größe 40–300 %, Zurücksetzen/Abbruch|scan|Touch/Stift/Tastatur prüfen
Original/Kopie|scanner.js:zeichneErgebnis|Original/Nebeneinander/Kopie; Zeile in beiden markieren, Kopie verschieben|scan|Webkern unverändert
Scanner-PDF-Auswahl|scanner.js:zeichneWerkzeug|Pro Seite Foto oder echte Textkopie; Bilder/Stempel fehlen in Textkopie|scan|Webkern unverändert
Erneut erkennen|scanner.js:zeichneWerkzeug|300 dpi, Warnung vor Verlust der Zeilenänderungen|scan|Webkern unverändert
Neu fotografieren|scanner.js:zeichneWerkzeug|Ersetzt genau diese Seite; Abbruch hebt Ersetzen auf|scan|Kameraadapter
ChatGPT-Bild hin|scanner.js:zuChatGPT|300-dpi-Seitenbild + Auftrag teilen, Zwischenablage; Speichern/Browser als Rückfall|scan|Share/Clipboard/externer Browser; freiwilliger externer Dienst
ChatGPT-Bild zurück|scanner.js:hinzu|Ergebnisbild als neue Seite direkt dahinter; ganzes Bild, eigene Auflösung|scan|Systembildauswahl; kein echter ChatGPT-Lauf nachgewiesen
Textmaske|scanner.js:zeichneWerkzeug|Transparentes PNG aus Textkopie|scan|nativer PNG-Export
Scanner Qualität|scanner.js:zeichneFuss|Name, DPI/JPEG-Qualität, durchsuchbar; gemerkte Einstellungen|scan|Webkern/Storage
Scanner PDF|scanner.js:pdfBauen|Mehrseitig, optional OCR-Textebene, Noto vollständig eingebettet|scan,schrift|lokaler PDF-Kern
Scanner Ablage|scanner.js:zeichneFuss|Herunterladen/Teilen/Fertig auch Bibliothek; wiederholte Ablage ersetzt dasselbe Dokument|scan|nativer Export und IndexedDB
Scanner Bilder-ZIP|scanner.js:zeichneFuss|Seiten als JPEG in Reihenfolge; keine Bibliotheksablage|scan|nativer ZIP-Export
Scanner Unsicherheit|scanner.js:zeichneFuss|Fertig fragt bei ungeprüften Ecken; Fehler ehrlich melden|scan|Webkern unverändert
Übersetzungsbereich|app.js:uebersetzenStart|Ordner/Dateien/Fotos/Beispiele; eigene Ergebnisordner und Originalverknüpfung|uebersetzung,chrome|Dateiauswahl/Kamera
Sprachrichtungen|app.js:uebersetzenDialog|DE→RU, RU→DE, DE→EN, EN→DE, RU→EN, EN→RU; Dokumentwahl|uebersetzung|Translator-Verfügbarkeit je Paar am Zielgerät
Browserübersetzer|uebersetzung.js:browserUebersetzer|Translator, Modellfortschritt, einmal neu starten, Satzzerlegung; kein Retry bei Abbruch/429|teile,uebersetzung|WebView-API messen; Alternative nur nach Entscheidung
Chromeübersetzer|uebersetzung.js:chromeUebersetzer|Reinigen, Textfläche, Chrome-Menü, DOM-Ergebnis, Schriftprüfung; keine Gegenprobe|chrome,reinigung|sicherer Hin-/Rücktransport erforderlich; Entscheidung offen
Chrome öffnen/teilen|app.js:inChromeOeffnen|Android/DeX sofort teilen, sonst öffnen/kopieren; Abbruch sendet nichts|chrome,behoerde|getrennte Datenspeicher; URL mit IDs allein reicht nicht
Chrome Rückweg|app.js:chromeTabRueckweg|Übersetzung oder Einträge rückübertragen; fehlendes Dokument melden|chrome,behoerde|authentisierter lokaler Transport zu entwickeln und praktisch prüfen
KI-Übersetzung|uebersetzung.js:kiUebersetzer|Mistral/Anthropic/OpenAI BYOK, Freigabe je Anbieter, Kontingent/Netz/Antwortfehler|uebersetzung,teile,reinigung|bestehende Anbieter behalten; kein neuer Dienst beschlossen
Layout Übersetzung|uebersetzung.js:pdfBauen|Blocklage/Farbe/Seiten/Bilder; NFC, Kyrillisch, Kreissymbole, gedrehte/CropBox-Seiten|layout,kreis,schrift|Webkern unverändert
Bildtext optional|uebersetzung.js:bildZeileTaugt|Digitale Seiten: Bildtext nur opt-in; Scans weiterhin OCR; Filter gegen Scheinerkennung|bilder|lokale OCR
Übersetzungsfortschritt|app.js:uebersetzeViele|Seite für Seite speichern, Abbruch/Fortsetzen, Fehler und sichtbares Teil-PDF|uebersetzung,teile|Prozessneustart und Modell-/Netzunterbrechung prüfen
Originalauflösung|app.js:originalVon|Übersetzung nie weiterübersetzen; Original suchen; fehlt es, ehrlich melden|chrome|Webkern unverändert
Ergebnisordner|app.js:ergebnisOrdner|Stammordner verfolgen; Umbenennen ohne Verlust der Verknüpfung|chrome|Webkern unverändert
Große Dokumente|app.js:teileAnlegen|Teilplan ab 41 Seiten/8 MB, veränderliche Grenzen; echte Teil-PDFs, keine Duplikate|teile|Webkern; Speicher am Zielgerät messen
Gegenprobe|uebersetzung.js:rueck|Gespeicherte Übersetzung rückübersetzen, eigenes PDF; nicht Originaltext neu lesen|uebersetzung|nur vorhandene geeignete Wege; Chrome ausgeschlossen
Formulare übersetzen|app.js:felderUebersetzen|Geprüfte Felder/Labels/Textwerte, feste Sondertypen unverändert, quellFeld|behoerde|Webkern unverändert
Einträge ins Original|app.js:rueckwegLaufen|Kopie des Originals; Werte zurückübersetzen, Original nie überschreiben|behoerde|Chrome-Rücktransport ist Entscheidungspunkt
Gerät messen|app.js:messen|Translator und sechs Sprachpaare, Textebene, Speicher anzeigen|uebersetzung|echtes Zielgerät fehlt
Wortsuche|suche.js:sucheDok|Namen/Ordner/Felder/Seitentext, UND, Umlaute/Nummern/Datumsangleichung|suche|Webkern unverändert
Suchindex|app.js:texteNachholen|Ältere PDFs nachholen, fehlenden Index anzeigen, bei Dateiersatz löschen|suche|lokaler Speicher/Neustart
Suchfundstellen|app.js:imDokSuchen|Trefferzahlen, Markierungen, n/m, vor/zurück, Tipp entfernt Markierung|suche|Webkern unverändert
Bedeutung einschalten|app.js:bedeutungDialog|Freiwilliger Modelldownload, Fortschritt, Fehler/nochmal/aus|bedeutung|Netz/Modelldownload separat prüfen
Bedeutungsindex|app.js:vektorenNachholen|Satzabschnitte, Vektorblöcke 64, Signatur, Wiederaufnahme, Suche während Einordnung|bedeutung|Modell/WebView/WASM/Speicher praktisch messen
Bedeutungstreffer|app.js:bedeutungZusatz|Keine doppelten Worttreffer, schwache Treffer markieren, passende Stelle|bedeutung|echte Modellqualität ist eigener Nachweis
Spracheingabe|app.js:spracheingabe|Laufender Text/Balken, Stopp/2,6 s Pause, danach Suche; Balken kein Pegel|sprechen|native Erkennung braucht Rücksprache zu Anbieter/Offlineverhalten
Prüfung starten|app.js:pruefungNachholen|Manuell Karte/Editor; normale Importe ungeprüft, zwei Hilfebeispiele automatisch|eingang|Prüfkern bytegleich, kein zusätzlicher Virenscanner
Prüfkern|eingang.js:pruefen|PDF/Bild/OCR/versteckte Anweisungen/Tarnungen/Anhänge; feste Muster, keine Virenprüfung|eingang|lokale Bibliotheken/Worker/Sprachdateien
Prüfstatus|app.js:pruefMarke|Offen/läuft/Warnung/sauber/unvollständig; fehlender Kern niemals sauber|eingang|Webkern unverändert
Prüfbericht|app.js:pruefDialog|Funde, Stellen/markierte Kopien, Handlungshinweis, Angaben, Herkunft, Entfernungsvermerk|eingang,reinigung|lokale Anzeige
Bericht exportieren|app.js:pruefBerichtText|UTF-8 mit BOM, vollständige Abschnitte, keine Virenprüfung|eingang|nativer Textdatei-Export
Herkunft C2PA|eingang.js:pruefen|PDF/JPEG/PNG/WebP; Herkunft kein Gefahrenfund; Signatur nicht nachgerechnet|eingang|gepinnten Prüfkern unverändert übernehmen
Originalfoto|app.js:neuesDok|Ungeprüftes Foto behalten, nach Prüfung löschen, bei Löschen/Ersetzen mitnehmen|eingang,sicherung|lokaler Speicher und Lebenszyklus
Reinigung Übersetzung|app.js:kiReiniger|Vor KI und Chrome versteckten Text aus Sendefassung entfernen; Original unverändert|reinigung|vor Transport durchführen
Reinigung KI-Bild|app.js:kiSeitenBild|Blassen/versteckten Text zudecken, JPEG-Metadaten entfernen; ICC/Adobe behalten|reinigung|lokaler Canvas-Kern
Sende-Rückfrage|app.js:kiReiniger|Einmal pro Vorgang; Ohne ihn senden/Abbrechen; Abbruch sendet und vermerkt nichts|reinigung|alle nativen Transportwege einbeziehen
Entfernungsvermerk|app.js:kiEntferntHtml|Weg/Seite/Text/Grund/Zeit; DB, Arbeitsstand, Sicherung, Bericht; Grenzen erhalten|reinigung,sicherung|kompatible Datenformate
Verschlüsselt sichern|sicherung.js:verschliessen|Bestehendes Format Fassung 1, Passwort zweimal/min. 8; kein Schlüssel/keine Einstellungen|sicherung|Dateispeichern; Tresor gepinnt unverändert
Wiederherstellen|sicherung.js:zusammenfuehren|Nur hinzufügen; alte Sicherung, fehlende Ordner/Dateien, falsches Passwort/Format melden|sicherung|Systemauswahl; PWA-Datenmigration per Sicherung/Arbeitsstand
Originale sichern|sicherung.js:inhaltBauen|Ungeprüfte Originalfotos und Entfernungsvermerke mitnehmen|sicherung,reinigung|kompatibles Sicherungsformat
Sicherung erinnern|app.js:sicherungErinnerung|Eigene Dokumente, 14 Tage, Später für Sitzung|sicherung|Webkern/Storage
Dauerspeicher|app.js:dauerStand|ja/nein/unbekannt ehrlich, anfordern, Belegung anzeigen|sicherung|native Aufbewahrung/Backups unterscheiden
App-Sprachen|sprache.js:T|DE/EN/RU/AR/RTL, Benutzernamen nie übersetzen, Auswahl offline gespeichert|sprache|Webkern unverändert
Tooltips/Barrierefreiheit|app.js:spracheWaehlen|Hinweise an/aus, aria/placeholder/title, reduzierte Bewegung|sprache,bibliothek|Screenreader/Tastatur/Touch am Zielgerät
Einstellungen|app.js:einstellungen|Anbieter/Schlüssel/Erkennungs- und Übersetzungsmodell, Verbindungstest, Linien, Sprache, Speicher|sprache,e2e|bestehende BYOK-Speicherung; Änderung nur nach Rücksprache
Installation/Aktualisieren|app.js:installHinweis|PWA-Angebot/Anleitung, als installiert verborgen; Hard-Reload erhält Dokumente|manifest-id,bibliothek|reguläre native Version/Updateadapter; PWA-Cachefunktionen nicht verlieren
Hilfe/Beispiele|app.js:hilfe|Handbuch, Amtsformular, zwei Schutzbeispiele, Videos, Webseite|beispiele,eingang|öffentliche Ressourcen lokal bündeln; externe Links gezielt öffnen
Erklärvideos|app.js:erklaervideo|DE/EN/RU, AR→EN-Hinweis; zwei Filme/Kapitel, Lagewechsel gleiche Zeit, Ende→Schutzfilm|video|Online/Range-Antworten, tatsächliche Wiedergabe prüfen
W-Floh/Design|app.js:hops|Maskottchen, flache Knöpfe, kleine Ansichten/DeX, rollende Leisten|bibliothek,schieber,scan|echte Fenster-/Tastatur-/Lagewechsel prüfen
Mycel/SBKIM|sbkim-init.js:|Kanon-Reihenfolge, Lampen/Siegel/Blase/Gerätename; kein Netz vor Tipp|knoten|WebSocket/WebCrypto/Identität lokal prüfen
Netzwahl|sbkim-init.js:|Öffentlich/eigenes Netz, Beitrittslink, Geräte-/Netzspeicher, Membran allowedOrigins leer|knoten|Deep-Link/Relaisadapter; keine fremden Schlüssel übernehmen
Lizenzen/Datenschutz|app.js:hilfe|LICENSE, RECHTE, THIRD_PARTY, impressum und Sicherheitshilfe erhalten|schieber|native Hosting-/Adapterangaben nach gewähltem Weg ergänzen
'''.strip().splitlines()
head='''# Funktionsmatrix für die native Übernahme

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
'''
lines=[]
for i,row in enumerate(rows,1):
 title,loc,behavior,tests,native=row.split('|'); file,fn=loc.split(':'); p=src/'assets'/file; text=p.read_text(); match=re.search(r'\bfunction\s+'+re.escape(fn)+r'\s*\(',text) if fn else None
 line=text.count('\n',0,match.start())+1 if match else 1
 lines.append(f'| F{i:03} | **{title}**: {behavior} | `assets/{file}:{line}`'+(f' `{fn}`' if fn else '')+f' | {tests} | {native}; **offen** |')
(out/'FUNKTIONSMATRIX.md').write_text(head+'\n'.join(lines)+'''\n
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
''')
print(len(lines),'Funktionszeilen')
