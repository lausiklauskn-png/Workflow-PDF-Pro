# Wiederanlauf einer Sitzung (Codex und Claude Code)

Regeln: [`AGENTS.md`](../AGENTS.md). Stand aller Fassungen: [`PRODUKTSTAND.md`](PRODUKTSTAND.md).
Frühere Zwischenstände stehen in den Briefen und in der Git-Historie, nicht mehr hier.

## 1. Zugriff prüfen

Jeder Dienst nutzt seine eigene GitHub-Verbindung. Rechte kommen von GitHub, nicht aus dieser Datei.

```bash
git status --short --branch
git fetch origin main
node tools/signing/github-access.mjs --probe-write
```

Laufende Zweige anderer Dienste (zum Beispiel `codex/…`) ansehen und nicht überschreiben.
Bei 401/403: die fehlende Dienstverbindung mit diesem Repo verbinden lassen. Keine neue
Signieridentität, keine Secrets verschieben.

Ohne `workflow_dispatch`-Recht legt `request-release.mjs` einen Auftragszweig
`release-requests/…` auf dem aktuellen main-Commit an; GitHub startet dann den geschützten
Release. Keine Tags vorab, kein Force-Push in Auftragszweige.

## 2. Bauumgebung

```bash
bash tools/native/setup-cloud.sh
source tools/native/env.sh
npm run sync:android
android/gradlew -p android --no-daemon --max-workers=2 assembleRelease lintRelease testReleaseUnitTest
WFP_CHROMIUM=/usr/bin/chromium npm run test:native-web
```

- Abhängigkeiten nicht mit `npm ci` während eines Gradle-/Lint-Laufs neu erzeugen.
- Die Chromium-Richtlinie der Cloud blockiert im Original-E2E-Test lokale HTML-Exporte.
  Nicht umgehen; die volle Originalkette läuft in CI.
- Alte Messungen nicht als neue Prüfungen melden.

## 3. Arbeitsstand je Plattform

- Android: [`portierung/BAUSTAND-ANDROID.md`](portierung/BAUSTAND-ANDROID.md)
- Windows: [`portierung/BAUSTAND-WINDOWS.md`](portierung/BAUSTAND-WINDOWS.md)
- iOS: `docs/portierung/BAUSTAND-IOS.md` auf dem Zweig `codex/ios-native-host`

Zielgeräte laut Klaus: Samsung Galaxy Tab S6 und Galaxy S21 (Android), dazu ein Windows-PC.
