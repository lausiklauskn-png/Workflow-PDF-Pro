# Gemeinsamer Tresorordner (`de.familyprojekt.tresor`) — Schritt B

Klaus (2026-10-26/27): ein Ordner für alle Pro-Apps (Private Brain Pro, Workflow PDF Pro, BookLedgerPro), **ein Passwort,
ein Ersatzschlüssel**; vorhandene Tresore ziehen ein, ohne neu verschlüsselt zu werden. **Gepflegt wird das Paket hier**
(Klaus' Wahl 2026-10-27); BookLedgerPro und Private Brain Pro kopieren es byte-gleich und pinnen es.

## Was es ist

Reines Java ohne Fremdbibliothek (eigenes kleines JSON, Hex statt Base64): läuft auf Android, auf der JVM (Proben) und in der
Windows-Java-Engine von Private Brain Pro. Einzige Android-Datei ist `SafAblage.java` (Speicherzugriff über die Ordnerwahl).

| Datei | Aufgabe |
|---|---|
| `VaultCrypto.java` | das Schloss PBV1 — **bis auf die `package`-Zeile byte-gleich** mit Workflow PDF Pro und Private Brain Pro (Rumpf-SHA-256 `a12fb6d5…`, von `tools/tresor/pins.mjs` geprüft) |
| `TresorOrdner.java` | Kopf, Hauptschlüssel, Passwort- und Ersatzplätze, Fach-Schlüssel, Dateien, Inhaltsverzeichnis, Marken |
| `Fach.java` | die neun Fächer und wer schreiben darf |
| `Eintrag.java` | eine Zeile im Inhaltsverzeichnis (gleiches Format für alle Apps) |
| `Ersatzschluessel.java` | Shamir 5/3, gleiche Rechnung wie `VaultRecovery`, Vorsilbe `FPT1-` |
| `Ablage.java`, `DateiAblage.java`, `SafAblage.java` | der gewählte Ordner: Schnittstelle, java.io.File, Android-SAF |
| `Json.java` | kleines JSON (Objekte, Listen, Texte, ganze Zahlen) |

## Format `familyprojekt-tresorordner`, Version 1

```
<gewählter Ordner>/
  tresorordner.json                              Kopf: Kennung, Prüfwert (HMAC) des Hauptschlüssels — kein Schlüssel
  Tresorordner/kennwort-<uuid>.json              Hauptschlüssel, verpackt mit dem Passwort (PBKDF2-HMAC-SHA256 600 000, AES-256-GCM)
  Tresorordner/ersatz-<satz>.json                Hauptschlüssel, verpackt mit dem Ersatzschlüssel (5 Teile, 3 genügen)
  Tresorordner/fach-<fach>.json                  Fach-Schlüssel, verpackt mit dem Hauptschlüssel
  Tresorordner/verzeichnis/<fach>/<app>/v-<nummer>-<uuid>.fpt   Inhaltsverzeichnis (PBV1, Fach-Schlüssel), je Schreiber
  Tresorordner/marken/<app>/<fach>--<eintrag>.json             „übernommen“-Marken
  Private Brain/  Workflow PDF Pro/  BookLedgerPro/  Eingang-BookLedgerPro/  Eingang-WorkflowPDF/
  Private Brain V3/  Familienakte/  Eingang-Familienakte/      (seit 2026-10-31)
  Eingang-Private-Brain/                                      (seit 2026-11-01)
```

- Jede Verpackung ist an Kennung, Art und Teil gebunden (`familyprojekt-tresorordner|<id>|kennwort|<platz>|<runden>`,
  `…|ersatz|<satz>`, `…|fach|<fach>`, `…|verzeichnis|<fach>|<app>|<nummer>`, `…|datei|<fach>|<uuid>`): eine Datei lässt sich
  nicht unter anderem Namen, in einem anderen Fach oder als älterer Stand unterschieben.
- **Einziehen** eines vorhandenen App-Tresors (`fachEinziehen`): nur dessen Datenschlüssel wird zusätzlich mit dem
  Hauptschlüssel verpackt. Keine Datei im Fach wird gelesen, geschrieben oder gelöscht.
- **Passwort ändern**: neuer Platz, zur Probe geöffnet, dann verschwinden die alten Plätze. Billig, weil nur der Hauptschlüssel
  neu verpackt wird. ⚠ Wer den entsperrten Schlüssel schon hatte (oder eine Kopie eines alten Platzes), bleibt drin; echtes
  Aussperren hieße neue Fach-Schlüssel und alles neu verschlüsseln.
- **Ersatzschlüssel** gilt für den Hauptschlüssel, also für alle Apps zugleich. Ein neuer Satz ersetzt den alten erst, wenn er
  geprüft geschrieben ist. Wiederherstellen setzt ein neues Passwort; die alten Passwort-Plätze gehen.
- **Rechte**: lesen darf jede App jedes Fach. Schreiben nur ins eigene Fach und in die Übergabefächer. Gelöscht werden nur eigene
  Verwaltungsdateien unter `Tresorordner/` (alte Plätze, ältere eigene Verzeichnis-Stände über drei) und eine in derselben
  Sitzung selbst angelegte, beim Prüfen durchgefallene Datei — **nie etwas in einem Fach**. „Übernommen“ ist eine Marke-Datei.
- **Inhaltsverzeichnis** je Fach und Schreiber (`id, name, art, datum, groesse, auszug ≤ 1000 Zeichen, verweis, schreiber,
  verschluesselung, sha256`). `fpt1` = Datei im gemeinsamen Format, jede App kann sie öffnen; `app` = Datei im App-eigenen Format
  (z. B. Private Brains HMAC-Namen) — andere Apps zeigen nur die Zeile. Übergabefächer sammeln die Stände aller Schreiber.
- Ein beschädigter neuester Stand wird gemeldet (`TRESOR_BESCHAEDIGT`), nicht still durch einen älteren ersetzt.

## Proben

```bash
node tools/tresor/pins.mjs                                  # Pins + VaultCrypto-Rumpf (CI: native-foundation, web-core)
cd android && ./gradlew testReleaseUnitTest                 # TresorOrdnerTest (CI: android-foundation)
TRESOR_JARS=<junit+hamcrest> node tools/tresor/gegenprobe.mjs   # baut Fehler ein, jede Probe muss rot werden
```

`TresorOrdnerTest` (9 Fälle, gestellter Ordner): falsches Passwort ändert nichts (Fingerabdruck aller Dateien gleich) ·
Passwortwechsel nimmt dem alten die Macht · Ersatzschlüssel öffnet mit Dreierkombinationen, zwei Teile nicht, Tippfehler und
fremde Teile nicht · Umzug eines nachgestellten Private-Brain-Tresors lässt jede Datei byte-gleich, eine andere App liest danach
dessen Dateien · fremdes Fach lesbar, nie beschrieben, nie gelöscht (Mitschrift jedes Löschens) · Übergabefach sammelt zwei
Schreiber · Bitkipper, umgebogener Eintrag, zurückgespielter Stand und fremder Prüfwert im Kopf werden erkannt · JSON.

Gemessen 2026-10-27 im Behälter (JDK 21, JUnit 4.13.2 ohne Gradle): **9 grün**; Gegenprobe **9 gefangen · 0 durchgerutscht**
(ein Fall war zuerst blind: das Zurückspielen ist doppelt gesichert — Nummer in der Verschlüsselung gebunden und im Inhalt;
die Gegenprobe nimmt jetzt beide weg).

## Grenzen (benannt)

- `SafAblage` ist im Behälter nicht übersetzt (kein Android-SDK); sie wird im Android-Lauf gebaut und gelintet, aber erst mit
  dem Plugin in Schritt C/D im Emulator gefahren. Nicht am Tablet, nicht an Klaus' SD-Karte.
- Workflow PDF Pro selbst nutzt das Paket noch nicht (Schritt D: Plugin, Einzug des eigenen Tresors, Gleichstand).
- **Windows**: kein Rust-Zwilling in `windows/core` bisher — Lücke für die Windows-Sitzung (Gleichstandsregel). Private Brain Pros
  Windows-Engine ist Java und kann das Paket direkt nehmen (`DateiAblage`).
- Zwei Apps, die gleichzeitig dasselbe Fach zum ersten Mal anlegen: die zweite nimmt den Schlüssel der ersten (Datei schon da).
  Echte Gleichzeitigkeit auf einer SD-Karte ist nicht gemessen.

## Schritt D1: Workflow PDF Pro zieht ein (27.10.2026)

Klaus' Wahl: der Knopf steht im **Tresor-Kasten der Einstellungen** („Speicher und Dokumenttresor“), sichtbar nur bei entsperrtem
Dokumenttresor. Probe zuerst an einer **Kopie** der SD-Karte (Dateien-App), erst dann der echte Ordner.

| Zustand | Anzeige | Knopf |
|---|---|---|
| noch nicht eingezogen | Erklärung (ein Passwort für alle Pro-Apps, Probe an einer Kopie, nur zwei neue Einträge) | **In den Tresorordner einziehen …** |
| eingezogen, offen | „Mit dem Tresorordner verbunden: <Ordner> · Einträge im Inhaltsverzeichnis: N“ | Inhaltsverzeichnis jetzt schreiben · Tresorordner sperren · Anderen Tresorordner wählen … |
| eingezogen, gesperrt | „Tresorordner gesperrt: <Ordner>“ | Tresorordner entsperren … · Anderen … |
| nicht erreichbar | „… nicht erreichbar (SD-Karte eingelegt?)“ | Anderen … |

**Ablauf:** Androids Ordnerwahl → gewählt wird die Ebene **über** „Workflow PDF Pro“. Sie passt nur, wenn darin genau der entsperrte
Tresor liegt (gleiche Kennung im Kopf `workflow-pdf-pro.tresor.json`) — eine byte-gleiche Kopie passt also auch; das macht die Probe
möglich, ohne die App auf die Kopie umzustellen. Sonst klare Meldung und nichts geschrieben: kein „Workflow PDF Pro“ darin · der
Ordner „Workflow PDF Pro“ selbst gewählt (Ebene darüber freigeben) · anderer Tresor · schon ein anderer Workflow-Tresor eingezogen.
Dann das Passwort **im Android-Fenster** (anlegen: zweimal + Hinweis; öffnen: einmal; „Auf diesem Gerät entsperrt halten“ merkt den
Hauptschlüssel im Android-Schlüsselspeicher, eigener Alias). `fachEinziehen("workflow-pdf-pro", Datenschlüssel)` + Eingangsfach
`Eingang-WorkflowPDF` anlegen. Rückweg: `tresorordner.json`, `Tresorordner/` und den leeren `Eingang-WorkflowPDF/` löschen.

**Inhaltsverzeichnis:** aus der Bibliothek (`docs` + `texte`): je Dokument Name (`.pdf`), Datum, Größe und SHA-256 der Datei
(aus dem Satz-Index, ohne die Datei zu lesen), Seitentext-Auszug ≤ 1000 Zeichen, `verweis: docs/<id>`, `verschluesselung: "app"`
(andere Apps zeigen nur die Zeile). Geschrieben nach dem Einzug, auf Knopfdruck und beim Verlassen der App (höchstens alle 2 Minuten),
**nur bei einer Änderung** (Java vergleicht mit dem eigenen Stand). Nur bei passendem Ordner (Kennung).

Teile: `TresorEinzug.java` (rein, JVM-Probe), `ProTresorordner.java` (Freigabe, Schlüsselspeicher), `ProVaultPlugin` (`tresorZustand`,
`tresorEinziehen`, `tresorVerzeichnis`, `tresorSperren`, Passwort-Dialog), `DocumentVault.tresorSchluessel()` (Kopie, nur nativ),
`native/native-tresorordner.js` (Abschnitt, Zeilen), Haken in `native/native-vault.js`.

Proben (gemessen 27.10.2026 im Behälter):

```bash
# JVM ohne Gradle (CI: testReleaseUnitTest): TresorEinzugTest 3 grün
WFP_CHROMIUM=… node --test tools/native/test-tresorordner.mjs        # 8 grün (echter Kern, echte Bibliothek, Brücke gestellt)
TRESOR_JARS=… WFP_CHROMIUM=… node tools/native/gegenprobe-tresorordner.mjs   # 9 gefangen · 0 durchgerutscht · 2 Kontrollen grün
```

`TresorEinzugTest`: Ordnerprüfung (passt · Fach selbst · ohne · fremder Kopf) · **Probe an einer Kopie**: Original unberührt, im Fach jede
Datei byte-gleich, neu nur die drei Einträge, BookLedgerPro bekommt mit demselben Passwort genau den Datenschlüssel, Rückweg ergibt den
Ausgangszustand · Inhaltsverzeichnis nur bei Änderung, Schreiber/Format fest, ungültige Kennung abgelehnt, Private Brain liest es.

⚠ Grenzen: das Android-Plugin ist hier nicht übersetzt (kein SDK im Behälter) — gebaut und gelintet in GitHub, **nicht im Emulator und
nicht am Gerät gefahren**; keine echte SD-Karte. Nur der aktive Speicherort zieht ein. Ohne Dokumenttresor (nur Gerätespeicher) gibt es
keinen Einzug. Windows: Lücke (kein Rust-Zwilling, `docs/PRODUKTSTAND.md`); die Datei tut dort nichts (keine Brücke).

## Einstellungen nach dem Leitfaden: „Tresor & Ablage“ (Klaus 2026-10-28, Umbau 2)

Wie Private Brain Pro #107 (Leitfaden `BookLedgerPro/docs/design/LEITFADEN-PRO-APPS-BEDIENUNG.md`):
- Knopf in den Einstellungen und Fenster heißen **„Tresor & Ablage“**. Darin untereinander **„Ablage von Workflow PDF Pro“**
  (der eigene verschlüsselte Ordner) und **„Tresor (alle Pro-Apps)“** (der Tresorordner), je mit **● Entsperrt / ● Gesperrt**,
  ganzem Pfad (`SD-Karte/…`, `Gerät/…`) und **„In Dateien öffnen“** (`WorkflowVault.ordnerOeffnen`, ACTION_VIEW auf den Ordner;
  ohne passende Dateien-App nennt die App den Pfad). Erklärungen hinter ⓘ, zugeklappt.
- **Ein farbiger Knopf** = nächster Schritt: ohne Ordner „Ordner wählen“, sonst im Tresor „einziehen“ bzw. „entsperren“; verbunden
  braucht keinen. „Ablage sperren“ nur bei offener Ablage, „Tresorordner sperren“ nur bei offenem Tresor.
  Ersatzschlüssel-Knopf: „Ersatzschlüssel für die Ablage erzeugen (3 von 5) …“. Die Übernahme zeigt einen Balken.
- **Keine Web-Reste** (`native/native-ohne-web.js`, nur in der App): „Browser“-Sätze des Kerns → App/Gerät (DE/EN/RU/AR),
  „Als App installieren“ und „Dauerhaft speichern lassen“ weg; „Speicher“ in den Einstellungen nennt die Ablage. Der Kern
  (`upstream/`) bleibt byte-1:1. Ausgenommen, wo es wirklich ein Browser ist (HTML-Ausgabe, Links im Feld, Chrome-Fläche, Diagnose).
- **„Auf Updates prüfen“** (Android, `WorkflowUpdates`, nur auf Tipp, öffentliche GitHub-Veröffentlichungen `vX.Y.Z` mit APK):
  „Du verwendest die aktuelle Version 1.0.6.“ / „Neu: 1.0.7 (du hast 1.0.6)“; „Neue Version herunterladen“ öffnet die feste Seite
  der Veröffentlichung, installiert nichts. Windows nennt die Version ebenso (`windows/bridge/updates.js`).
- Proben: `tools/native/test-ohne-web.mjs` (Rundgang durch Bibliothek, Einstellungen, Sicherung, Hilfe, Löschen, Ausgabe, Speichern,
  Übersetzen in DE und EN; kein Hin und Her mit der Sprachschicht; Kasten, Pfad, Knopf; Updates) · JVM `UpdateRegelTest` (5).
  Gegenprobe: Schicht leer → DE und EN rot; als PWA stehen die Browser-Sätze da (dort richtig).
- ⚠ Nicht am Gerät gemessen; ob Androids Dateien-App einen Ordner per ACTION_VIEW zeigt, ist offen. Sicherung gestreamt (~50 MB) ist
  noch nicht gebaut (eigener PR).

## Eingang-WorkflowPDF anzeigen und übernehmen (Pro-Umbau 5, 2026-10-28)

Andere Pro-Apps legen Dateien für Workflow PDF Pro in das Übergabefach **„Eingang-WorkflowPDF“** (BookLedgerPro: „An Pro-App geben …“).
Bisher zeigte Workflow PDF Pro es nicht an. Jetzt:
- **Einstellungen → Tresor & Ablage → Tresor (alle Pro-Apps)**, verbunden: Block „Eingang-WorkflowPDF“ mit „Neu im Eingang: N“, je Datei Name ·
  Datum · Größe, Erklärung hinter ⓘ, ein farbiger Knopf **„Übernehmen (N)“**. Ohne Neues: „Im Eingang liegt nichts Neues.“
- **Über den Karten** eine flache Zeile „Neu im Eingang: N“ mit „Übernehmen (N)“, solange der Tresorordner offen ist und etwas Neues liegt
  (4 s nach dem Start und beim Zurückkehren in die App).
- „Übernehmen“ liest **alle** neuen Dateien in Stücken zu 192 KB (`tresorEingangOeffnen`/`tresorEingangTeil`), gibt sie wie „Datei einlesen“ an
  den Kern (`importDateien`: ungeprüft, Prüfen auf Knopfdruck) und markiert sie **erst danach** als übernommen (`tresorEingangMarkieren` →
  `TresorOrdner.markeSetzen`). Im Fach wird nichts gelöscht. Schon markierte Einträge stehen nicht mehr da.
- Java: `ProTresorordner.eingang/eingangOeffnen/eingangTeil/eingangMarkieren` über `offenOderGemerkt()` (dieselbe Regel wie das
  Inhaltsverzeichnis: nach „Sperren“ von Hand öffnet der gemerkte Schlüssel nicht wieder), Plugin `WorkflowVault.tresorEingang*`.
  Das Paket `de.familyprojekt.tresor` ist **unverändert** (Pins bleiben).
- Probe: `tools/native/test-tresorordner.mjs` (Brücke gestellt: ein neuer und ein schon übernommener Eintrag, Hinweiszeile, Block, Übernehmen in
  mehreren Stücken, erst gelesen dann markiert, Dokument mit 3 Seiten ungeprüft in der Bibliothek, Hinweis danach weg).
- ⚠ Nicht am Gerät; die Java-Seite ist nur in der CI gebaut (JVM-Proben, `assembleRelease`), nicht mit einem echten SAF-Ordner gefahren.

## Neue Fächer: Private Brain V3, Familienakte, Eingang-Familienakte (Pro-Umbau 14 A3, Klaus 2026-10-31)

Klaus' Antworten 1 und 2: V3 bekommt ein **eigenes** Fach („Private Brain V3“, App-Kennung `private-brain-v3`), die Familienakte ein eigenes
(„Familienakte“, `familienakte`) und ein Übergabefach („Eingang-Familienakte“, jede App legt ab, die Familienakte liest). `Fach.java` hat damit
acht Fächer und fünf Apps (seit 1.11.2026 neun: dazu „Eingang-Private-Brain“, siehe unten). Ein Fach entsteht erst beim ersten Ablegen; ein älterer Tresor bleibt ohne Umbau gültig, alte Apps lesen die neuen
Fächer nur dann nicht, wenn sie sie nicht kennen (ihr `Fach.nachSlug` meldet `TRESOR_FACH_UNBEKANNT`, nichts wird verändert).
Probe: `TresorOrdnerTest.neueFaecherV3UndFamilienakteOhneUmbauAlterTresore` (V3 schreibt nur ins eigene Fach und in den Eingang, die Familienakte
liest beides, Private Brain Pro darf nicht in das V3-Fach). Gegenprobe ohne die Fächer: genau diese Probe rot.
⚠ V3 und die Familienakte ziehen das Paket noch ein (eigene Schritte), bis dahin bleiben die Ordner leer.

## Was im Tresor liegt und was nicht (Klaus' Antwort 6, 2026-10-31)

Im Tresorordner liegen nur verschlüsselte Dateien, je Fach ein verschlüsseltes Inhaltsverzeichnis (Name, Art, Datum, Kurzfassung ≤ 1000 Zeichen)
und die Marken „übernommen“. **Nie im Tresor:** Bedeutungs-Vektoren (Einordnung für die Suche nach Bedeutung), KI-Schlüssel, Mail-Zugänge,
Chef-PIN und Chefcode, der gemerkte Hauptschlüssel (Android-Schlüsselspeicher bzw. Windows-DPAPI). Diese bleiben in der jeweiligen App; eine
andere App rechnet ihre Vektoren selbst.

| App | legt in den Tresor | bleibt in der App |
|---|---|---|
| Workflow PDF Pro | Bibliothek (Arbeitsstand gesammelt), Inhaltsverzeichnis mit Seitentext-Auszug | Vektoren, Bildbeschreibung-Modell, KI-Schlüssel, Chefcode |
| BookLedgerPro | Sicherung des Bestands (`Sicherung/`), Beleg-Originale (`Belege/`) | Vektoren der Belege, Mistral-/Vision-Schlüssel, Chefcode |
| Private Brain Pro | Katalog-Inhaltsverzeichnis, Rechnungsmails in den Eingang von BookLedgerPro | Katalog-Vektoren, Mail-Konten, KI-Schlüssel, Chefcode |
| Private Brain V3 | (noch nicht eingezogen) | wie Private Brain Pro |
| Familienakte | (noch nicht eingezogen) | eigene Daten der Akte |

## Ort ändern: der Kern (Klaus' Antwort 3, 2026-10-31)

`de.familyprojekt.tresor.Umzug` (Quelle hier, reines Java, gleich für Android `SafAblage` und Windows `DateiAblage`):
1. **Kopieren:** jede Datei des alten Orts an denselben Pfad am neuen Ort, der Kopf `tresorordner.json` zuletzt (ein halber Umzug ist kein
   gültiger Tresorordner). Am neuen Ort wird **nie überschrieben**: eine Datei mit gleichem Pfad muss byte-gleich sein (dann gilt sie als schon
   kopiert, so geht ein abgebrochener Umzug weiter), sonst Abbruch `TRESOR_UMZUG_KONFLIKT`. Ein fremder Tresorordner am neuen Ort:
   `TRESOR_UMZUG_FREMDER_TRESOR`, nichts wird geschrieben.
2. **Prüfen:** jede kopierte Datei wird am neuen Ort neu gelesen und per SHA-256 mit dem Original verglichen; am Ende muss der Kopf dieselbe Kennung tragen.
3. **Umschalten** (Aufgabe der App, erst nach Erfolg): die App merkt sich den neuen Ort und legt am alten Ort die kleine Datei
   `Tresorordner/umgezogen.json` an (Kennung, Anzeigename des neuen Orts, Zeit). Sonst ändert sich am alten Ort nichts; er bleibt, bis der Nutzer
   ihn selbst löscht. Von einem Ort mit diesem Vermerk wird nicht noch einmal umgezogen (`TRESOR_UMZUG_SCHON_UMGEZOGEN`); die anderen Pro-Apps
   lesen den Vermerk (`Umzug.vermerk`) und bitten, den neuen Ort zu wählen, statt still am alten weiterzuschreiben.

Proben: `TresorOrdnerTest.ortAendernKopiertPruefendUndLaesstDenAltenOrt`, `…UeberschreibtNieUndNimmtKeinenFremdenTresor` (JUnit 12 grün);
Gegenprobe `tools/tresor/gegenprobe.mjs` vier neue Fälle (überschreiben, fremder Tresor, Kopf zuerst, Vermerk übergangen) je gefangen.
⚠ **Noch nicht gebaut:** der Knopf „Ort ändern …“ in den Apps (Android: Ordnerwahl, Umzug im Hintergrund, Umschalten; bei Workflow PDF Pro
zusätzlich den Dokumenttresor auf „Workflow PDF Pro/“ am neuen Ort umstellen) und Windows. Nicht am Gerät gemessen.


## Ergänzung für Familienakte-Verbund (1. November 2026)

`eingang-private-brain` ist der fehlende Rückweg zu **Private Brain Pro**, nicht zu V3.
Der neue neunte Fachname wird erst bei der ersten Ablage angelegt. Format, Hauptschlüssel,
bestehende Dateien und App-Kennungen bleiben unverändert; kein Umbau alter Tresore beim Öffnen.

`marken(slug, app)` liest die bestehenden Marken einer ausdrücklich benannten App. Damit kann
auch der Sender die Marke des tatsächlichen Empfängers lesen. `marken(slug)` behält sein Verhalten;
Schreiben erfolgt weiterhin ausschließlich unter der eigenen App-Kennung. Eine eigene Sendermarke
ist keine Empfängerquittung. Der aufnehmende App-Adapter muss zuerst Datei und Eingangsdatensatz
dauerhaft bestätigen und darf erst danach die bestehende Marke setzen. Das Paket allein erledigt
noch keinen App-Eingang. Empfänger/Größe/Prüfsumme sind beim Adapter zusätzlich zu prüfen.

Lokal: vollständige kanonische JVM-Probe 13 Fälle grün; Private-Brain-Eingang, unverändertes
Altformat, mehrere App-Kennungen und Originale sowie getrennte Sender-/Empfängermarken enthalten.
Drei gezielte Gegenproben (falscher Empfänger, Sender- statt Empfängermarke, ungeprüfte App-Kennung) wurden gefangen. Android-SAF und reale Datenträger sind dadurch nicht als am Gerät geprüft ausgewiesen.

### Gemeinsamer Baustein `Uebergaben`

Die Auswahlwege verwenden denselben kleinen Java-Baustein: Originale bleiben FPT1-Dateien im
bekannten Übergabefach. Ein JSON-Kopf im bestehenden verschlüsselten Auszug nennt Vertrag,
stabile Übergabe-/Quelldokumentkennung, Quell-/Ziel-App und optionalen Bezug zur vorherigen
Fassung. Dateiname, Typ, Größe und SHA-256 bleiben im vorhandenen Eintrag. Keine neue
Verschlüsselung und kein Wechsel der Formatversion.

Wiederholung derselben Kennung/Fassung liefert denselben geprüften Eintrag. Anderer Inhalt mit
identischer Kennung ist ein Konflikt. Eingangslisten lesen keine Sammlung aller Originalbytes.
Lesen und Quittieren prüfen Ziel, Herkunft, Grenze von 20 MiB und tatsächliche Originalbytes.
`quittieren` darf der Geräteadapter erst nach seiner bestätigten dauerhaften Eingangs-Transaktion
aufrufen. `bestaetigt` liest die Marke der Ziel-App; Ablage im gemeinsamen Fach alleine ist noch
kein erfolgreicher Ziel-Eingang. Die Originale im Übergabefach werden nicht gelöscht.

JVM-Suite jetzt **15/15**: Familienakte ↔ alle drei Ziel-Apps (sechs Wege), Rückbezug,
Wiederholung, Konflikt, falsche Prüfsumme, Überschreitung der Größe und Originalerhalt.
Drei weitere Gegenproben gefangen (Konfliktprüfung, früher Erfolg, Original-Prüfsumme).
Dies ist der gemeinsame Baustein, noch kein Nachweis seiner vollständigen Verdrahtung in
Android, Windows oder den eigenständigen Oberflächen. V3 bleibt eine getrennte Variante.

## Ordnerwahl und keine offenen Dateien im Tresor (Klaus 2026-11-03, „Ja zum Plan“)

Befund von Klaus' SD-Karte: in `Privat Brain Pro Hauptablageordner/Workflow PDF Pro/` (die Ablage = das Fach, verschlüsselte
`.wpv` und eine verschlüsselte `.wfps`-Sicherung) lagen zusätzlich **offene** Dateien (zwei „Eröffnungsmail …pdf“, zwei
„….workfloh.json“), zwei weitere `.workfloh.json` direkt im Hauptablageordner — vermutlich über „Speichern unter“ oder Teilen.
Gelöscht wurde dort nichts.

**1 Ordnerwahl (Android).** Reine Regeln in `OrdnerWahl.java` (JVM-Probe `OrdnerWahlTest`), benutzt von `ProVaultPlugin`:
- Ablage („Ordner wählen / vorhandenen Tresor öffnen …“): der Hauptablageordner **oder** der Ordner „Workflow PDF Pro“ darin
  öffnen dieselbe Ablage (das tat `DocumentVault.inspect` schon, wenn der Kopf `workflow-pdf-pro.tresor.json` da ist).
  **Nie verschachteln:** ein Ordner „Workflow PDF Pro“ wird nur leer genommen (`OrdnerWahl.unterordnerAnlegen`); mit Inhalt, aber
  ohne Kopf → `VAULT_ORDNER_FACH_OHNE_KOPF`, nichts angelegt. Vorher entstand dort „Workflow PDF Pro/Workflow PDF Pro“.
- Abgelehnt mit Klartext, nichts angelegt: „Tresorordner/“ (auch umbenannt, erkannt an Passwort-Plätzen + `verzeichnis/`) und
  Ordner anderer Apps oder Eingang-Fächer.
- **Rückfrage** vor einer neuen Ablage, wenn kein Tresor zu erkennen ist (kein `tresorordner.json`) oder ein leerer
  „Workflow PDF Pro“ gewählt wurde: „Wähle den Ordner, in dem tresorordner.json liegt“ · Abbrechen · Anderen Ordner wählen ·
  Neue Ablage hier anlegen. Ist `tresorordner.json` da und fehlt nur das eigene Fach, legt die App „Workflow PDF Pro“ ohne Frage an.
- Gemeinsamer Tresor (Einziehen und „Tresorordner verbinden“): App-Ordner oder „Tresorordner/“ gewählt → klare Meldung
  (`TRESOR_ORDNER_APP_ORDNER`, `TRESOR_ORDNER_VERWALTUNG`), ohne `tresorordner.json` → `TRESOR_NICHT_VORHANDEN` mit „Es wurde kein
  neuer Tresor angelegt“. **Hochgehen** geht mit Androids Ordnerwahl nicht; nur wenn diese App für die eigene Ablage schon die
  Freigabe genau der Ebene darüber hält und dort der Tresor liegt, nimmt sie diese und sagt es („Verbunden ist jetzt der Ordner
  darüber …“). Sonst nie still ein neuer Tresor.

**2 Keine offenen Dateien in den Tresor.** `TresorSchutz.java`: liegt das Ziel aus „Speichern unter“ (`ACTION_CREATE_DOCUMENT`,
also PDF, `.workfloh.json`, ZIP aus `ProFilesPlugin.save`, und die Ersatzschlüssel-Datei) in einem Ordner, für den die App eine
dauerhafte Schreibfreigabe hält (nur Ablage und Tresorordner), fragt Android: „Dieser Ordner ist der Tresor – dort liegen nur
verschlüsselte Dateien … Lieber z. B. Downloads wählen.“ · Abbrechen · Trotzdem speichern. Abbrechen entfernt nur das eben
angelegte, nachweislich leere (0 Byte) Ziel. **Erkannt** wird über die Dokumentkennungen von Androids Speicher-Anbieter
(Gerät, SD-Karte: `<Speicher>:<Pfad>`). **Nicht erkannt:** Ziele über andere Anbieter (Downloads-Ansicht, Drive …), „Teilen“ an
eine Dateien-App, die selbst in den Tresor speichert, und Windows (eigener Weg, Lücke in `docs/PRODUKTSTAND.md`).

**3 Hilfe „Wo liegt was?“** (`native/native-wo-liegt-was.js`, app-eigen; gemeinsame Bausteine unverändert): Knopf im Kasten
„Tresor & Ablage“ (auch im Sperrzustand) und im Fenster „Zusammenarbeit mit Pro-Apps“. Text aus dem gemeinsamen Plan, darunter
„Diese App: Ordner „Workflow PDF Pro“ · Eingang: „Eingang-WorkflowPDF““, der Menüweg und „mit echtem Namen speichern“.
DE und EN; RU/AR zeigen Deutsch.

**4 Original speichern / echte Namen:** gibt es schon im Kern (Bibliothek: 📤 beim Dokument; „📤 Ordner ausgeben“ → „Original,
unverändert“ → ZIP); die Hilfe verweist darauf. Nichts neu gebaut.

**5 Fächer:** neun (siehe `Fach.java`), die frühere Zeile „acht Fächer“ ist als damaliger Stand gekennzeichnet.

Proben (3.11.2026, Behälter, kein Gerät): JVM `OrdnerWahlTest` 7 grün (+ `TresorEinzugTest` 3) · `test-tresorordner.mjs` 15 grün (5 neue Teilproben + Quelltext-Verdrahtung) · `test-pro-verbund.mjs` 18 grün (1 neu) · Gegenprobe `TRESOR_JARS=… WFP_CHROMIUM=… node tools/native/gegenprobe-ordnerwahl.mjs` **20 gefangen · 0 durchgerutscht**, 2 Kontrollen grün. Android-Klassen nur gegen das Android-14-Framework (Robolectric android-all) mit selbst geschriebenen Capacitor/AndroidX-Hüllen übersetzt, nicht im Emulator und nicht am Tablet.

Das Paket `de.familyprojekt.tresor` ist **unverändert** (Pins bleiben, nichts nachzuziehen).

## Nur den Speicher wählen – den Hauptordner findet oder legt die App an (Klaus 2026-11-04)

Klaus: „Er soll nur die SD-Karte oder den Hauptspeicher zuweisen … die Apps sollen die Ordner selbst anlegen, benennen und den
Pfad suchen. Es soll nie wieder passieren, dass ich eine Datei in einen falschen Ordner ablege.“ · „Kann jeder den Namen selber
wählen? … Familienprojekt oder Family-Projekt.“

**Schritt 1 (dieser Stand): die gemeinsame Regel im Paket** `de.familyprojekt.tresor` (byte-gleich in alle Pro-Apps):
- `Hauptordner.suchen(gewählter Ordner, Name)`: Tresor erkannt am **Inhalt** (`tresorordner.json`), nie am Namen —
  `GEFUNDEN` (der Ordner selbst oder genau ein Ordner darin, auch ein alter wie „Privat Brain Pro Hauptablageordner“) ·
  `ANLEGEN_HIER` (leerer Ordner) · `ANLEGEN_DARIN` (Speicher mit Inhalt: neuer Hauptordner darin) · `UNTERORDNER` (Fach,
  Eingang oder Verwaltung gewählt, auch umbenannt am Inhalt erkannt: nichts tun) · `MEHRERE` (nie raten).
- `Hauptordner.name(…)`: Name frei wählbar, Vorschlag **„Family-Projekt“**; abgelehnt: verbotene Zeichen (Windows/FAT),
  „.“/„..“, > 80 Zeichen, Namen von Fächern und Verwaltung.
- `Hauptordner.ablage(…)` + `UnterAblage`: die App arbeitet im Hauptordner, auch wenn nur der Speicher freigegeben ist;
  nie in einen vorhandenen Ordner mit Inhalt hinein (`TRESOR_NAME_BELEGT`).
- Proben: JVM `HauptordnerTest` 9 grün, `TresorOrdnerTest` 15 grün (javac + JUnit 4.13.2 im Behälter); Gegenprobe von Hand
  6 eingebaute Fehler → je rot.

**Noch nicht verdrahtet** (nächste Schritte): die Ordnerwahl der Apps (Workflow PDF Pro, Familienakte, BookLedgerPro) auf diese
Regel umstellen, eigene Ablage und Einzug zu **einem** Schritt mit einem Passwort zusammenfassen, „Speichern unter“ in den Tresor
sperren statt fragen, Lies-mich-Datei im Hauptordner. ⚠ Android erlaubt auf neueren Geräten nicht, das Hauptverzeichnis einer
SD-Karte in der Ordnerwahl zu nehmen — dort wählt man einen Ordner darauf (oder legt in der Ordnerwahl einen an). Nicht am Gerät geprüft.
