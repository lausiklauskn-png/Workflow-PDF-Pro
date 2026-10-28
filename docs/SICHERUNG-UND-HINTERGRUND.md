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
  ganz im Speicher), ist offen. Keine native Hintergrundaufgabe: die App muss offen bleiben.

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
- ⚠ Grenzen: Einordnen wirkt auf alle Dokumente, nicht auf eine Auswahl (der Kern rechnet seinen Plan selbst). Die Bildbeschreibung
  startet weiter von selbst, wenn sie eingeschaltet ist. Keine native Hintergrundaufgabe (WebView, App offen lassen).

## Proben
`npm run test:native-web` (53 grün, darin `test-sicherung.mjs` 2 und `test-hintergrund.mjs` 1, je mit Gegenprobe als PWA).
Gegenprobe von Hand (Wegwerf-Änderung, wiederhergestellt): Tipp-Schutz weg · Einordnen nicht angehalten · keine Frage vor „Alle prüfen“ ·
Auswahl prüft alle → je rot.
