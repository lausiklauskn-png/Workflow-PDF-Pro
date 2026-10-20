# Dieselbe App aus Claude Code und Codex aktualisieren

Klaus’ Auftrag vom 20.10.2026: Beide Arbeitsumgebungen sollen an Workflow PDF Pro
arbeiten und neue reguläre Versionen bereitstellen können. Die App muss dabei
ihre dauerhafte Identität behalten. Quellrepo Workflow-PDF bleibt unverändert.

## Zwei getrennte Schlüsselrollen

| Rolle | Zweck | Gemeinsamer Ablauf |
|---|---|---|
| GitHub-Anmeldung | Git lesen/schreiben, PRs, Actions starten, Releases bereitstellen | Claude Code und Codex verbinden jeweils ihr GitHub-Konto bzw. ihre GitHub-App mit demselben Repo und den unten genannten Rechten. Die Plattform-Anmeldung einer Sitzung wird nicht ausgelesen oder an die andere KI kopiert. |
| Android-Signieridentität | Android erkennt das neue Paket als Update derselben App | Ein eigener dauerhafter Workflow-PDF-Pro-Schlüssel, verschlüsselt im Repo. Jeder Signierlauf erhält automatisch dieselbe Entschlüsselungsfreigabe aus dem GitHub-Environment-Secret. |

Ein Android-Signierschlüssel gewährt keinen GitHub-Zugang. Ein GitHub-Token
ersetzt keinen Android-Schlüssel. Beide KIs können den gleichen Release-Befehl
verwenden, ohne dass der private Android-Schlüssel in einen Chat übertragen wird.
Die Signierung geschieht dann in demselben GitHub-Actions-Ablauf.

## GitHub-Rechte einmalig für beide Arbeitsdienste einrichten

Repository: `lausiklauskn-png/Workflow-PDF-Pro`.

Für die jeweilige GitHub-Verbindung bzw. einen auf dieses Repo begrenzten
Fine-grained Token benötigt der Arbeitsdienst:

- **Contents: read/write** — Branches, Commits, Tags und Releases.
- **Pull requests: read/write** — Änderungen zur Prüfung vorlegen.
- **Actions: read/write** — Workflows starten und deren Ergebnisse lesen.
- **Workflows: read/write** — wenn die KI Workflowdateien pflegen soll.
- **Checks: read** — erfolgreiche Prüfungen desselben Commits feststellen.
- **Metadata: read** — Repository auflösen (bei GitHub üblicherweise enthalten).

Die Erstkonfiguration von `android-production`, Secrets und eventuellen
Repository-Regeln macht ein dazu berechtigter Repo-Verwalter. Diese
Verwaltungsrechte sind für spätere einzelne Veröffentlichungen nicht nötig.
Die Einstellungen in Claude Code und Codex getrennt hinterlegen. Keine Tokens
im Repository oder im Chat speichern. OAuth-/App-Verbindungen sind eigene
Anmeldungen; identische Repo-Rechte erfordern keinen gemeinsam kopierten Token.

Aus jeder Arbeitsumgebung prüfen:

```bash
node tools/signing/github-access.mjs --probe-write
```

Der Git-Push-Probelauf verändert keine Referenz. Die Ausgabe trennt Git-Zugang,
API-Autorisierung und **nicht ausgeführte** Veröffentlichungsoperationen.
`permissions.push` ist nur ein Hinweis auf Repo-Schreibrecht; es beweist keine
Actions-/Release-Berechtigung eines eingeschränkt berechtigten Tokens.

## Dauerhafte Signieridentität einmalig anlegen

Im Zielrepo wurde noch kein vorhandener Workflow-PDF-Pro-Schlüssel gefunden.
Der produktive Schlüssel wurde **noch nicht erzeugt**, weil seine getrennte
Freigabe derzeit nicht sicher im GitHub-Environment hinterlegt werden kann.
Die Tests verwenden ausschließlich flüchtige Prüfschlüssel und synthetische APKs.
Private-Brain-Schlüssel, dessen Paketkennung und dessen Preview-Kanäle werden
nicht übernommen.

1. In GitHub die Umgebung **`android-production`** anlegen.
2. Eine neue zufällige Entschlüsselungsfreigabe außerhalb des Checkouts erzeugen.
   Beispiel mit eigenem existierendem sicheren Verzeichnis:

   ```bash
   node tools/signing/create-unlock-file.mjs /sicherer/absoluter/Pfad/workflow-pdf-unlock
   ```

   Der Inhalt wird nicht ausgegeben. Die Datei wird mit Modus 0600 erstellt,
   bestehende Dateien und Pfade innerhalb des Repositories werden abgewiesen.
   Es ist ein zufälliger 256-Bit-Wert, kein selbst gewähltes kurzes Passwort.
3. Diesen Wert sicher im Environment-Secret **`WF_PDF_SIGNING_UNLOCK`** speichern.
   Bei passendem GitHub-CLI-Zugang, ohne den Wert auf dem Bildschirm auszugeben:

   ```bash
   gh secret set WF_PDF_SIGNING_UNLOCK \
     --repo lausiklauskn-png/Workflow-PDF-Pro --env android-production \
     < /sicherer/absoluter/Pfad/workflow-pdf-unlock
   ```

   Die Freigabe zusätzlich unabhängig vom Cloud-Container sicher verwahren.
   Ein Proxy-Platzhalter ist kein lokal verwendbarer Entschlüsselungswert.
   Die Cloud-Onboarding-Secrets für HTTP-Weiterleitung ersetzen dieses
   GitHub-Actions-Secret nicht.
4. Sobald die Workflowdatei auf `main` geprüft übernommen ist, den Workflow
   **„Dauerhafte Workflow-PDF-Pro-Signieridentität“**, Vorgang `initialize`, starten.
   Er erzeugt einen eigenen RSA-4096-Schlüssel in PKCS12, bindet dessen
   öffentliches Zertifikat per SHA-256 und verschlüsselt Keystore, Passwort und
   Alias gemeinsam mit **AES-256-GCM**. Das Paket wird wieder entschlüsselt und
   das Zertifikat geprüft. Die Dateien werden auf einem eigenen Branch als PR
   vorgeschlagen; im Repo stehen nur:

   - `signing/android-release.enc.json`: authentifiziert verschlüsseltes Paket.
   - `signing/android-certificate.json`: öffentlicher Zertifikatsfingerabdruck.

   Falls die Repo-Einstellung Actions das Erstellen von PRs verbietet, bleibt
   die verschlüsselte Identität auf dem Branch bzw. als Workflow-Artefakt verfügbar.
   Diese vorhandene Identität übernehmen; nicht einfach neu initialisieren.
5. Vor der ersten echten Auslieferung Paket **und** Freigabe unabhängig sichern
   und die Wiederherstellung prüfen. Danach immer Vorgang `check` verwenden.
   Wiederholtes `initialize` ersetzt weder vorhandene Dateien noch einen offenen
   Initialisierungsbranch. Bei bestehenden Releases wird ebenfalls abgebrochen.

Eine sichere lokale Signierumgebung kann die Freigabe als echte geschützte
Prozessvariable `WF_PDF_SIGNING_UNLOCK` bereitstellen und `cli.mjs check` bzw.
`sign-apk` verwenden. Die gemeinsame bevorzugte Veröffentlichung benötigt sie
nur in GitHub Actions, nicht erneut in jeder KI-Unterhaltung.

Eine bereits vorhandene **eigene Workflow-PDF-Pro-Identität** kann statt einer
Neuanlage über `cli.mjs import <Keystore> <bestätigter Zertifikat-SHA256>`
übernommen werden; Storepasswort und Alias werden über geschützte Variablen
bereitgestellt. Der aktuelle Import-/Signierweg setzt gleiches Store- und
Keypasswort voraus. Vor einer Übernahme abweichender Altbestände den Importpfad
gezielt erweitern; bestehende Schlüssel nicht ersetzen. Ohne nachgewiesene
Übereinstimmung mit der bestehenden App nicht importieren.

## Dieselbe Veröffentlichung aus beiden KIs

Nach Einrichtung und vollständiger Fertigstellung der nativen App:

```bash
node tools/signing/request-release.mjs v1.0.0
```

Der Befehl liest den aktuellen `main`-Commit neu und startet für **genau diesen
Commit** den Workflow **„Reguläre Workflow PDF Pro veröffentlichen“**. Er
behauptet noch keinen erfolgreichen Release. Anschließend den zugehörigen
Workflowlauf prüfen; das können Claude Code und Codex mit ihren eigenen
GitHub-Zugängen tun.

Der vorbereitete Workflow verlangt die vollständige App, die eigene
Signieridentität, einen erfolgreichen `native-smoke` desselben Commits sowie
vollständige Web-/native Prüfungen. Danach baut er die Release-APK, signiert sie
mit derselben Identität und kontrolliert App-Kennung, Zertifikat, reguläre
Version, Debugflag und SHA-256. Ein eigener `versionCode` muss gegenüber dem
vorherigen Release steigen; Versionsnummer und Zertifikat werden mit dem
vorigen öffentlichen Nachweis verglichen. Bestehende Releases werden nie
überschrieben.

Die Dateien werden als regulärer GitHub-Release bereitgestellt. Der öffentliche
Download wird ohne Anmeldung erneut geladen und bytegleich verglichen. Bei
fehlendem/abweichendem Download versucht der Ablauf, den Release wieder zum
Entwurf zu machen, und meldet den Fehler. Ein privates Repository benötigt eine
passende öffentliche Auslieferungsstrategie; der anonyme Download ist hier
noch nicht geprüft. Keine GitHub-Tokens in die APK einbauen.

Das Android-Paket ist für `de.familyprojekt.workflowpdf.pro` vorgesehen. Spätere
Windows- und iOS-Ausgaben benötigen ihre eigenen Plattform-Signierverfahren;
der Android-Schlüssel ersetzt kein Apple- oder Windows-Zertifikat.

## Tatsächlicher Stand dieser Sitzung

- Private Brain Pro `main` gelesen bei `eb800faf25676055a19a49eea83d0ba158e896ec`;
  zusätzlich paralleler Branch `codex/preview-release-pipeline` bei
  `7a1df41f7122d2c0d55074a3a7c401fa66a0211f`. Dort war weiterhin die bisherige
  Actions-Secrets-Signierung sichtbar, kein neues verschlüsseltes Schlüsselpaket.
  Kein Schlüssel und keine Zugangsdaten daraus übernommen, keine Quelldateien
  der Referenz verändert.
- **19 neue Prüfungen bestanden**, 0 fehlgeschlagen, 0 übersprungen:
  echte Keystore-Erzeugung/Wiederherstellung, echte kryptografische Signatur mit
  derselben Identität in getrennten Läufen, manipulierte Pakete/Passwörter/Pins,
  geschützte Freigabedatei, echte Signierung/Verifikation synthetischer APKs mit
  Googles Android-36-Werkzeugen, Versions-/Buildfolge und Ablehnung falscher Apps/
  Debug-/Preview-Versionen. Rohbericht: `portierung/nachweise/signing-tests.tap`.
- Die beiden Workflowdateien bestehen **actionlint 1.7.7**. Actions und SDK-Tools
  wurden aus offiziellen Quellen bezogen; Release-SHA-256 bzw. Googles
  veröffentlichte Paketprüfsumme wurden geprüft. Actions sind auf geprüfte
  Commit-SHAs gepinnt. Kein echter GitHub-Release-Workflow wurde ausgeführt.
- Git lesen und Push-Probelauf funktionieren. `api.github.com` wird aktuell
  bereits beim Proxy-CONNECT mit **403** abgewiesen. API-/Actions-/Release-Rechte
  dieser Sitzung sind deshalb **nicht nachgewiesen**, die von Claude Code
  hier ebenfalls nicht prüfbar.
- Netzwerkfreigaben für **`api.github.com` und `uploads.github.com`** wurden im
  Cloud-Umgebungsentwurf ergänzt. Vorherige Einstellungen wurden erhalten.
  Der Entwurf allein ändert den laufenden Proxy nicht. In den
  Umgebungseinstellungen prüfen/speichern und anschließend veröffentlichen;
  danach den API-/Actions-Zugang erneut prüfen. Neue Tokenwerte sind aus dem
  Netzwerkfehler nicht als fehlend bewiesen.
- Die native App/Android-Buildkonfiguration ist noch nicht fertig. Der Release-
  Workflow enthält deshalb absichtlich eine echte Sperre vor dem Signieren;
  eine funktionsarme Grundfassung wird nicht ausgeliefert. Produktionsschlüssel,
  Environment-Secret, echter CI-Lauf, Installation und Update stehen noch aus.

## Gemessen aus Claude Code (2026-10-20)

Ausgangsstand `codex/workflow-pro-native-foundation` bei `0c067b9`, `main` bei `5892a81`.

| Recht | Ergebnis Claude Code |
|---|---|
| Git lesen, Push-Probelauf | ja (`github-access.mjs --probe-write`: gitRead, gitWriteDryRun) |
| API lesen, Repo-Rechte | ja; GitHub meldet `admin/push` für die Verbindung |
| Actions-Läufe/Workflows lesen | ja |
| Environments, Secrets, Actions-Einstellungen lesen/setzen | **nein** – der Claude-Sitzungsproxy sperrt diese API-Pfade |
| Branch-Schutz lesen | nein (403 der GitHub-App) |
| Workflow starten (`workflow_dispatch`) | **nein** – im Schwesterrepo Privat-Brain-Pro mit 403 „Resource not accessible by integration“ abgelehnt |
| Releases | 0 vorhanden; Anlegen nicht versucht (keine App) |

Folge: Environment `android-production` und Secret `WF_PDF_SIGNING_UNLOCK` legt
Klaus selbst im GitHub-Webformular an; Claude Code sieht davon nur, ob ein
Workflowlauf die Freigabe lesen kann. Workflowläufe starten Klaus (Knopf
„Run workflow“) oder eine Arbeitsumgebung mit Actions-Schreibrecht. Claude Code
kann Läufe lesen, Fehler beheben, Branches/PRs pushen und Ergebnisse prüfen.

Signier-Prüfungen in Claude Code: `test-release-policy` 3/3, `test-identity` 7/7
(echter Keystore, Verschlüsselung, Manipulation) bestanden; `test-apk` hier nicht
ausführbar, weil Googles Build-Tools (`dl.google.com`) im Claude-Container gesperrt
sind – nicht rot im Code, sondern ungeprüft. `verify-upstream`: 191/191 bytegleich.

Die Workflows sind erst nach Übernahme auf `main` bei GitHub registriert und startbar.

## Eingerichtet (2026-10-20)

- Environment `android-production` und Secret `WF_PDF_SIGNING_UNLOCK` von Klaus
  angelegt; Freigabe zusätzlich getrennt gesichert. Actions: Lese-/Schreibrecht,
  PR-Erstellung erlaubt.
- Workflow „Dauerhafte Workflow-PDF-Pro-Signieridentität“, `initialize`:
  Lauf 39472967095 grün (Erzeugen, Entschlüsseln, Zertifikatsbindung geprüft).
- PR #3 gemergt: nur `signing/android-release.enc.json` (AES-256-GCM) und
  `signing/android-certificate.json`. Zertifikat SHA-256
  `0da805c9ad11ded86227fa4398e9237766f9f2d12bec66d65cb20309cbea3837`,
  App-Kennung `de.familyprojekt.workflowpdf.pro`. Kein Private-Brain-Schlüssel.
- Offen: Workflow einmal mit `check` von `main` starten (belegt die Wiederherstellung
  aus dem Repo). Keine App, kein Release; der Veröffentlichungs-Workflow bleibt
  gesperrt, bis App, Build und Nachweise vorliegen.
