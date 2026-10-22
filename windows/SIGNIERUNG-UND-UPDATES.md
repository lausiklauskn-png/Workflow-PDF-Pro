# Windows: Herausgebersignatur, Updates und Freigabe

Stand 22.10.2026. Die veröffentlichte Windows-Version 1.0.1 bleibt unverändert.
Die Windows-Abnahme für den Quellstand 1.0.2 ist bestanden; ein neuer Download ist
noch nicht veröffentlicht. Android-Version und Android-Schlüssel bleiben erhalten.

## Abschließende Wahl vom 22.10.2026

Klaus bleibt vorerst bei **manuellen unsignierten Setup.exe-Updates**. Dafür sind
weder ein Windows-Signierkonto noch ein Update-Schlüssel nötig. Kein kostenpflichtiges
Konto und kein selbstsigniertes Herausgeberzertifikat einrichten. Automatische Updates
sind derzeit nicht aktiviert. Ein eigener kostenloser Update-Schlüssel kommt erst
bei einer späteren Aktivierung infrage und ersetzt keine Windows-Herausgebersignatur.

Die folgenden Abschnitte ab „Zwei getrennte Identitäten“ beschreiben die zuvor
vorbereitete optionale Signier-/Updatearchitektur, keinen jetzt auszuführenden
Einrichtungsauftrag. Vollständiger Stand im
[Windows-Abschluss](../BRIEF_ABSCHLUSS_2026-10-22_WINDOWS.md).

## Neuer Releaseablauf: unsigniert, ohne Updater (22.10.2026)

`.github/workflows/windows-release.yml` ist umgebaut. Er braucht **kein** Secret,
kein Signierkonto, kein Zertifikat und keinen Update-Schlüssel. Er wurde noch
**nicht** ausgeführt; das ist noch keine Veröffentlichung.

Ablauf:

1. **Anstoß.** „Run workflow“ auf main mit `tag` und `commit`, oder Git-Brücke:
   Push des aktuellen main-Commits auf `release-requests/windows-vX.Y.Z`.
   `release-request.yml` startet dann `windows-release.yml` auf main.
   Claude Code: `node tools/signing/request-release.mjs windows-vX.Y.Z`.
2. **Prüfen** (Linux): richtiges Repo; Commit = gestarteter Stand = aktueller main.
   Tag `windows-vX.Y.Z` passt zu `tauri.conf.json`, `windows/package.json` und
   `Cargo.toml`. Tag und Release gibt es noch nicht. Version liegt über allen
   bisherigen `windows-v*`. `updater.pub` ist leer und `createUpdaterArtifacts`
   ist aus; sonst Abbruch, weil die Hinweise dann nicht stimmen würden.
   Ein Lauf „Windows-App (Tauri)“ auf genau diesem main-Commit ist grün.
3. **Datei.** Kein Neubau. Veröffentlicht wird der Auslieferungsbau aus diesem
   Abnahmelauf (`npm ci`, `verify:upstream`, `build-web`, `npx tauri build` ohne
   `messprobe`). Prüfsumme aus der `.sha256`-Datei wird verglichen. So wurde
   auch 1.0.1 veröffentlicht. Das Artefakt bleibt jetzt 90 Tage erhalten.
4. **Installieren** (Windows): Prüfsumme gleich; Authenticode-Status muss
   `NotSigned` sein; still installieren, starten, deinstallieren.
5. **Veröffentlichen** (Linux): main noch einmal prüfen. Release erst als Entwurf
   mit Installer und `.sha256`, dann öffentlich, nicht als „latest“.
   Danach ohne Anmeldung herunterladen und SHA-256 und Größe vergleichen.
   Bei Abweichung wird das Release wieder zum Entwurf und der Lauf scheitert.

Die Hinweise im Release sagen klar: unsigniert; SmartScreen warnt
(„Weitere Informationen“ → „Trotzdem ausführen“); keine automatischen Updates;
neue Version von Hand über die alte installieren; Daten bleiben erhalten.

Der Bau braucht keinen `TAURI_SIGNING_PRIVATE_KEY`: `createUpdaterArtifacts` ist
nicht gesetzt (Standard: aus). Der Updater ist eingebaut, bleibt aber mit leerem
`updater.pub` abgeschaltet (`configured:false`, keine Abfragen).

Nicht mehr verwendet: `windows/tools/publish-signed-release.ps1`,
`windows/tools/verify-windows-signature.ps1`, das Environment `windows-production`
und der Update-Zeiger `windows-updates/latest.json`. Die Skripte sind als
„NICHT IN GEBRAUCH“ markiert und bleiben nur als Vorlage. `update-feed.mjs` und
seine Tests bleiben, weil der Updater-Code in der App noch geprüft wird.

## Zwei getrennte Identitäten

1. **Windows-Herausgeber:** Microsoft Artifact Signing (vormals Trusted Signing).
   Privater Zertifikatsschlüssel bleibt im Signierdienst. GitHub meldet sich per
   kurzlebigem OIDC an. Der Ablauf signiert den bereits abgenommenen NSIS-Installer,
   prüft Windows-Vertrauenskette, erwarteten Herausgeber, Code-Signing-Zweck und
   Zeitstempel. Die Signatur betrifft den Installer; die innere Programmdatei wird
   dabei nicht neu gebaut oder separat mit Authenticode signiert.
2. **App-Updates:** langfristiger Tauri/minisign-Schlüssel. Der öffentliche Schlüssel
   liegt unter `windows/signing/updater.pub` und wird fest in die App eingebaut.
   Privater Schlüssel und Passwort liegen ausschließlich in geschützten Secrets.
   Kein selbstsigniertes Windows-Zertifikat als Ersatz für einen anerkannten
   Herausgeber und kein privater Schlüssel in Git, Chat oder Workflow-Artefakten.

Klaus hat bestätigt: Ein Windows-Code-Signing-Zertifikat oder Signierdienst ist
noch nicht vorhanden. Ein kostenpflichtiges Konto wurde nicht angelegt. Eignung,
Identitätsprüfung, regionale Verfügbarkeit und Kosten des Dienstes müssen beim
Anbieter geklärt werden; dafür sind persönliche beziehungsweise rechtliche
Angaben des Herausgebers nötig. Die Signierfunktion ist vorbereitet, nicht als
bereits erfolgreich ausgeführt behauptet.

## Einmalige Einrichtung durch den Kontoinhaber

GitHub-Environment **windows-production** auf dieses Repository und Releases von
`main` beschränken. Im Signierdienst nur die benötigte Certificate-Profile-Signer-
Rolle vergeben. OIDC-Föderation auf
`repo:lausiklauskn-png/Workflow-PDF-Pro:environment:windows-production` begrenzen.
Keine breit berechtigten Azure-Client-Secrets erforderlich.

Environment-Variablen (öffentliche Konfiguration, keine Schlüssel):

| Name | Inhalt |
| --- | --- |
| `AZURE_CLIENT_ID` | föderierte Anwendungs-ID |
| `AZURE_TENANT_ID` | Azure-Verzeichnis-ID |
| `AZURE_SUBSCRIPTION_ID` | Azure-Abonnement-ID |
| `WF_PDF_SIGNING_ENDPOINT` | regionaler HTTPS-Endpunkt des Signierkontos |
| `WF_PDF_SIGNING_ACCOUNT` | Signierkonto |
| `WF_PDF_SIGNING_CERTIFICATE_PROFILE` | geprüftes öffentlich vertrauenswürdiges Zertifikatsprofil |
| `WF_PDF_WINDOWS_PUBLISHER_SUBJECT` | vollständiger erwarteter Zertifikats-Subject, exakt wie vom Anbieter bestätigt |

Den Update-Schlüssel einmal in einer sicheren Umgebung erzeugen, mit dem
installierten und festgelegten Tauri-CLI unter `windows/`:

```text
npx tauri signer generate --write-keys <sicherer-absoluter-Pfad-ausserhalb-des-Repos>
```

Passwort interaktiv eingeben. Niemals ohne Zielpfad ausführen, weil die CLI sonst
den privaten Schlüssel auf der Konsole ausgibt. Nur den Inhalt der erzeugten
`.pub`-Datei nach `windows/signing/updater.pub` übernehmen. Privaten Schlüssel als
`WF_PDF_UPDATER_PRIVATE_KEY`, Passwort als `WF_PDF_UPDATER_PRIVATE_KEY_PASSWORD`
im Environment speichern und beide unabhängig sicher sichern. Eine bestehende
Identität niemals durch erneutes Generieren ersetzen. Das leere öffentliche
Schlüsselfeld im aktuellen Bau schaltet Updates ausdrücklich **nicht** frei;
es gibt keinen Testschlüssel und keinen unsicheren Ersatzweg in der App.

Nach Eintragen des öffentlichen Schlüssels muss die App neu gebaut und abgenommen
werden. Die erste Ausgabe mit Update-Unterstützung wird einmal manuell über 1.0.1
installiert; 1.0.1 kann noch nicht selbst nach Updates suchen.

## Verhalten der App

Mit gültigem eingebautem Schlüssel sucht die App nach dem Start und alle sechs
Stunden nach Updates. In den Einstellungen sind manuelle Suche und Abschalten der
automatischen Suche möglich. Anfragen enthalten keine Dokumente, Passwörter oder
API-Schlüssel. Der Server sieht die technisch nötigen Verbindungsdaten.

Ein Update wird sichtbar angeboten. Download und Installation beginnen erst nach
Auswahl; die Installation benötigt außerdem eine native Bestätigung. Der aktuelle
Dokumentstand wird vor dem Schließen gespeichert. Ausstehende Schreibvorgänge
werden abgewartet und anschließend weitere Datenbankzugriffe angehalten.
Bei gesperrtem Speicher oder Schreibfehler wird der Neustart verhindert.
Der Updater prüft minisign-Signatur **und signierte Versionsnummer**. Fremde
Downloadadressen, Vorschauversionen und Downgrades werden nicht akzeptiert.

Die Update-Adresse ist ausschließlich
`https://github.com/lausiklauskn-png/Workflow-PDF-Pro/releases/download/windows-updates/latest.json`.
Nur deren Zeiger wird erneuert. `windows-vX.Y.Z`-Releases und die Android-Releases
werden nicht ersetzt; die Windows-Feed-Veröffentlichung wird nicht als GitHub-„latest“ markiert.

## Release und Sicherheit

Früherer Stand, ersetzt am 22.10.2026 (siehe oben):
`windows-release.yml` verlangte einen erfolgreichen `windows-app.yml`-Lauf auf
dem exakt aktuellen main-Commit. Danach: abgenommenen Installer hashen,
Authenticode signieren und prüfen, endgültige Bytes mit versionsgebundener
Update-Signatur versehen, Signatur unabhängig mit Node-Kryptografie prüfen,
signierten Installer installieren/starten, veröffentlichen, anonym herunterladen
und erneut vergleichen. Erst danach wurde der Update-Zeiger freigegeben.
Fehlende Signierkonfiguration führte vor der Veröffentlichung zum Abbruch.

WebView2-SmartScreen wird nicht mehr abgeschaltet. Die CSP erlaubt lokale Skripte,
die bereits verwendete, fest versionierte Transformers-Bibliothek von jsDelivr,
benötigte WebAssembly/Worker, Inline-Stile und bestehende HTTPS-/WSS-Netzfunktionen;
beliebige Inline-Skripte, JavaScript-eval, Objekte, fremde Basisadressen und
Formularübermittlung sind gesperrt. Tauri ergänzt die Hashes der unveränderten
lokalen Inline-Startskripte. IPC-Aufrufe werden auf das jeweilige lokale
Haupt-/Passwort-/Übersetzungsfenster begrenzt. CDP bleibt ausschließlich im Prüfbau.
Die bestehende eingebettete Sicherheitshilfe darf innerhalb derselben App-Herkunft
weiter angezeigt werden. Update-Adapter und Dialogskripte tragen Inhaltsprüfsummen in ihren URLs,
damit der unveränderte Service Worker bei App-Updates keine alte Adapterfassung liefert.

Die tatsächlichen Abnahmeergebnisse gehören in `docs/portierung/BAUSTAND-WINDOWS.md`.
Ein GitHub-Windows-Runner ersetzt keine physische Windows-10-/11-Geräteprüfung.
