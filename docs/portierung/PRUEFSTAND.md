# Tatsächlich ausgeführte Ausgangsprüfungen — 20.10.2026

Quelle `7227c543d4a536cf8f3354a56fbba7574645703e`.
Quelle und Pro waren zu Beginn sauber. `git ls-remote origin refs/heads/main`
lieferte exakt die lokalen HEADs: Quelle wie oben; Pro
`5892a81ba1dafb145cc27fcc0627fac2b54b8ab5`. Seit dem im Nachfolgebrief
bezeichneten Quellstand keine Quelländerung; Pro hat gegenüber `a486d71` die
Übergabe aus PR1 ergänzt. Kein Pull/Reset und keine Änderung am Quellcheckout.

## Ausführungsumgebung

Node 24.19.0, npm 11.9.0, Debian Chromium 154.0.8037.57, System-ffmpeg.
Ausführung in `/workspace/setup/workflow-pdf-baseline`: Archiv desselben Commits,
anschließend alle 191 Dateihashes mit der Quelle und der Pro-Übernahmekopie verglichen.
Testdateien, Lockdatei, Prüfpins und Anwendungskern unverändert.

`npm ci` scheiterte zunächst an beschädigten globalen Cache-Artefakten;
mit frischem Cache erfolgreich, ebenso die wiederholte gespeicherte Einrichtung.
TLS-/Paketintegritätsprüfung blieb aktiv.
Playwright 1.56.1 verlangt normalerweise Chromium 141/build1194. Sein Download
scheiterte an `403 Domain forbidden` für `cdn.playwright.dev` und
`playwright.download.prss.microsoft.com`. Ein externer Node-Preload setzt für
`chromium.launch` ausdrücklich `/usr/bin/chromium`. Versionsunterschied ist eine
Prüfgrenze; es wurde keine Browserrichtlinie deaktiviert.

## Ergebnis

Die echte `npm test`-Kette wurde ausgeführt und brach mit Rückgabe 1 im dritten
Skript `e2e.mjs` ab: 34 Aussagen bestanden, dann blockierte Chromium die erzeugte
lokale HTML-Datei (`file://…/html.html`, `ERR_BLOCKED_BY_ADMINISTRATOR`). Die nach
jener Navigation liegenden e2e-Prüfungen wurden nicht ausgeführt. Das ist kein
vollständig grüner Ausgangslauf und kein belegter Anwendungsfehler.

Danach wurden **alle 28 vorhandenen Skripte einzeln** ausgeführt, damit die
verbleibenden Prüfungen nicht von der &&-Abbruchstelle verdeckt werden.
Erster Einzel-Durchgang: 26 erfolgreich, e2e fehlgeschlagen, kreis übersprungen
(trotz dessen Rückgabe 0: FreeSans fehlte).

FreeSans wurde danach aus `fonts-freefont-ttf 20211204+svn4273-2` über einen
APT-verifizierten, signierten Debian-trixie-Paketindex bezogen und lokal ausgepackt.
Systeminstallation ist ohne sudo/System-Schreibrechte nicht möglich. Der externe
Preload `font-path.mjs` leitet nur den fest kodierten Testschriftpfad auf dieselbe
echte Schrift im Arbeitsverzeichnis um; keine Glyphen, Antworten oder Assertions
werden ersetzt. Erneuter `kreis.mjs`-Lauf: **16 grün, 0 ROT**, Rückgabe 0.
Damit liegen für **27 der 28 Skripte erfolgreiche Einzelläufe** vor; e2e bleibt
unvollständig. Kein vollständiger nativer oder Geräte-Test fand statt.

| Skript | Erster Einzellauf | Schlussbefund |
|---|---|---|
| `syntax.mjs` | 72 grün · 0 ROT | bestanden |
| `manifest-id.mjs` | 6 grün · 0 ROT | bestanden |
| `e2e.mjs` | 34 grün · 1 ROT | fehlgeschlagen/unvollständig |
| `uebersetzung.mjs` | 56 grün · 0 ROT | bestanden |
| `layout.mjs` | 21 grün · 0 ROT | bestanden |
| `behoerde.mjs` | 46 grün · 0 ROT | bestanden |
| `chrome.mjs` | 47 grün · 0 ROT | bestanden |
| `schrift.mjs` | 5 grün · 0 ROT | bestanden |
| `beispiele.mjs` | 17 grün · 0 ROT | bestanden |
| `sprache.mjs` | 49 grün · 0 ROT | bestanden |
| `suche.mjs` | 59 grün · 0 ROT | bestanden |
| `bedeutung.mjs` | 80 grün · 0 ROT | bestanden |
| `teile.mjs` | 28 grün · 0 ROT | bestanden |
| `ordner.mjs` | 21 grün · 0 ROT | bestanden |
| `bilder.mjs` | 20 grün · 0 ROT | bestanden |
| `kreis.mjs` |   ⊘ nicht lauffähig: keine Schrift mit Kreis-Zeichen (/usr/share/fonts/truetype/freefont/FreeSans.ttf) | Nachlauf bestanden: 16 grün / 0 ROT (Schriftpfad-Override) |
| `scan.mjs` | 119 grün · 0 ROT | bestanden |
| `sprechen.mjs` | 42 grün · 0 ROT | bestanden |
| `bibliothek.mjs` | 90 grün · 0 ROT | bestanden |
| `teilen.mjs` | 53 grün · 0 ROT | bestanden |
| `schieber.mjs` | 30 grün · 0 ROT | bestanden |
| `video.mjs` | 79 grün · 0 ROT | bestanden |
| `eingang.mjs` | 73 grün · 0 ROT | bestanden |
| `sicherung.mjs` | 50 grün · 0 ROT | bestanden |
| `teilen-empfang.mjs` | 22 grün · 0 ROT | bestanden |
| `zuschneiden.mjs` | 17 grün · 0 ROT | bestanden |
| `knoten.mjs` | 126 grün · 0 ROT | bestanden |
| `reinigung.mjs` | 62 grün · 0 ROT | bestanden |

Die vollständigen Ausgaben stehen in `nachweise/`, einschließlich des ersten
`npm test`-Laufs und des getrennten FreeSans-Nachlaufs. Vorhandene Tests enthalten
Stellvertreter: insbesondere KI-Antworten, Chrome-Seitenübersetzung,
Bedeutungsmodell und Spracherkennung. Ihr Erfolg belegt diese Abläufe unter den
Testbedingungen, keine echten Anbieterantworten oder Modellqualität.

## Mengenmessung (neu ausgeführt)

`npm run messen`, Rückgabe 0, Standardziele 400 digitale Seiten und 10 Scans:

| Ziel | Lesen + Übersetzen + Speichern | PDF bauen | Ergebnis | Spitze |
|---|---|---|---|---|
| 400 Seiten / 4400 Absätze | 14,5 s; 36 ms/Seite | 127,9 s | 1,06 MB; Eingang 0,34 MB | 132 MB |
| 10 Scans / 130 Absätze | 17,9 s; 1789 ms/Seite | 1,8 s | 2,76 MB; Eingang 2,51 MB | 173 MB |

Der Mengenrunner verwendet einen unmittelbar antwortenden Übersetzer. Das misst
**keine echte Übersetzungsdauer oder Qualität**, keine API-Kosten und kein Tablet.
Die OCR der Scanprobe ist echt. Zwischenstände: 1,63 MB bzw. 0,04 MB.

## Browser-API-Messung (neu, keine Attrappe)

App lokal gestartet und Bibliotheksstart geprüft. Chromium 154 meldet an diesem
sicheren lokalen Ursprung `Translator` als Funktion; alle sechs DE/RU/EN-Paare
liefern `downloadable`. `SpeechRecognition` ist als Funktion vorhanden;
`navigator.share`/`canShare` fehlen. IndexedDB/Service Worker sind vorhanden.
Es wurde **kein Sprachpaket geladen und kein echter Text übersetzt**.
Das widerlegt nicht frühere Messungen mit Chromium 141 und ersetzt keine
WebView-/Zielgerätemessung. Rohbefund: `nachweise/browser-capabilities.json`.

Der dokumentierte Python-Start wurde zusätzlich ausgeführt: App-HTML, russische
OCR-Sprachdatei und Scanic-Worker mit HTTP 200 gelesen; `.mjs` wird als
`text/javascript` ausgeliefert. Der gestartete Server wurde wieder beendet.

## Bytegleichheit und Gegenprobe (neu)

`verify-upstream.mjs`: 191/191 Dateien in `upstream/workflow-pdf` stimmen mit dem
Quellmanifest überein, ebenso der unveränderte Quellcheckout und die Prüfkopie.
Synthetische Gegenprobe in einer Wegwerfkopie: ein angehängter Kommentar in
`assets/pruefer-mail.js` führt zu Rückgabe 1 und genau dieser gemeldeten Datei.
Keine Prüfpins wurden geändert. Die 17 eindeutigen gepinnten Prüfer-/SBKIM-/
Tresordateien werden zusätzlich von den bestandenen Originaltests geschützt.

## Offen vor Freigabe

- e2e vollständig in einer geeigneten, freigegebenen Browserumgebung ausführen;
  die verwaltete Dateinavigationssperre hier nicht umgehen.
- Zielplattformen, Geräte und Chrome-Transport entscheiden; siehe ENTSCHEIDUNGEN.md.
- Native Adapter, Builds, Lint/Plattformtests, signiertes Installieren/Update,
  Datenerhalt, echter Übersetzer/Modell/Kamera/Teilen/Drucken noch offen.
- Kein SDK/adb/xcodebuild oder angeschlossenes Zielgerät gefunden; `/dev/kvm`
  fehlt. Plattformwerkzeuge erst passend zur Plattformentscheidung einrichten.
- Kein Signierschlüssel erzeugt/übernommen, kein Installer und keine
  Veröffentlichung. Referenz-Prüfungen wurden nicht als Workflow-PDF-Prüfungen gezählt.

## Nach Klaus’ Entscheidung für A (20.10.2026)

Plattformfolge festgehalten: Android/Samsung DeX zuerst, danach Windows, dann iOS.
Variante A ist zur Erprobung freigegeben. 11 neue Transport-/Browserprüfungen
bestanden, 0 fehlgeschlagen/übersprungen, einschließlich ursprünglicher
Reinigung mit Abbruch ohne Senden und PDF-Erstellung aus rückübertragenen
Absätzen im unveränderten App-Kern. Echte HTTP-Verbindungen, echte getrennte
Browserkontexte; **nur die Übersetzung des Chrome-DOM ist simuliert**.
Details und offene Android-/Gerätenachweise: `native/chrome/README.md` im Pro-Repo.
Originalquelle und Übernahmekopie weiterhin 191/191 Hashes unverändert.
Keine erneute vollständige Ausgangstestkette behauptet.
