# Abschluss: Versionsnummer, „Alle prüfen“, Erklärvideo mit Prüfteil, Android und Windows 1.0.3

**Sitzung:** Claude Code, `session_01B4oBviErACQexqctbJbz76`, 22.10.2026.
**Auftrag:** Klaus, 22.10.2026, `BRIEF_NACHFOLGE_2026-10-22_VERSION-UND-VIDEO.md`.

## Zeitnachweis (gemessen, UTC)

| Punkt | Zeit | Beleg |
|---|---|---|
| Beginn | 2026-10-22T13:41:35Z | Reflog Workflow-PDF-Pro, erster Eintrag dieser Sitzung (`1a31272`) |
| Kern auf main | 2026-10-22T14:16:39Z | Workflow-PDF `db3830e` (#130) |
| Pro auf main | 2026-10-22T14:56:45Z | Workflow-PDF-Pro `4bf83ef` (#16) |
| Video auf main | 2026-10-22T15:23:02Z | Workfloh-PDF-Page `e9bff22` (#18) |
| Android-Release fertig | 2026-10-22T15:58:11Z | Lauf 39807912821 |
| Ende | Commit dieses Briefs | im Kimhub-Eintrag festgehalten |

Spanne ist eine Obergrenze; Wartezeiten auf CI sind nicht abgezogen.

## Klaus' Antworten auf die Fragen des Briefs

1. Webversion: **eigene Nummer** (jetzt 1.1.0), die App ihre App-Nummer.
2. „Treten, Rad“: das **drehende Zeichen** während der Prüfung — „nur deutlicher, vielleicht mit einer
   Vergrößerung“. Dazu: „auch die Stelle … innerhalb der Datei, damit ich sehe, da starte ich die Prüfung“.
3. Der neue Teil steht **bei der Prüfung** (Kapitel 3, nach „Einlesen“).

## Ergebnis

1. **Workflow-PDF 1.1.0** (#130, live über GitHub Pages):
   - Versionsnummer unter „Impressum & Datenschutz“ und ganz unten in den Einstellungen.
     Eine Quelle: `<meta name="wfp-version">`; `tests/version.mjs` hält sie gleich `package.json`
     und `CACHE_VERSION`.
   - „▶ Alle prüfen“: alle ungeprüften Dokumente nacheinander, Fortschritt, Abbruch, nur sichtbar
     bei Ungeprüften, kein Fenster mitten im Lauf. DE/EN/RU/AR.
   - Proben: `npm test` grün; Gegenproben 5 (ALLE) + 7 (Version) gefangen, 0 durchgerutscht.
   - `tests/teilen.mjs`: die Leiste macht die Seite höher; der Mauszug rollt jetzt vorher nach oben
     (wie schon der Fingerzug). Auf main grün, mit Leiste ohne diese Zeile rot — gemessen.
2. **Workflow-PDF-Pro** (#16): Kern bytegleich (`verify-upstream` 193/0). App-Nummer aus Android
   (`versionName`) bzw. Tauri. Windows-Releaseablauf unsigniert ohne Updater, Git-Brücke
   `release-requests/windows-vX.Y.Z`.
   - **Android 1.0.3:** [v1.0.3](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/v1.0.3),
     APK 83.130.678 Bytes, SHA-256 `d90860d8…1975`, gleiches Zertifikat. Download verglichen.
   - **Windows 1.0.3:** [windows-v1.0.3](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/tag/windows-v1.0.3),
     15.854.566 Bytes, SHA-256 `4795946f…ea68`, unsigniert. Download verglichen.
3. **Erklärvideo** (#18, Workfloh-PDF-Page): neue Szene „Prüfen“ in allen sechs Fassungen
   (DE/EN/RU, quer und hochvoll, je Sprache gleich lang: 274,0 / 274,6 / 272,6 s):
   gelber Punkt im geöffneten Dokument, Tipp, Rad stark vergrößert, Prüfbericht; Punkt an der Karte;
   „Alle prüfen“ mit „Prüfe Dokument X von 3 …“ vergrößert.
4. **Musik:** gemessen vorher ~1 s bei −62 dB um 148 s und Neustart des Titels mitten in „Übersetzen“.
   Jetzt Sprung 121 s → 49 s mit 1,2 s Überblendung (gemessene Periode 72,0 s). Alle sechs MP4:
   kein 0,5-s-Fenster unter −40 dB. Die Musikdatei lag nicht vor (Pixabay gesperrt); sie wurde aus den
   sechs alten MP4 zurückgewonnen (Median je Abtastwert, Klicks fallen weg) und liegt NICHT im Repo.
5. **Geschenkseite** (Artifact) zeigt Android und Windows 1.0.3.

## Befunde (Auswahl)

- Ein Tipp direkt nach dem Zurückzoomen ging daneben: die Bühnenkamera fährt 1,1 s zurück. Wartezeit 1,25 s.
- Das schräge Testfoto ergibt ehrlich „? Nicht ganz geprüft“ (14 unsicher gelesene Zeilen); für die
  Vorführung „Alle prüfen“ sind deshalb zwei Formular-PDFs genommen.
- Russisch hochkant: die Editor-Leiste rollt waagrecht, „← Библиотека“ lag außerhalb, der Finger traf das
  Mycel-Lämpchen. `zurBibliothek` rollt vorher an den Anfang. Das ist auch ein App-Befund: im
  russischen Hochformat ist „zurück zur Bibliothek“ ohne Rollen nicht sichtbar.
- Android-12-Emulator in `native-acceptance` wacklig (zwei verschiedene Ausfälle hintereinander,
  auch ohne diese Änderung). Ursache nicht behoben; Wiederholung grün.
- Windows-Abnahme prüfte die Version fest auf „1.0.2“; jetzt aus `tauri.conf.json`.

## Offen

- Klaus' Sichttest am Tablet (Android 1.0.3, Video hochkant) und am Windows-PC (1.0.3).
- Vom Prüfteil im fertigen Video sind nur Standbilder der deutschen Querfassung angesehen.
- Fünf sehr helle Folien am Videoende und eine ruhige Stelle von ~5,6 s beim Übersetzen: unverändert.
- Ein `Seitenfehler` (getBoundingClientRect von null) erscheint bei jeder Aufnahme am Übergang
  Prüfen → Ausfüllen; die Aufnahme läuft weiter, Ursache nicht gesucht.
- Ein Buch mit 400 Seiten in „Alle prüfen“ ist nicht gemessen.
- iOS bleibt der nächste große Schritt (`BRIEF_NACHFOLGE_2026-10-22_IOS.md`).
