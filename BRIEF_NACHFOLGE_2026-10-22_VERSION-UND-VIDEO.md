# Brief: Versionsnummer sichtbar, Knopf „Alle prüfen“, Erklärvideo mit Prüfteil

**Von:** Claude-Code-Sitzung vom 22.10.2026 (`session_01RyZfm7xfj7vsZnGGohhrFY`).
**Für:** die nächste Sitzung. **Auftrag:** Klaus, 22.10.2026.

Dieser Auftrag ist neuer als der iOS-Brief vom selben Tag. Klaus hat ihn ausdrücklich
für die nächste Sitzung bestimmt. iOS bleibt geplant. Wenn die Reihenfolge unklar ist,
Klaus kurz fragen.

## Klaus' Auftrag (sinngemäß vollständig, aus der Spracheingabe)

> „Es steht in Workflow PDF Pro keine Versionsnummer. Gerade bei der Pro sollte es
> wichtig sein, da nicht alle 5 Tage eine neue Version kommt. Und wenn es in kürzeren
> Abständen kommt, kann man prüfen, ob es sich um eine ältere oder jüngere Version
> handelt. Das sollte unten bei dem Impressum und beim Datenschutz stehen und nochmal
> hinten in den Einstellungen.“
>
> „Im Video, und zwar in dem Hauptvideo, wo die Funktionsweise erklärt wird, mit dem
> Finger, der Musik und so weiter: ein separates Erklärteil, wo erklärt wird, dass man
> mit dem Finger die Prüfung der einzelnen Dokumente aktivieren muss. Dafür sollte es
> noch einen Knopf geben: alle Dokumente prüfen. Bisher muss man unten einzeln anklicken,
> und dann findet die Prüfung statt. Das sollte man im Video sehen, wenn mit dem Finger
> auf den gelben Prüfpunkt unten geklickt wird und wenn man auf ‚Alle prüfen‘ drückt.
> Dabei sollte auch die Funktion mit Treten, Rad und allem zu erkennen sein. Das ist nur
> ein kleiner Teil im Video, maximal 2 Blätter oder 2 Seiten. Entscheide selber.
> Wichtig: die Musik strecken, keine Aussetzer, notfalls Wiederholung der Musik. Die
> Musik wird am Ende schon wiederholt, das Video hat leere Zeiten, und es gab wohl auch
> leere Seiten dazwischen. Die Musik bitte nochmal anpassen.“
>
> „Gleichzeitig: Workflow PDF Pro (das Repo) mit Windows und Android, dort das Video
> anpassen. Und für Workflow PDF, das Repo.“

## Pflichtlektüre

1. `Workflow-PDF/CLAUDE.md`:
   - § „▶ Prüfen erst auf Knopfdruck“ (Einzelprüfung, `pruefungNachholen([id])`,
     `[data-pruef-nachholen]`)
   - § „🎬 Erklärvideo aus der Hilfe“
   - § „⚖️ Impressum & Datenschutz“
2. `Workflow-PDF/docs/sessions/BRIEF_2026-10-06_erklaervideo-pruefung.md`. Er beschreibt,
   wie das letzte Video gebaut und abgelegt wurde, und was gezeigt bzw. nicht behauptet
   werden darf.
3. **Workfloh-PDF-Page**: Dort werden die Videos gebaut (`video/*.mjs`) und abgelegt
   (`assets/workfloh-pdf-quer*.mp4`, `-hochvoll*`, `neu-befehle-*`).
   - Das Repo per `list_repos` (Suchwort „Workfloh“) finden und mit `add_repo` holen.
   - Nicht behaupten, dass es fehlt, ohne nachzusehen.
4. Dieses Repo: `AGENTS.md`, `docs/FOLGESITZUNG.md`, `docs/SIGNIERUNG-UND-GITHUB.md` und
   den Abschluss `BRIEF_ABSCHLUSS_2026-10-22_ERSATZSCHLUESSEL.md`.

Vor jeder Arbeit `git fetch origin` in jedem Repo. Offene PRs und `git log origin/main`
prüfen, ob Codex parallel arbeitet.

## Stand (gemessen am 22.10.2026)

- **Versionsnummer:**
  - Workflow PDF zeigt nirgends eine Version. Im Fuß steht nur `#rechtFuss` mit
    „Impressum & Datenschutz“ (`index.html` Zeile 97).
  - Vorhanden sind `CACHE_VERSION = 'workfloh-pdf-v104'` (`sw.js`) und
    `package.json` 1.0.0.
  - Die Pro (Android 1.0.2 / versionCode 3, Windows 1.0.1 veröffentlicht, Quellstand
    1.0.2) zeigt ebenfalls keine Version. `native/*.js` liest keine App-Version aus.
- **Prüfen:**
  - Jedes ungeprüfte PDF oder Foto trägt an der Karte „○ Noch nicht geprüft · jetzt
    prüfen“. Ein Tipp prüft genau dieses Dokument. Einen Knopf für alle gibt es nicht.
  - `pruefungNachholen` nimmt schon eine Liste von IDs.
- **Video:**
  - Hauptvideo `workfloh-pdf-quer{,-en,-ru}.mp4` und `-hochvoll*`, dazu der angeheftete
    Film „Versteckte Befehle erkennen“ (72,5 s).
  - Quer und hoch müssen je Szene gleich lang sein (`tests/video.mjs` 3b).
  - Kapitelsekunden stehen doppelt: `KAPITEL_NEU` in `app.js` und `KAPITEL` auf der
    Webseite.
- **Pro übernimmt den Webkern bytegleich:** Workflow-PDF wird nach
  `upstream/workflow-pdf` kopiert und mit `node tools/onboarding/verify-upstream.mjs`
  geprüft. Eine Änderung im Kern wird also in Workflow-PDF gemacht und dann übernommen.
  Sie erreicht Android und Windows nur über eine neue App-Version.

## Was gebaut werden soll

1. **Versionsnummer**
   - Sichtbar im Fuß neben „Impressum & Datenschutz“ und in den Einstellungen (ganz
     unten). Die Pro zeigt ihre App-Version (z. B. „Version 1.0.3“, unter Android aus
     dem Paket, unter Windows aus Tauri). Die PWA zeigt ihre eigene Version.
   - Eine einzige Quelle je Ausgabe, nicht von Hand an mehreren Stellen gepflegt.
   - Mit einer Probe, die eine falsche oder fehlende Nummer rot meldet.
   - Ob die PWA eine eigene Zählung (z. B. aus `CACHE_VERSION`) oder eine echte
     Versionsnummer bekommt, vorher mit Klaus klären (Frage 1).
2. **Knopf „Alle prüfen“**
   - Er prüft alle noch ungeprüften Dokumente nacheinander, mit sichtbarem Fortschritt
     und Abbruch.
   - Er ist nur sichtbar, wenn es ungeprüfte gibt.
   - Bei einem 400-Seiten-Buch nicht einfrieren, Speicher beachten.
   - DE/EN/RU/AR.
   - Proben in `tests/eingang.mjs` mit Gegenprobe.
3. **Erklärteil im Hauptvideo**
   - Höchstens zwei Szenen: (a) der Finger tippt den gelben Prüfpunkt an der Karte,
     (b) der Finger tippt „Alle prüfen“.
   - Dazu sichtbar, wie geprüft wird und der Bericht erscheint. „Treten, Rad“ ist
     unklar, siehe Frage 2.
   - Aufnahmen von der echten App, kein nachgebautes Bild.
   - Gleicher Stil wie das bestehende Hauptvideo.
   - DE/EN/RU, quer und hochvoll szenengenau gleich lang.
4. **Musik**
   - Über die ganze Länge ohne Aussetzer und ohne stille Stellen.
   - Leere Stellen und leere Seiten im bestehenden Video vorher **messen** (Pegel über
     die Zeit, Standbilder) und benennen, nicht annehmen.
   - Wenn die Musik zu kurz ist: sauber geschnitten wiederholen oder strecken, mit
     Überblendung an der Naht.
5. **Ausliefern**
   - **Workflow-PDF**: Kern ändern, `CACHE_VERSION` und `?v=` hochzählen, `npm test`.
   - **Workfloh-PDF-Page**: Videos unter denselben Dateinamen ersetzen, sonst bricht der
     🎬-Knopf. Vorschaubilder neu bauen, Kapitelsekunden auf beiden Seiten nachziehen.
   - **Workflow-PDF-Pro**:
     - Kern nach `upstream/` übernehmen und `verify-upstream` prüfen.
     - Versionsanzeige in Android und Windows einbauen.
     - Android 1.0.3 über den bestehenden Release-Workflow veröffentlichen: Version und
       versionCode steigen, `native-acceptance` muss auf dem main-Commit grün sein.
     - Windows: erst `windows-release.yml` auf einen unsignierten manuellen Installer
       ohne Updater umbauen (siehe Windows-Abschluss), dann Windows 1.0.2 oder 1.0.3.
       Ohne diesen Umbau nicht veröffentlichen und keine Signierung vortäuschen.
   - Geschenkseite (Artifact `https://claude.ai/artifact/7dK5kDLqY4tmKqzU9jK4aA`): die
     Versionen nachziehen.

## Fragen an Klaus (vor dem Bau, kurz und einfach)

1. Soll die Webversion (PWA) dieselbe Nummer tragen wie die App, oder eine eigene?
2. Was ist mit „Treten, Rad“ gemeint? Vermutlich das sich drehende Zeichen während der
   Prüfung und die Schritte, bis der Bericht kommt. Kurz nachfragen statt raten.
3. Soll der neue Teil im Hauptvideo an der Stelle der Prüfung stehen oder ans Ende?

## Grenzen und Regeln

- Ehrlich bleiben wie im Brief vom 06.10.: kein „Virenschutz“, keine Technikbegriffe,
  keine Zahlen zu Schwellen.
- Keine Schlüssel, Token oder Passwörter in Git oder Chat. Nie „von Microsoft geprüft“
  schreiben.
- Android-Signieridentität und App-Identität nie ersetzen.
- Klaus spricht Deutsch, liest am Handy: kurze, einfache Sätze, am Ende ein
  Download-Link.

## Abnahme

- Die Versionsnummer steht im Fuß und in den Einstellungen, in PWA, Android und Windows.
  Eine Probe prüft sie.
- „Alle prüfen“ prüft alle ungeprüften Dokumente, zeigt den Fortschritt und lässt sich
  abbrechen. Proben und Gegenprobe sind grün.
- Das Video zeigt beide Wege mit dem Finger. Die Musik hat keine Lücke (gemessen). Quer
  und hoch sind je Szene gleich lang; `tests/video.mjs` ist grün.
- Android 1.0.3 ist veröffentlicht und der Download verglichen. Windows ist nur
  veröffentlicht, wenn der Releaseablauf passend umgebaut ist.
- Klaus' Sichttest am Tablet und am Windows-PC steht aus und wird so benannt.

## Abschluss (Pflicht)

Am Ende stehen:

- ein Abschlussbrief mit gemessenem Zeitnachweis (Reflog-Beginn, letzter Commit, UTC),
- ein Forschungseintrag in Kimhub (`node tools/sitzung-eintragen.mjs`, `arm: "voll"`,
  `ende` nach dem letzten Commit),
- ein neuer Brief, auch als Codeblock im Chat.
