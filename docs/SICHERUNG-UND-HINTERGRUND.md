# Sicherung gestreamt · Prüfen und Einordnen nur auf Knopfdruck (Pro-Umbau 3, 2026-10-28)

Leitfaden § 3 (`BookLedgerPro/docs/design/LEITFADEN-PRO-APPS-BEDIENUNG.md`), Befunde 7–9 aus der Probe am Tablet (Schritt E).
Nur in der App (Android und Windows). Kern `upstream/workflow-pdf` unverändert (`verify-upstream` 200/0).

## Sicherung gestreamt (`native/native-sicherung.js`)
- Einstellungen → „Bibliothek sichern und zurückholen“: derselbe Dialog des Kerns; „Sicherung erstellen“ und „Zurückholen“ gehen in der App
  durch diese Datei. Die Bibliothek wird **Dokument für Dokument** in Stücken zu 192 KB verschlüsselt und **sofort** in die Datei geschrieben
  (WorkflowFiles begin/append/finish, danach „Speichern unter“). Im Speicher liegt höchstens ein Dokument.
- Datei: `Workflow-PDF-Pro-Sicherung-JJJJ-MM-TT-HHMM.wfps` (Fassung 2). Schloss wie im Kern: PBKDF2-SHA256 600 000 → AES-256-GCM, Passwort nur
  im Arbeitsspeicher. Jedes Stück trägt Nummer + Kopf als Zusatzdaten; ein Schluss-Stück mit den Zahlen. Vertauschen, Weglassen,
  Abschneiden und verändertes Byte werden erkannt (eigene Meldungen).
- Inhalt wie im Kern: Ordner, Dokumente (Felder, Einträge), PDF, Originalfoto ungeprüfter Dokumente („Original, ungeprüft“).
- Zurückholen fügt hinzu, überschreibt nie (Rechnung des Kerns `WFP.Sicherung.zusammenfuehren`, je Dokument). Alte Sicherungen (`.json`,
  Fassung 1) holt weiter der Kern zurück. Fortschritt mit Balken, „bitte nicht schließen“, Abbrechen.
- **Gemessen** (Chromium im Behälter, `tools/native/test-sicherung.mjs`): 60-MB-Dokument — neuer Weg ohne messbaren Zuwachs am JS-Speicher
  (Stand vorher 190 MB, darin das Probedokument), der Weg des Kerns **+≈ 900 MB**. Datei 60 MB (kein base64-Aufblähen), jeder Schreibaufruf
  ≤ 256 KB, Zurückholen Byte für Byte gleich, zweites Mal nichts doppelt.
- ⚠ Nicht am Gerät gemessen. Ob die WebView am Tablet mit 60 MB in einem Dokument zurechtkommt (ein Dokument liegt beim Sichern einmal
  ganz im Speicher), ist offen. ✅ Seit Pro-Umbau 4 läuft die Sicherung als Hintergrundaufgabe weiter (Abschnitt unten). Hier stand:
  *„Keine native Hintergrundaufgabe: die App muss offen bleiben.“*

## Einordnen erst auf Knopfdruck, „Alle prüfen“ fragt (`native/native-hintergrund.js`)
- Ist die Bedeutungssuche an, lädt der Kern beim Start das Modell — das **Einordnen wartet** aber, bis „Einordnen“ getippt ist
  (Zeile unter der Suche: „Bedeutung: N Dokument(e) noch nicht eingeordnet. Suchen geht schon.“). Eine Frage nennt die Zahl und, wenn
  schon gemessen, die Zeit. Freigabe gilt bis zum Schließen der App; neue Dokumente kommen danach wie bisher dazu. Suchen (Frage) läuft frei.
- „▶ Alle prüfen“ fragt „Alle N noch nicht geprüften Dokumente prüfen?“. In der Auswahl-Leiste (langer Druck) steht „N gewählte prüfen“
  — prüft nur die gewählten, eins nach dem anderen.
- **Durchgereichter Tipp:** Start-Knöpfe (Alle prüfen, Einordnen, Auswahl prüfen, Bedeutung einschalten, Sicherung erstellen) reagieren
  nur auf einen Tipp, der **auf ihnen begonnen** hat. Nachgestellt: ein Fenster über dem Knopf, das sich beim Antippen schließt — als PWA
  (Kern ohne Schutz) startet derselbe Tipp „Alle prüfen“ von selbst, in der App wird er verworfen (`data-wpp-tipp-verworfen`).
  Tastatur (Enter) bleibt erlaubt. ⚠ Ob genau das am Tablet passiert ist, ist nicht bewiesen — nachgestellt ist der Mechanismus.
- ⚠ Grenzen: Einordnen wirkt auf alle Dokumente, nicht auf eine Auswahl (der Kern rechnet seinen Plan selbst). ✅ Seit Pro-Umbau 4 wartet
  auch die Bildbeschreibung auf einen Tipp, und alles läuft als Hintergrundaufgabe weiter (unten). Hier stand: *„Die Bildbeschreibung
  startet weiter von selbst, wenn sie eingeschaltet ist. Keine native Hintergrundaufgabe (WebView, App offen lassen).“*

## Proben
`npm run test:native-web` (53 grün, darin `test-sicherung.mjs` 2 und `test-hintergrund.mjs` 1, je mit Gegenprobe als PWA).
Gegenprobe von Hand (Wegwerf-Änderung, wiederhergestellt): Tipp-Schutz weg · Einordnen nicht angehalten · keine Frage vor „Alle prüfen“ ·
Auswahl prüft alle → je rot.

## Pro-Umbau 4 (2026-10-28): Bildbeschreibung auf Knopfdruck, Hintergrundaufgabe

- **Bildbeschreibung wartet** (`native/native-hintergrund.js`, Teil 4): der Kern ruft nach dem Laden `WFP.Bild.start()`, wenn die Wahl gemerkt
  ist — das lud das Bildmodell (256 MB, 1,2 GB Spitze) und beschrieb alle Fotos. In der App steht stattdessen in der Bildzeile „Bildbeschreibung:
  N Foto(s) noch nicht beschrieben.“ und **„Beschreiben“**; eine Frage nennt Zahl und Größe. Danach (je Sitzung) kommen neue Fotos wie bisher
  dazu. Kern unverändert (`start` wird in der App-Schicht umhüllt; `bildbeschreibung.js` lädt vor den App-Dateien).
- **Hintergrundaufgabe** (gemeinsamer Baustein aus Private Brain Pro, `native/pro-hintergrund.js` + `de.familyprojekt.hintergrund`, siehe dort
  `docs/HINTERGRUNDAUFGABE.md`): Sicherung erstellen/zurückholen meldet sich direkt an; „Alle prüfen“, „N gewählte prüfen“, Einordnen und
  Bildbeschreibung erkennt ein Blick je Sekunde auf den Kern (`ALLE.an`, Rechenaufrufe des Einordnens, `WFP.Bild.zustand()`) und meldet sie
  an/ab. Mitteilung „Sicherung läuft“ / „Prüfen läuft“ / „Einordnen läuft“ / „Bildbeschreibung läuft“ mit Stand und „Abbrechen“:
  Sicherung bricht ab wie der Knopf, Prüfen hält nach dem laufenden Dokument, Einordnen wartet wieder auf „Einordnen“, Bildbeschreibung schaltet
  aus (wie „Abbrechen“ des Kerns).
- Befund beim Bau: nachgeholte Dokumente ordnet der Kern im Zustand **„bereit“** ein, nicht „ordnet“ — erkannt wird das Einordnen deshalb an
  laufenden Rechenaufrufen (bis 2,5 s danach). Gefunden von der Probe.
- Proben: `tools/native/test-hintergrund-dienst.mjs` (Gegenprobe als PWA: der Kern lädt das Bildmodell beim Öffnen; Bildmodell als kleines
  Modul gestellt). Gegenprobe von Hand: Bild-Schutz weg · Meldung weg · Abbruch wirkungslos → je rot. `npm run test:native-web` 54 grün (vorher 53).
- ⚠ Nicht am Gerät gemessen (Mitteilung, Energiesparen des Herstellers, Timer in verborgener WebView).

## Pro-Umbau 5 (2026-10-28): der Kern kann es selbst — Umwege entfernt

Workflow-PDF 1.1.4 (Kern, `upstream/workflow-pdf`) startet beim Öffnen nichts mehr von selbst: die Bedeutung lädt nur das Modell, ordnet erst
auf „Einordnen“ ein; die Bildbeschreibung wartet auf „Beschreiben“; „Prüfen“ und „Einordnen“ stehen nebeneinander über den Karten, wirken auf
die Auswahl oder fragen „Alle N …?“, und alle drei melden sich selbst bei `window.ProHintergrund` an. Deshalb sind aus
`native/native-hintergrund.js` entfernt, ohne Funktion zu verlieren:
- das Anhalten von `SbkimEmbedding.embedPassageBatch` und der eigene Knopf „Einordnen“ in der Bedeutungszeile,
- das Abfangen von „Alle prüfen“ mit eigener Frage und der Knopf „N gewählte prüfen“ in der Auswahl-Leiste,
- das Umhüllen von `WFP.Bild.start` und der eigene Knopf „Beschreiben“,
- der Blick je Sekunde auf den Kern für die Hintergrundaufgabe.
Geblieben ist nur der **Tipp-Schutz** (Start-Knöpfe reagieren nur auf einen Tipp, der auf ihnen begann) — den hat der Kern nicht; Liste jetzt
`[data-pruef-alle-los], [data-einordnen], [data-bild-beschreiben], [data-bed-an], #siErstellen`.
- Proben: `tools/native/test-hintergrund.mjs` (keine Umwege mehr, Einordnen wartet, Frage, Auswahl, Tipp-Schutz mit Gegenprobe als PWA) und
  `tools/native/test-hintergrund-dienst.mjs` (Bildbeschreibung wartet; Prüfen/Einordnen/Beschreiben melden sich mit Stand beim gestellten
  Android-Dienst an und ab; „Abbrechen“ aus der Mitteilung hält das Einordnen an).
- Nebenbefund: `native-ohne-web.js` ersetzte einen Hilfe-Satz, in dem „🌐“ steht. Seit den Strichgrafiken des Kerns steht er in zwei Textknoten
  (getrennt am Symbol) und wurde nicht mehr ersetzt (`test-ohne-web` war rot: „installiert“ sichtbar). Jetzt zwei Teile; fällt der zweite weg,
  geht das Symbol davor mit.
- ⚠ Nicht am Gerät gemessen.
