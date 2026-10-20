# Entscheidungspunkte vor der nativen Umsetzung

Grundlage: BRIEF_NACHFOLGE_2026-10-20_NATIVE_APP.md. Die nachfolgenden
Möglichkeiten wurden zur Rücksprache vorgelegt. **Klaus hat am 20.10.2026 Variante A zur Erprobung gewählt.** B und C sind nicht freigegeben.
Die unveränderte Quellübernahme und die Ausgangsprüfung sind davon unabhängig.

## Zielsysteme

Festgehaltene Reihenfolge aus Klaus’ Antwort vom 20.10.2026: **zuerst Android/Samsung DeX, danach Windows, anschließend iOS**. Die Formulierung der ersten Antwort wird im Kontext als Bestätigung von Android/DeX verstanden; genaue Geräte-, Android- und Chrome-Version sind weiterhin unbekannt. Native iOS-Auslieferung benötigt Apple-Werkzeuge,
Signierung und Geräteprüfung; Windows/macOS/Linux eigene Plattformadapter und
Installer. Linux-Browserprüfungen beweisen keine dieser nativen Ausgaben.
Vorgeschlagenes Vorgehen: unveränderter lokal gebündelter Webkern, je Zielsystem
getrennte Geräteadapter. Capacitor ist für Android/iOS zu prüfen; für native
Desktop-Pakete muss der passende Host gesondert gewählt werden. Kein Fern-Webseiten-
Wrapper und keine funktionsreduzierte erste Ausgabe. Reguläre Version 1.0.0,
eigene stabile Paketkennung und eigener dauerhaft gesicherter Signierschlüssel.
Die Kennung `de.familyprojekt.workflowpdf.pro` ist ein Vorschlag, nicht registriert.

Benötigte Angaben: erstes reales Zielgerät, OS-/Chrome-Version und weitere
verbindliche Zielsysteme. Erst dann lassen sich die dort tatsächlich verfügbaren
Sprachpaare, Berechtigungen und Geräteadapter messen.

## Google-/Chrome-Übersetzung

### Belegtes Problem

`assets/app.js:chromeTabAdresse`, `inChromeOeffnen` und `chromeTabRueckweg`
übertragen IDs in `?ue=…` bzw. `?rueck=…`. Im bisherigen PWA/Chrome-Weg liegen
Dokumente am gemeinsamen Webursprung. Native WebView und externes Chrome haben
getrennte Speicher. Die Quelle erkennt fehlende Dokumente bereits und meldet den
getrennten Speicher. Ein Teilen der bisherigen URL kann deshalb allein keine
native Funktionsgleichheit herstellen.

`chromeUebersetzer` liest durch Chrome übersetzte Absätze aus dem DOM. Eine
WebView liefert nicht automatisch das Chrome-Menü. Das betrifft Hinübersetzung,
Fortsetzen, Ergebnisablage und „Einträge ins Original“ gleichermaßen.

Neu gemessener Cloud-Befund: Chromium 154 meldet Translator für alle sechs
DE/RU/EN-Paare als `downloadable`. Kein Sprachpaket/keine echte Übersetzung
getestet. Am Zielgerät und in dessen WebView ist noch nichts neu gemessen.
Ältere Tablet-Befunde nennen fehlendes Translator; das ist kein aktueller
Gerätenachweis. `tests/chrome.mjs` ist weiterhin eine Nachstellung.

### Konkrete Wege zur Auswahl

| Weg | Umsetzung und Grund | Vorteile | Nachteile / Daten / Aufwand | Vor Freigabe nachweisen |
|---|---|---|---|---|
| A — Chrome-Weg erhalten (Empfehlung für erste Erprobung) | Getrennte native Brücke über eine nur lokal auf dem Gerät erreichbare, zeitlich begrenzte Sitzung; bestehende Text-/PDF-Logik weiterverwenden; Ergebnis dem ursprünglichen Dokument zuordnen | Nächster Weg zum bekannten Ablauf, kein neuer Übersetzungsanbieter/API-Schlüssel; Original und Layout-Engine bleiben | Chrome-Wechsel bleibt; lokale Brücke, Sitzungsbindung und Rücktransport zusätzlich zu warten; Chrome sendet Text an Google, kein Offlineversprechen; Chrome muss diese lokal ausgelieferte Seite tatsächlich übersetzen können | Auf Zielgerät Chrome-Menü/Übersetzung lokaler Sitzung, sechs Paare, Reinigung vor Sichtbarkeit für Chrome, unberechtigte Zugriffe abweisen, Sitzung verfallen lassen, Abbruch/Neustart/Fortsetzen, Originalkopie und Felder erhalten; keine private Datei öffentlich hosten |
| B — Zusätzlich nativer Offline-Adapter | Geeignete native Übersetzungsbibliothek hinter der bestehenden Textübersetzer-Schnittstelle; Chrome/BYOK erhalten | Nach Modellbezug möglicherweise lokaler Textweg ohne Browserwechsel; PDF-Aufbau kann bestehen bleiben | Keine Qualitätsgleichheit zugesagt; Modell-/Bibliothekslizenz, Speicher, Download und Plattformunterstützung prüfen; mehr Abhängigkeiten; keine versteckte Online-Umschaltung | Reale Verfügbarkeit aller sechs Paare, Netzabschaltung nach Download, Namen/Zahlen/Formulare/Layout, Qualität mit Gegenprobe, Fehler/Abbruch und Geräte-Ressourcen |
| C — Zusätzlich ausdrückliche offizielle API | Gewählten Übersetzungsdienst als separaten Adapter ergänzen; Chrome/BYOK erhalten | Definierte Sprachwahl/Schnittstelle; nachvollziehbare Fehler-/Kontingentbehandlung | Übersetzungstext verlässt das Gerät; Konto/Schlüssel, Datenschutzbedingungen, mögliche laufende Kosten; Preise und 400-Seiten-Kosten ohne Anbieterwahl unbekannt; kein Offlinebetrieb | Ausgewählter Anbieter, Kosten und Einwilligung, Reinigung und Abbruch ohne Sendung, echte Testantworten ausschließlich mit synthetischen Daten, alle Paare und PDF-Qualität |

A ist eine Empfehlung für die technische Erprobung, **kein bereits bewiesener
Chrome-Transport**. Bei negativem Gerätebefund erneut mit konkreten Alternativen
Rücksprache halten; keine heimliche Ersatzlösung. Ein lokaler HTTP-Endpunkt ist
nicht pauschal „sicher“: Sitzungsgeheimnis, enge Bindung an die eigene App,
Ursprungs-/Anfrageprüfung, kein Fremdzugriff und Bereinigung der Sitzung müssen
implementiert und geprüft werden. Kein Text oder Geheimnis gehört in öffentliche URLs.

Alle Varianten behalten Dokumentformate, Originale, Feldkoordinaten,
Entfernungsvermerk, sichtbare Fortschritte und Abbruch. Die vorhandenen
App-Sprachen DE/EN/RU/AR sind davon getrennt. Der ChatGPT-Bildweg des Scanners
bleibt ebenfalls ein eigener freiwilliger Weg. Kosten- oder Qualitätsvorteile
wurden für keinen neuen Anbieter behauptet; Arbeitszeiten sind nicht geschätzt.

**Entscheidung getroffen:** A — Chrome erhalten, lokalen Hin-/Rücktransport zuerst erproben. Das erlaubt keine heimliche Umstellung auf B/C und ersetzt keine Geräteprüfung. Android/DeX zuerst, Windows danach, iOS anschließend.

### Noch unbeantwortet: Verarbeitung beim Wechsel zu Chrome

Für lange native Übersetzungen wurde gesondert nachgefragt: empfohlener nativer
Vordergrunddienst mit sichtbarer Benachrichtigung „Übersetzung läuft“ und Abbruch,
oder abschnittsweise manuelle Rückkehr zur App. Der Vordergrunddienst benötigt
Android-Dienstberechtigungen und muss Laufzeit-/Energiespargrenzen einhalten;
die manuelle Variante verändert den gewohnten Ablauf und benötigt viele Wechsel.
Chrome-Variante A allein ist keine Zustimmung zu dieser zusätzlichen Umstellung.
Solange Klaus dazu nicht geantwortet hat, keinen solchen Dienst als gewählt
behandeln und nicht ungefragt einbauen. Unabhängiger Bau kann weitergehen.

## Weitere Grenzen vor einer Änderung

Neuer verbindlicher Nutzerauftrag vom 20.10.2026: frei gewählter Speicherort
einschließlich SD-Karte für Dokumente und App-Arbeitsdaten, mit dem Speicher-/
Tresor-Grundgerüst von Private Brain Pro. Details, aktueller Referenzstand und
offene Entscheidungen zur Kernanbindung: [Speicherort und Tresor](SPEICHERORT-UND-TRESOR.md).
Keine bereits gebaute Funktion und keine Freigabe für beliebige Kernänderungen.

- Quelle bietet ausdrücklich keine Virenprüfung. Alle vorhandenen Schutzfunktionen
  werden übernommen; ein zusätzlicher Virenscanner wäre eine eigene Entscheidung.
- Native Spracheingabe kann sich bei Verfügbarkeit/Anbieter/Offlineverhalten von
  Web Speech unterscheiden. Vor Wahl eines Ersatzes konkrete Gerätebefunde vorlegen.
- Service Worker enthält Modell- und Teilen-Caches. Nicht wie in der Referenz
  pauschal entfernen: diese Funktionen brauchen einen nativen Erhaltungsweg.
- Bestehende Sicherung enthält Ordner, Dokumente/Felder/Einträge, PDFs und
  ungeprüfte Originalfotos. `inhaltBauen` sichert keine separaten `ue:*`-
  Übersetzungsjobs, Seitentext, Vektoren, Einstellungen oder KI-Schlüssel.
  Keine vollständige Übertragung dieser zusätzlichen Zustände behaupten.
  Dokument-Arbeitsstände/Feldwerte sind Teil der Dokumente. Eine Erweiterung des
  Sicherungsformats oder automatische Migration wäre vorher zu besprechen.
- Die Private-Brain-Referenz wurde nur gelesen (main `b8a4b52b693d463689df2bd5549a2e429c7d3794`).
  Sie verwendet Capacitor 8.5.3, JDK21/Android SDK36 und getrennte Adapter.
  Ihre Preview-Kanäle, Mailkonten, Signierung, Netzschalter, Importgrenzen und
  projektspezifischen Kernanpassungen werden nicht blind übernommen.
