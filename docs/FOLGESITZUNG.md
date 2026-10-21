# Selbstständig weiterarbeiten: Codex und Claude Code

Aktueller kopierbarer Nachfolgeauftrag:
`BRIEF_NACHFOLGE_2026-10-21_APP_FERTIGSTELLEN.md`. Er ergänzt den weiterhin
verbindlichen Originalbrief vom 20.10.2026.

Zuerst `AGENTS.md`, den vollständigen Nachfolgebrief und die aktuellen Dateien
unter `docs/portierung/` lesen. Quellrepo und `upstream/workflow-pdf` unverändert
lassen. Das Ziel bleibt die vollständige reguläre native App; ein gebauter Host
oder eine synthetische Signierprobe ist keine fertige Workflow-PDF-Pro-Version.

## GitHub und Signierung ohne Schlüsselübergabe

Jeder Arbeitsdienst verwendet seine vorhandene eigene GitHub-Verbindung. Rechte
werden von GitHub erteilt, nicht aus einer MD-Datei. Bestehende Plattformanmeldung
normal benutzen; keine Git-Proxy-Anmeldung auslesen oder zwischen Diensten kopieren.
Vor jedem Fortsetzen aktuelle Rechte prüfen:

```bash
cd /workspace/Workflow-PDF-Pro
git status --short --branch
git fetch origin main
node tools/signing/github-access.mjs --probe-write
gh workflow list --repo lausiklauskn-png/Workflow-PDF-Pro
```

Vorhandene Änderungen und Parallelbranches vergleichen, nicht blind zurücksetzen
oder überschreiben. Keine Worktrees ohne Nutzerauftrag. Übernahme eines anderen
Branches erst nach Prüfung; bei flachen Checkouts bei Bedarf mit `git fetch
--deepen=30 origin main` die gemeinsame Historie nachladen, keinen fremden Verlauf
erzwingen.

Für Bauen/Veröffentlichen braucht die Verbindung Repo-Lese-/Schreibrechte,
Workflow-Dispatch und zum Bereitstellen Releases-Schreibrechte. Actions verwendet
die expliziten Workflow-Berechtigungen. Secrets-Zugriff per API ist nicht nötig.
Der dauerhafte APK-Schlüssel liegt verschlüsselt in `signing/`; Freigabe ausschließlich
über `WF_PDF_SIGNING_UNLOCK` im GitHub-Environment `android-production`. Beide
Dienste starten denselben Workflow. Niemals neu initialisieren, eine andere
Identität erzeugen oder den Freigabeschlüssel im Chat anfordern.

```bash
gh workflow run signing-identity.yml --repo lausiklauskn-png/Workflow-PDF-Pro --ref main -f operation=check
gh run list --repo lausiklauskn-png/Workflow-PDF-Pro --workflow signing-identity.yml --limit 3
# Erst bei vollständiger App und bestandenen Freigabeprüfungen:
node tools/signing/request-release.mjs v1.0.0
```

Am 20.10.2026 tatsächlich aus dieser Codex-Sitzung ausgeführt:
Git-Push, PR-Erstellung, API-Lesen und Workflow-Dispatch. Der
[Identitätsprüflauf 39501737287](https://github.com/lausiklauskn-png/Workflow-PDF-Pro/actions/runs/39501737287)
bestand auf main `f403aa1188232e2679fe664ebbdc2a6301ce6106` ohne Schlüsselübergabe.
Das ist keine pauschale Zusage zukünftiger Rechte. Bei 401/403 die konkret fehlende
Dienstverbindung in Codex-/Claude-Einstellungen mit diesem Repo verbinden;
keine neue Signieridentität und kein mehrfaches Umschieben von Secrets.

Für Dienste mit Git-Schreibrecht, aber gesperrtem `workflow_dispatch`, ist zusätzlich
eine Git-Release-Brücke vorbereitet: `request-release.mjs` versucht zuerst den
normalen Workflow-Aufruf und legt sonst einen `release-requests/vX.Y.Z`-Branch auf
dem exakt aktuellen main-Commit an. Der GitHub-eigene Workflow prüft Repo, reguläre
Version und Commitgleichheit und startet denselben geschützten Release-Workflow
**auf main**. Er erhält keinen Signierschlüssel; sämtliche vollständigen App-,
Prüf- und Signiergates bleiben bestehen. Keine Tags vorab anlegen und keine
anderen Commits per Force-Push in einen Auftragsbranch drücken. Diese Brücke muss
zuerst geprüft auf main stehen; ihre bloße Anlage im Bau-Branch ist noch kein
erfolgreicher Release-Auftrag aus Claude Code. Bestehende Aufträge bei gleichem
Commit lösen keinen neuen Git-Push aus; dann vorhandene Läufe prüfen.

## Bauumgebung wieder aufnehmen

```bash
cd /workspace/Workflow-PDF-Pro
bash tools/native/setup-cloud.sh
source tools/native/env.sh
npm run sync:android
android/gradlew -p android --no-daemon --max-workers=2 assembleRelease lintRelease testReleaseUnitTest
WFP_CHROMIUM=/usr/bin/chromium npm run test:native-web
```

`setup-cloud.sh` prüft die veröffentlichten Werkzeugdateien per Prüfsumme,
installiert eingefrorene npm-Abhängigkeiten und erzeugt nur native Bauausgaben.
Die bestehende Baseline-Einrichtung bleibt unter `tools/onboarding/setup-cloud.sh`.
Die verwaltete Chromium-Richtlinie blockiert das Öffnen lokaler HTML-Exportdateien
im Original-E2E-Test; keine Richtlinie umgehen oder Tests abschalten. Vollständige
Originaltests auf einem geeigneten CI-Runner mit passendem Browser ausführen und
deren Ergebnis getrennt ausweisen. Frühere 27 Einzelläufe, Messungen und Tests der
Referenz nicht als neue Prüfungen melden.

In der Umgebung sind `api.github.com` und `uploads.github.com` zusätzlich zur
Paketmanager-Freigabe nötig. Der gespeicherte Konfigurationsentwurf ist erst nach
Prüfen/Speichern und Veröffentlichen in den Umgebungseinstellungen für neue Tasks
aktiv. Eine Wiederherstellung in einer neuen Task muss gesondert bestätigt werden.

## Letzte verbindliche Speicherentscheidung

Interne Datenbank für Bibliothek/Suche und Arbeitszustand plus verschlüsselter
Tresor im frei gewählten Ordner als hauptsächlicher dauerhafter Datenspeicher.
**SD-Karte ist optional; vollständiges Arbeiten im Gerätespeicher muss möglich sein.**
Später Windows mit Rechnerordner, anschließend iOS. Keine heimliche leere
Ersatzbibliothek bei fehlender Karte. Die vorhandene Sicherung und alle
Übersetzungswege bleiben. Details: `docs/portierung/SPEICHERORT-UND-TRESOR.md`.

Fortschritt und tatsächlich verbliebene Bau-/Geräteprüfungen jeweils im aktuellen
Portierungsprüfstand ergänzen; unfertige Adapter nicht als ausgeliefert kennzeichnen.

Aktueller Bauzweig: `codex/native-android-build`, Entwurf-PR #8. Android-Tresor-
Bausteine sind vorhanden, jedoch noch nicht mit der Bibliothek verbunden.
Auf dem letzten Implementierungsstand `ce950ab` bestanden im Actions-Lauf
39513680351 die vollständige Originalkette und der Android-Job mit 14
Emulatorfällen; das ist keine vollständige native App-Abnahme. Ergebnisse und Grenzen stehen
in `docs/portierung/BAUSTAND-ANDROID.md`; diesen Stand vor weiteren Aussagen lesen.
Die Entscheidungen wurden am 21.10.2026 ausdrücklich beantwortet: verschlüsseltes
Wiederanlaufjournal und Chrome-Vordergrunddienst mit sichtbarer Benachrichtigung
und Abbruch sind gewählt (siehe `docs/portierung/ENTSCHEIDUNGEN.md`). Nicht erneut
als offen behandeln. Die Umsetzung und tatsächliche Geräteabnahme bleiben davon
getrennt; der neue Journal-/DB-Baustein ist noch nicht im Produkt aktiviert.
Abhängigkeiten nicht mit `npm ci` während eines Gradle-/Lint-Laufs neu erzeugen.
