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
| `Fach.java` | die fünf Fächer und wer schreiben darf |
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
