# Chrome-Transport — Erprobung der gewählten Variante A

Klaus hat Variante A am 20.10.2026 zur Erprobung ausgewählt. Plattformfolge:
Android/Samsung DeX → Windows → iOS. Geräte- und Chrome-Version sind unbekannt.

Neueste Nutzerweisung in der Fortsetzung vom 21.10.2026: Die zusätzliche
Vordergrunddienstentscheidung ist wieder ausdrücklich offen. Das überstimmt die
historische Zustimmung unter Punkt 2 unten. Erneute begründete Auswahl vorgelegt;
bis zu einer Antwort keinen Dienst aktivieren. Variante A bleibt gewählt.

## Vorliegende Umsetzung

- `transport.mjs`: ausführbarer **Node-Host für die Linux-Transporterprobung**.
  Er ist kein Android-Plugin und wird nicht als Node-Laufzeit in eine APK gepackt.
- `helper.html` / `helper.js`: Chrome-Seite mit ausschließlich lokal geladenem
  Originalmodul `upstream/workflow-pdf/assets/uebersetzung.js`. Dessen
  `chromeUebersetzer` übernimmt Textfläche, Chrome-DOM-Auswertung,
  Zielschriftprüfung und Abbruch unverändert.
- `adapter.mjs`: schmale Übersetzer-Schnittstelle `async texte[] → texte[]`
  mit den bestehenden `stat`, `art`, `halt`, `zu` und `beimHalt`-Eigenschaften.
  Sie öffnet vor dem ersten Absatz keine Sitzung. Damit liegt der bestehende
  Reinigungshalt vor dem ersten Transport und vor dem Öffnen der Chrome-Seite.
- `tools/native/test-chrome-transport.mjs`: 11 ausgeführte Host-/Browserprüfungen.

Die App gibt dem Transport ausschließlich die bereits gereinigten Absätze.
PDF-Bytes, Dokumentkennungen, Felder, Originale und die Datenbank bleiben bei
der App. Eine Antwort wird genau dem wartenden Absatzpaket zugeordnet. Der
bestehende App-Kern erstellt das PDF und speichert Ergebnisse/Vermerke selbst.

Die Prüfung durch den unveränderten App-Kern nutzt dessen vorhandenen Testzugang
`__wfpdf.uebersetzeViele`. Die native WebView-Einbindung ist **noch nicht
installiert**; der Versuch beweist nicht den vollständigen UI-Knopfweg einer APK.
Kein neuer Anbieter, Schlüssel oder Onlinedienst wurde aktiviert. Die Helpertexte
sind interne Erprobungstexte auf Deutsch, noch keine ausgelieferte App-Oberfläche.

## Transportgrenzen und Zugriffsprüfung

IPv4-Server ausschließlich auf `127.0.0.1` mit zufälligem Port; Hostfeld exakt
prüfen. Pro Sitzung 256-Bit-Zufallsschlüssel, über ein URL-Fragment übergeben:
Fragmente werden nicht im HTTP-Request übertragen. Der Helfer entfernt das Fragment
sofort aus der sichtbaren Adresse. Kein Referrer, kein Cache, keine Cookies,
keine externen Programme/Schriften/Bilder in der Helferseite.

Dokumenttexte sind nur mit dem Sitzungsschlüssel lesbar. Schreibanfragen müssen
zusätzlich vom eigenen Ursprung kommen. Keine CORS-Freigabe; Preflight, fremder
Origin und manipuliertes Hostfeld werden abgewiesen. CSP und Frame-Sperre sind
aktiv. Fehler werden ohne Wiedergabe des Nachrichtentextes zurückgegeben.

Antworten tragen eine fortlaufende Paketnummer und müssen Anzahl und Datentypen
aller Absätze erhalten. Alte/mehrfache Antworten werden abgewiesen. Es wird nie
abgeschnitten oder ein Originaltext bei Transportabbruch als Übersetzung gemeldet.
Die Original-Engine kann selbst nach ihrem bestehenden Warteverhalten einzelne
Absätze unübersetzt zurückgeben; deren `stat.ohne` wird beibehalten, damit der
App-Bericht die Grenze weiter nennt.

Für den Hostversuch: höchstens 16 MiB JSON-Nachricht, acht TCP-Verbindungen,
30 Minuten ohne neuen App-Auftrag oder angenommene Antwort bis zum Sitzungsablauf.
Browser-Polling verlängert die Sitzung nicht. Übergröße meldet einen Fehler und
kürzt nichts. Das sind **technische Grenzen des Versuchs**, keine freigegebenen
neuen Dokument-/Seitenlimits der regulären App. Vor Übernahme in den nativen Host
müssen benötigte Paketgrößen, Chunking und Zeitverhalten geprüft werden.

Abbruch/Schließen/Ablauf widerruft den Schlüssel, entfernt die gehaltenen Absätze
und beendet Verbindungen. Die App bleibt für den dauerhaften Zwischenstand
zuständig; im Transport wird kein Dokumentbestand angelegt.

## Tatsächlich gemessen

```bash
cd /workspace/Workflow-PDF-Pro
node --test --test-reporter=tap tools/native/test-chrome-transport.mjs
```

11 bestanden, 0 fehlgeschlagen, 0 übersprungen. Siehe
`docs/portierung/nachweise/chrome-transport.tap`.

Geprüft: Sprachpaareingaben, Zugriff ohne Schlüssel, Origin/Host/Preflight,
Seitenreihenfolge, alte/doppelte Ergebnisse, falsche Absatzanzahl, ungültige und
übergroße Nachrichten, Abbruch, Ablauf und neue getrennte Sitzung. Reale
Chromium-Seite mit zwei Paketen, UTF-8, nicht ausgeführtem HTML im Text,
bytegleichem Übersetzungsmodul und Rücktransport über echte HTTP-Verbindungen.

Zusätzlich: unveränderte App mit synthetischem zweiseitigem PDF. Vor der Freigabe
kein Transport. „Abbrechen“ öffnet keinen Chrome-Helfer und hinterlegt keinen
Entfernungsvermerk. „Ohne ihn senden“ überträgt sichtbare Texte, keinen weißen
versteckten Testtext. Das Ergebnis-PDF hat zwei Seiten und synthetisch übersetzte
Texte; der Entfernungsvermerk liegt am Original mit Weg `chrome`. Originalbytes
unverändert, abgeschlossener Übersetzungsjob entfernt.

**Simuliert wurde nur die Chrome-DOM-Übersetzung.** Kein echter Google-Lauf,
keine Aussage zur Übersetzungsqualität, keine Kamera-/Dateirechte, kein Android-
oder DeX-Test. Der erneute Lauf der gespeicherten Browser-API-Messung bestätigte
weiterhin sechs `downloadable`-Paare in Chromium 154, keine geladenen Sprachpakete.

## Nächste erforderliche Nachweise

1. Dieses Protokoll in einem engen Android-Adapter bereitstellen. Der Node-Host
   ist eine ausführbare Protokollreferenz, keine native Implementierung.
2. Android-Prozess-/WebView-Lebenszyklus prüfen: Die App darf beim Wechsel zu
   Chrome keine Seite verlieren. Hintergrund-Throttling, Suspendierung und
   Prozessende sind hier nicht gemessen. Klaus hat am 21.10.2026 den konkret
   vorgelegten Vordergrunddienst mit sichtbarer Benachrichtigung und Abbruch
   ausdrücklich gewählt (ENTSCHEIDUNGEN.md). Noch nicht implementiert; die
   Entscheidung nicht erneut als offen behandeln und nicht als Gerätenachweis werten.
3. Auf dem Zielgerät prüfen, ob Chrome die lokale HTTP-Seite tatsächlich
   übersetzt. Nur lokales HTTP freigeben; keine allgemeine Freigabe unsicherer
   Netzwerkübertragungen und keine deaktivierte TLS-Prüfung.
4. Alle sechs Sprachrichtungen, Layout/Felder, Wiederaufnahme und „Einträge
   ins Original“ mit echter Chrome-Übersetzung prüfen. App-Neustart muss die
   bestehende gespeicherte Arbeit erhalten; Sitzungen dürfen nicht wiederverwendet werden.
5. Falls Chrome lokale Seiten nicht unterstützt, Klaus vor jeder Alternative
   den konkreten Befund und begründete Wege vorlegen. Keine öffentliche
   Dokument-URL und kein stiller Wechsel auf B/C.

Es wurde keine Test-/Preview-App ausgeliefert. Die reguläre vollständige App
bleibt das Ziel; APK, Signierung und Auslieferung liegen weiterhin nicht vor.
