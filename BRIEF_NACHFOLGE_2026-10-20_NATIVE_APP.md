# Nachfolgebrief: Workflow PDF vollständig als native Workflow PDF Pro-App

Auftrag von Klaus, 20. Oktober 2026. Dieser Brief bereitet eine neue Sitzung vor.
In der abschließenden Private-Brain-Sitzung wurde **keine Workflow-App gebaut**.

## Auftrag und verbindliche Grenzen

Übertrage **Workflow PDF mit seinem vollständigen vorhandenen Funktionsumfang**
in eine eigenständige native **Workflow PDF Pro**-App. Vorbild ist die Umsetzung
von Private Brain zu Private Brain Pro in der vorangegangenen Sitzung.

Klaus’ Vorgaben:

> „Keine Testversion, gleich in einer richtigen Version arbeiten.“
> „Workflow PDF mit allen Funktionen, mit allen Spezifikationen, mit der
> Erkennung von Schadsoftware und so weiter. Alles. Nichts vergessen, nichts
> umschreiben. Wenn es nicht anders geht, sag bitte vorher Bescheid.“
> „Workflow PDF ist fast perfekt.“
> „Wenn es etwas gibt, was komplexer ist in der Umsetzung, bitte vorher mich
> informieren.“

Deshalb den vorhandenen Anwendungskern möglichst **bytegleich übernehmen**.
Keine Neuentwicklung, vereinfachte Nachbildung, Ausdünnung oder Umgestaltung
der bewährten Funktionen. Notwendige Geräteanbindungen in getrennten Adaptern
ergänzen. Ein Laufzeitproblem ist kein Anlass, eine Funktion still zu entfernen.

Vor einer unvermeidbaren Abweichung, einem Eingriff in den Anwendungskern oder
einer komplexeren Umstellung Klaus **vor deren Umsetzung** informieren: betroffene
Funktion, belegtes Problem, vorgeschlagene Lösung, Alternativen und Folgen für
Bedienung, Daten, Datenschutz, Kosten und Offline-Nutzung nennen. Bei einer
Entscheidung zwischen solchen Wegen seine Antwort abwarten. Unabhängige,
unverändert übernehmbare Arbeiten können währenddessen weitergehen. Keine
pauschale Zustimmung zu späteren Funktionsänderungen aus diesem Brief ableiten.

### Rücksprache immer mit begründeten Möglichkeiten

Ergänzung von Klaus in derselben Sitzung: Die Rücksprache soll gleich mehrere
Variationen beziehungsweise Möglichkeiten **mit Begründung** enthalten.
Deshalb nicht nur ein Problem melden oder fragen „Wie soll ich weitermachen?“.
Bei jedem solchen Entscheidungspunkt normalerweise zwei bis vier tatsächlich
umsetzbare Varianten gegenüberstellen:

- **Was wird konkret gemacht, und weshalb ist diese Variante geeignet?**
- Welche vorhandenen Funktionen bleiben gleich, welche ändern sich, und welche
  Folgen hat das für Bedienung, Dateiformate, Datenübernahme und Qualität?
- Was läuft offline, was braucht Netz, einen Download, ein Konto oder einen
  Schlüssel; welche Daten verlassen gegebenenfalls das Gerät?
- Welche Kosten, Abhängigkeiten, Wartungsfolgen und welcher Aufwand entstehen?
  Unbekannte Preise oder Zeitbedarfe als unbekannt kennzeichnen.
- Welche Geräte/Betriebssysteme sind abgedeckt, welche Einschränkungen und
  Risiken sind belegt, und wie wird die Variante geprüft?

Eine begründete Empfehlung und die konkrete Entscheidung nennen, die Klaus
treffen soll. Eine möglichst unveränderte Übernahme als Variante mitprüfen;
keine Scheinoptionen und keine heimliche Vorentscheidung. Gibt es belegbar nur
einen funktionsfähigen Weg, erklären, warum die anderen ausscheiden. Für die
Wahl zwischen Varianten mit wesentlichen Änderungen Klaus’ Antwort abwarten.

## Repositories und geprüfter Ausgangspunkt

| Rolle | Adresse / Stand beim Schreiben |
| --- | --- |
| Bestehende Web-App | https://lausiklauskn-png.github.io/Workflow-PDF/ |
| Unveränderte Quelle | https://github.com/lausiklauskn-png/Workflow-PDF |
| Quellstand `main` | `7227c543d4a536cf8f3354a56fbba7574645703e` vom 18.10.2026, PR128 |
| Zielrepository | https://github.com/lausiklauskn-png/Workflow-PDF-Pro |
| Genannte Pro-Webadresse | https://lausiklauskn-png.github.io/Workflow-PDF-Pro/ |
| Pro vor diesem Brief | `a486d7188da3acbbb88450fea106348bc3e29bab`, nur `README.md`, kein Anwendungscode |
| Native Referenz | https://github.com/lausiklauskn-png/Privat-Brain-Pro |

Die beiden Repository-Stände wurden über GitHub nachgesehen. Die Pro-Webadresse
belegt noch keine fertige App; ihre Auslieferung wurde hier nicht geprüft.
Zu Beginn der Nachfolgesitzung beide `origin/main` erneut lesen, Änderungen seit
diesen Ständen ausweisen und den tatsächlich übernommenen Quellcommit festhalten.
Den vorhandenen Bestand im Ziel niemals ungeprüft überschreiben.

**Workflow-PDF bleibt eigenständig und unverändert.** Die native Umsetzung wird
in Workflow-PDF-Pro gepflegt. Keine Änderungen an anderen WorkFlohs, Private Brain,
Sage oder den Quellrepos ihrer Bibliotheken als Nebenwirkung dieser Portierung.

## Zuerst lesen und den vollständigen Bestand erfassen

Im Quellrepo `README.md`, **die gesamte `CLAUDE.md`**, `docs/TODO.md`, die passenden
Briefe und Abschlüsse unter `docs/sessions/`, `package.json`, `index.html`,
`manifest.webmanifest`, `sw.js`, `assets/`, `vendor/`, `sbkim/`, `tests/`,
`LICENSE`, `RECHTE.md`, `THIRD_PARTY.md`, Hilfe und Datenschutz lesen.
README und ältere Abschnitte beschreiben zum Teil frühere Zustände; neuere
Festlegungen, tatsächlichen Code und Prüfungen gemeinsam auswerten.

Vor dem Bauen eine **Funktionsmatrix** erstellen: jede Ansicht, jeder Dialog,
Knopf, Import-/Exportweg, Datentyp, Schutzschritt und optionale Dienst mit
Quellstelle, bisherigem Verhalten, vorhandenen Prüfungen, nativer Anbindung
und Nachweis. Auch Hintergrundfunktionen und Abbruch-/Fehlerwege aufnehmen.
Diese Matrix ist die Grundlage für „nichts vergessen“; die folgende Liste ist
keine Erlaubnis, andere vorhandene Funktionen wegzulassen.

## Unverkürzt zu übernehmende Funktionen

1. **Bibliothek und Eingang:** PDF, Fotos/Bilder, Ordner, Drag-and-drop,
   Arbeitsstand-Dateien, Anhängen von Seiten, empfangene Dateien über Teilen und
   „Öffnen mit“. Ordner anlegen/umbenennen, Dokumente verschieben, duplizieren,
   Vorlagen, Einzelauswahl/Mehrfachauswahl, langer Druck, Ziehen mit Verweilen,
   Löschen mit Rückfrage, Sortieren einschließlich natürlicher Reihenfolge und
   Erstellungszeitraum. Gespeicherte Dokumente und Einstellungen nach Neustart.
2. **PDF-Editor und Formularerkennung:** vorhandene Felder samt Werten,
   Offline-Erkennung von Linien, Rahmen, Kästchen und Flächen, optionale
   KI-Erkennung mit eigenem Schlüssel, Vorschläge prüfen/bestätigen. Alle
   vorhandenen Feldarten einschließlich Text, Datum, Kästchen, E-Mail, Telefon,
   URL, Kunden-/Artikelnummer, QR-Code, Unterschriften-/Zeichenfunktionen;
   Verschieben, Größenänderung,
   Bearbeiten und Ausfüllen, Links und Dokumentensuche. Sämtliche bestehenden
   Einstellungen, Seiten- und Qualitätsfunktionen erhalten.
3. **Ausgabe:** festes PDF, ausfüllbares PDF, leere Vorlage, Original,
   HTML-Ausgabe mit echten Eingabefeldern, Ansehen/Drucken, Herunterladen,
   Teilen, ganze Ordner als ZIP/Einzeldateien oder zusammengefügtes PDF,
   Aufteilen und bestehende Bild-/Teilausgaben. Arbeitsstände sichern und
   wieder öffnen, richtige Dateinamen, Umlaute und Kyrillisch erhalten.
4. **Scanner/Fotos:** Kamera und Bildimport, mehrere Seiten, drei Verfahren zur
   Blattfindung, Unsicherheit anzeigen statt still schneiden, Ecken mit Lupe,
   Perspektive/A4/US Letter/Originalformat, Drehen, Reihenfolge und Entfernen.
   Alle Filter, Schattenkorrektur, Helligkeit/Kontrast, OCR DE/EN/RU,
   Zeilenkorrektur und -gestaltung, Original/Kopie/Nebeneinander, erneutes
   Fotografieren/genauere Erkennung, durchsuchbares PDF und Bilder-ZIP.
   Zuschneiden im Editor, Qualitäts-/DPI-Einstellungen und vorhandenen
   ChatGPT-Bildübersetzungsweg samt Ergebnis-Rückholung erhalten.
5. **Dokumentübersetzung:** DE/RU/EN in allen bestehenden Richtungen, einzelne
   Dokumente/Ordner und Teile großer Dokumente. Lage, Bilder, Farben, Seiten,
   Felder, Ergebnisordner und Verknüpfung zum Original erhalten. Fortschritt,
   Abbrechen/Fortsetzen, gespeicherte Teilergebnisse, Fehlerbehandlung,
   Gegenprobe/Rückübersetzung, Behördenformulare und „Einträge ins Original“
   mit einer Kopie des Originals. Alle vorhandenen Übersetzerwege erfassen.
6. **Suche und Spracheingabe:** Wortsuche in Namen, Ordnern, Feldern und
   Seitentext, Trefferzahlen, Fundstellen und Navigation im Dokument;
   Bedeutungssuche einschließlich freiwilligem Modellbezug, Fortschritt,
   Vektorspeicherung, Wiederaufnahme und vorhandenem Lernverhalten.
   Spracheingabe mit laufendem Text, Anzeige, Stopp und bisherigem Suchablauf.
7. **Schutz und Nachweise:** vollständige bestehende Dokumentprüfung,
   Schadtext-/KI-Anweisungsprüfung, Bild-/PDF-Prüfung, sichtbarer Prüfstatus,
   Prüfbericht samt Textdownload, Fundstellen/markierte Kopien, Herkunft/C2PA,
   Metadatenangaben sowie Reinigung vor externen KI-/Chrome-Übertragungen.
   Die tatsächlichen Grenzen und Einwilligungswege vollständig mitnehmen.
8. **Sicherung:** bestehendes passwortverschlüsseltes Sicherungsformat,
   Wiederherstellung ohne Überschreiben, Ordner, Dokumente, Felder, Originale,
   Arbeitsstände und Entfernungsvermerke; alte Sicherungen lesbar halten.
   Erinnerungen und Behandlung fehlender Dateien nicht verlieren.
9. **Gesamte Oberfläche und Netzfunktionen:** bestehendes Design, W-Floh,
   Hilfe, Handbuch, Beispiele, Erklärvideos einschließlich zweitem Schutzfilm,
   Kapitel und Lagewechsel, sämtliche Darstellungseinstellungen, Tooltips und
   Barrierefreiheit.
   App-Sprachen **DE/EN/RU/AR einschließlich rechts nach links** erhalten;
   sie sind von den Dokument-Übersetzungssprachen getrennt. Mycel,
   SBKIM-Knoten, Lampen, Siegel, Netz-Einstellungen und sämtliche vorhandenen
   Verbindungen/Schutzschritte vollständig erfassen und erhalten.

## Schutzfunktionen: Verhalten und Grenzen nicht verfälschen

Die drei Prüfer `assets/pruefer-anhang.js`, `pruefer-mail.js` und
`pruefer-formate.js` sind in `tests/eingang.mjs` per SHA-256 an ihre Herkunft
gebunden. Sie bytegleich übernehmen. Ebenso die in `tests/knoten.mjs`,
`tests/bedeutung.mjs` und `tests/sicherung.mjs` gepinnten SBKIM-/Modellmodule
und `assets/schluesseltresor.js`. Kopierte Bibliotheken, Modelle, Schriften,
Reihenfolge und Lizenzen erhalten. Keine Hashes ändern, um einen Eingriff
unbemerkt grün zu bekommen; Konflikte mit der Portierung vorher melden.

Der aktuelle Quellstand prüft normale Importe **auf ausdrücklichen Knopfdruck**,
nicht automatisch beim Einlesen. Die zwei Schutz-Beispieldateien bilden eine
dokumentierte Ausnahme. Dieses spätere Verhalten aus `CLAUDE.md` und
`tests/eingang.mjs` hat Vorrang vor älteren Beschreibungen. „Noch nicht geprüft“,
„läuft“, Befund und unvollständige Prüfung ehrlich anzeigen; kein stilles „sauber“
bei fehlendem Prüfer, fehlenden Rechten, Abbruch oder ausgelassenem Inhalt.
Originale/ungeprüfte Originalfotos, deren Lebenszyklus und Sicherung erhalten.

Vor externen Übertragungen die vorhandene Reinigung, einmalige Rückfrage,
Abbrechen ohne Senden und den dokumentierten Entfernungsvermerk erhalten.
Originaldokumente dabei unverändert lassen. Herkunftsangaben sind kein
Gefahrenfund; die vorhandene C2PA-Auswertung bestätigt keine nachgerechnete
kryptografische Signatur. Keine dieser Grenzen heimlich anders darstellen.

**Der Bestand sagt ausdrücklich „keine Virenprüfung“.** Klaus verlangt die
Übernahme aller Schutzfunktionen. Daraus folgt keine belegte Erkennung sämtlicher
Schadsoftware. Diese Unterscheidung vor einer Erweiterung mit ihm klären. Ein
zusätzlicher Virenscanner oder externer Sicherheitsdienst wäre eine eigene,
vorher zu besprechende Änderung; keine ungefragten Datei-Uploads.

## Übersetzung mit Google: früh und konkret mit Klaus besprechen

Der Bestand enthält unterschiedliche Wege: lokale `Translator`-API, optionale
KI mit eigenem Schlüssel und Chromes Browserfunktion „Übersetzen“, einschließlich
Teilen an Chrome und Rückweg. App-Oberflächensprache ist ein weiterer,
getrennter Vorgang. Nicht unter einem allgemeinen „Google funktioniert“ vermischen.

Eine native WebView besitzt nicht automatisch Chromes Menü oder `Translator`.
Ein externer Browser teilt auch nicht automatisch die native IndexedDB. Deshalb
funktionieren vorhandene URLs mit Dokumentkennungen und der bisherige Rückweg
nicht allein durch das Einpacken als App. Kamera-/Sprach- und Dateirechte kommen
als eigene Geräteanbindungen hinzu.

Zuerst die tatsächlich verfügbaren APIs/Sprachpaare am Zielgerät messen und
Klaus den Befund zeigen. Als **Optionen zur Besprechung**, nicht als schon
gewählte Umsetzung: vorhandenen Browserweg mit sicherem Dokument-Rücktransport
erhalten; eine geeignete native Offline-Übersetzung prüfen; oder einen ausdrücklich
gewählten Übersetzungsdienst anbinden. Funktionsgleichheit, Layout, Sprachpaare,
Offlinefähigkeit, Qualität, Einwilligung, etwaige Downloads/Konten und Kosten
vorher darlegen. Keine Google-API, Cloud-KI oder kostenpflichtige Lösung einfach
einschalten. Keine bestehende Übersetzung entfernen, bevor Klaus einer konkreten
Alternative zugestimmt hat. Gestellte Antworten belegen keinen echten Google-Lauf.

Für das erste Übersetzungsgespräch diese Varianten anhand der Geräteprüfung
konkretisieren; die Tabelle trifft noch keine Auswahl:

| Möglichkeit | Begründung / Vorteil | Vorher nachzuweisende Grenzen und Folgen |
| --- | --- | --- |
| A: Vorhandenen Chrome-Weg mit nativer Übergabe und sicherem Rücktransport erhalten | Am nächsten an Klaus’ bekanntem Ablauf; bestehende Übersetzungslogik weitgehend erhalten | Browserwechsel, getrennte Datenspeicher, Rückweg und Einwilligung praktisch prüfen; kein Offline-Versprechen und keine ungeprüfte Veröffentlichung privater Dokumente über eine URL |
| B: Geeigneten nativen Offline-Übersetzer als Adapter einbinden | Dokumenttext könnte nach dem nötigen Modellbezug auf dem Gerät bleiben; kein Wechsel in Chrome | Verfügbare Sprachpaare, tatsächliche Offlinefähigkeit, Modelle/Lizenzen, Speicherbedarf, Geräteunterstützung und Qualität messen; gleiches Ergebnis oder gleiche PDF-Qualität nicht voraussetzen |
| C: Einen ausdrücklich gewählten Übersetzungsdienst über eine offizielle API anbinden | Definierte Schnittstelle und gezielte Sprachwahl könnten den browserabhängigen Ablauf vereinfachen | Netz, Datenschutz, Schlüssel/Konto, Kontingente und mögliche laufende Kosten offenlegen; Inhalt erst nach Zustimmung übertragen, bestehende Reinigung und Abbruchmöglichkeit erhalten |
| D: Bestehende Wege erhalten und eine zusätzliche native Wahl anbieten | Klaus behält bewährte Möglichkeiten und kann je Dokument zwischen Offline- und Online-Weg wählen | Größter Integrations-, Erklärungs- und Prüfaufwand; keine versteckte automatische Umschaltung zu einem Onlinedienst |

Die Empfehlung muss sich auf Messungen, Klaus’ bevorzugte Sprachen und seinen
gewünschten Offline-/Datenschutzumfang stützen. Kosten oder Übersetzungsqualität
nicht behaupten, solange sie nicht für den konkreten Weg nachgewiesen sind.

## Native Umsetzung nach dem Vorbild dieser Sitzung

- **Produktname Workflow PDF Pro, reguläre erste Version**, beispielsweise
  `1.0.0` mit monotoner Buildnummer; kein Test-/Preview-/Beta-Produkt oder
  solcher Releasekanal. Der native Build muss den vollständigen bewährten
  Anwendungskern lokal mitbringen, keine bloße Fern-Webseite öffnen.
- Capacitor mit lokal gebündeltem Kern und getrennten Geräteadaptern ist ein
  zu prüfender Übernahmeweg aus Private Brain Pro. Den bewährten PDF-Kern nicht
  neu schreiben. Name und native Installationsdaten dürfen angepasst werden;
  darüber hinaus nötige Kernänderungen vorher besprechen.
- Android/Samsung DeX wie bei der Referenz praktisch berücksichtigen. Klaus’
  Wunsch nach allen Betriebssystemen mitnehmen: konkrete native Zielplattformen,
  nötige Geräteadapter und Auslieferung vor komplexeren Umstellungen besprechen.
  Browser-Engine-Prüfungen niemals als fertige iOS-/Desktop-App ausgeben.
- Eigene stabile Paketkennung und langfristig erhaltenen Signierschlüssel für
  Workflow PDF Pro festlegen. Private-Brain-Kennung, Signierschlüssel,
  Google-Mail-Registrierung, Konten oder private Daten nicht übernehmen.
  Schlüssel außerhalb Git aufbewahren; bestehende Schlüssel nie still ersetzen.
- Quell-PWA mit ihrer Manifest-ID `/Workflow-PDF/` und Datenbank
  `WorkflohPDF1` unverändert lassen. Native Herkunft und Speicher sind getrennt:
  die Datenbankbenennung allein überträgt keine PWA-Daten. Eine kompatible,
  nachvollziehbare Übernahme über vorhandene Sicherungen/Arbeitsstände vorsehen;
  keine Daten oder alten Installationen zur „Reparatur“ löschen.
- Datei-/Ordnerauswahl, dauerhafte Freigaben, Dokumentkopien, Kamera,
  Mikrofon, Teilen hinein/hinaus, „Öffnen mit“, Drucken, externe Links,
  System-Zurück und Browser-Rückwege wirklich anbinden. „Nicht mehr anzeigen“
  darf nur eine Erklärung ausblenden und nie den erneuten Ordnerwechsel sperren.
- Offline-Bestand einschließlich OCR, WASM/Worker, Schriften, Scan-/Suchmodellen
  und deren bisherigen freiwilligen Downloads vollständig inventarisieren.
  PWA-Service-Worker/Installierknöpfe nur durch passende native Abläufe ersetzen;
  deren Cache-, Modell-, Teilen- oder Offlinefunktionen nicht mit entfernen.
  Online-Videos und freiwillige externe Dienste ehrlich als solche behandeln.
- Nur ausdrücklich ausgewählte öffentliche Laufzeitdateien bündeln. Keine
  Repository-Metadaten, echten Dokumente, Zugangsdaten, Signierschlüssel oder
  Entwicklungs-/Prüfdateien versehentlich in die App übernehmen.
- Mobile Fenster, DeX, Hoch-/Querformat und Größenwechsel erhalten. Kleine
  flache Knöpfe, Symbol mit kurzem Text daneben, verständliche Tooltips und
  erreichbare Dialoge. Kein abgeschnittener Inhalt; die Bildschirmtastatur
  darf kein gerade bearbeitetes Feld durch Neuzeichnen zerstören.

Besonders empfindliche PDF-Regeln aus der Quelle erhalten: Viewport-Matrizen für
gedrehte Seiten/CropBoxen, Feldpositionen in Prozent der angezeigten Seite,
NFC/Umlaute und Kyrillisch sowie vollständig eingebettete Schriften
(`subset: false`). Keine stillen Änderungen an Ausgabequalität, Formaten,
Formularsemantik, Prüfgrenzen oder Datenformaten.

## Nachweise, bevor die reguläre App als fertig gilt

1. Den Quellstand mit seiner vollständigen `npm test`-Kette als Ausgangspunkt
   ausführen und Befunde festhalten; `npm run messen`, vorhandene Gegenproben
   und bekannte Gerätegrenzen passend einbeziehen. Aktuell enthält die
   `npm test`-Kette 28 Skripte. Frühere grüne Zahlen aus `CLAUDE.md` sind keine
   erneute Messung. Hier wurden für den Brief keine App-Tests ausgeführt.
2. Für die native Ausgabe jede Zeile der Funktionsmatrix nachweisen, einschließlich
   realer Datei-/Ordnerrechte, Kamera, Teilen/Öffnen, Drucken, Spracheingabe,
   Modellnutzung, tatsächlicher Übersetzung und Wiederaufnahme nach Neustart.
   Mocks, Browser-Engines, Emulator und echtes Gerät getrennt kennzeichnen;
   fehlende Voraussetzungen oder übersprungene Fälle nicht als Erfolg zählen.
3. Originale, Sicherungen, Formularexporte und Positionen anhand der erzeugten
   Dateien und gerenderten Ausgabe prüfen. Schutz gegen täuschende Dateien,
   fehlenden Prüfkern und unterbrochene Abläufe mit synthetischen Beispielen
   nachweisen. Keine privaten Dokumente ungefragt als Prüfdaten hochladen.
4. Den exakt geprüften Quellstand signiert bauen; Paket, reguläre Version,
   Zertifikat und unveränderte Schutzmodule prüfen. Installation, Neustart und
   spätere Updates ohne Verlust der Einstellungen/Dokumente nachweisen.
5. Eine tatsächliche reguläre Auslieferung mit passendem Installer und dauerhaft
   erreichbarem Download bereitstellen. Öffentlichen Download erneut laden und
   vollständig mit der signierten geprüften Datei vergleichen; SHA-256,
   Zertifikat, Quellcommit, CI- und Gerätenachweise dokumentieren. Keine
   funktionsarme erste Fassung als vollständige 1:1-Übernahme veröffentlichen.

Der Abschluss der Nachfolgesitzung nennt klar: übernommen, tatsächlich geprüft,
mit Klaus vereinbarte Abweichungen und verbleibende Grenzen. Ungeklärte komplexe
Punkte vor ihrer Umsetzung melden, nicht erst im Abschlussbericht.

## Referenz und Abschluss der Private-Brain-Sitzung

Private Brain Pro `.16` ist veröffentlicht. Anwendung: PR31,
`0b7fef62a989be4200c1372df8c229ae7253d6c8`; Übergabe: PR32,
`78e93b5aedfcb828d435d1c5d4624d695e47c122`.
Die Android-Ausgabe wurde mit 319 nativen Browser-Gegenproben, zusätzlich je
101 in Firefox/WebKit, 37 Android-Fällen und einem signierten Update geprüft.
Das ist ein **Vorgehensvorbild**, kein Funktionsnachweis für Workflow PDF.

Zum Nachlesen im Referenzrepo: `tools/native/prepare-web.mjs`, `native/`,
`android/`, `docs/ANDROID.md`, `docs/BESCHRIFTUNGEN-UND-ORDNER.md` und
`docs/PRUEFSTAND-ANDROID.md`. Technische Preview-Kanäle und projektspezifische
Adapter der Referenz nicht blind kopieren; für Workflow PDF gilt Klaus’ Auftrag
einer regulären Pro-Version und vollständiger Funktionsübernahme.

Diese Sitzung endet mit diesem Brief. **Die Implementierung von Workflow PDF Pro
beginnt erst in der Nachfolgesitzung in diesem Zielrepository.**
