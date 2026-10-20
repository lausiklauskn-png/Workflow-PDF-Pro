# Arbeitsstand der nativen Übernahme

Verbindlicher Auftrag: [Nachfolgebrief](../../BRIEF_NACHFOLGE_2026-10-20_NATIVE_APP.md).

1. [Funktionsmatrix](FUNKTIONSMATRIX.md): 122 Bestandsfunktionen plus zwölf
   Anforderungen an den nativen Speicher, vorhandenes Verhalten, Quellstellen,
   bestehende Tests und noch offene native Anbindung.
2. [Aktueller Prüfstand](PRUEFSTAND.md): nur die in dieser Sitzung ausgeführten
   Prüfungen; Rohbefunde unter `nachweise/`.
3. [Entscheidungspunkte](ENTSCHEIDUNGEN.md): Zielsysteme und Chrome-Transport,
   konkrete Optionen mit Empfehlung und Grenzen. A ist zur Erprobung gewählt; Plattformfolge Android/DeX, Windows, iOS ist festgehalten. Genaue Geräteversionen sind offen.
4. `QUELLDATEIEN-SHA256.json`: vollständiges Manifest des übernommenen Quellstands;
   `BEDIENELEMENTE.json` und `FUNKTIONEN-QUELLINDEX.json`: ergänzende Quellindices.
5. [Speicherort und Tresor](SPEICHERORT-UND-TRESOR.md): verbindlicher Zusatzauftrag
   SD-Karte/freier Ordner, Wiederverwendung des Private-Brain-Pro-Grundgerüsts,
   offene Anbindung und Abgrenzung zur bisherigen Sicherung.
6. [Aktueller Android-Bau](BAUSTAND-ANDROID.md): angelegter Host, echte neue lokale
   Prüfungen, noch offene Geräteadapter und CI-Abnahme; keine fertige APK-Freigabe.

Der ursprüngliche Bestand von Workflow-PDF-Pro blieb erhalten. Unter
`upstream/workflow-pdf/` liegen sämtliche 191 Quelldateien bytegleich aus
`7227c543d4a536cf8f3354a56fbba7574645703e`, einschließlich Lizenztexte,
Bibliotheken, Modelle, Beispiele, Schutzmodule und Originaltests. Das ist der
übernommene Ausgangskern, **noch kein natives Produkt und kein Installer**.
Dieser vollständige Herkunftsbestand ist nicht automatisch die Bundle-Eingabeliste:
ein späteres App-Bundle darf ausschließlich ausgewählte öffentliche Laufzeitdateien
enthalten, keine Tests/Entwicklungsdateien/Repository-Metadaten.

Das separate Quellrepository wurde weder verändert noch zurückgesetzt. Die
Prüfkopie mit npm-Abhängigkeiten liegt außerhalb beider ursprünglichen Checkouts
in `/workspace/setup/workflow-pdf-baseline`.

```bash
cd /workspace/Workflow-PDF-Pro
node tools/onboarding/verify-upstream.mjs
bash tools/onboarding/setup-cloud.sh
export NODE_OPTIONS='--import=/workspace/setup/use-system-chromium.mjs --import=/workspace/setup/font-path.mjs'
cd /workspace/setup/workflow-pdf-baseline
npm test
# Unabhängige Einzelprüfungen, ohne einen Fehler der Kette zu verdecken:
node /workspace/setup/run-baseline.mjs
npm run messen
```

Die gespeicherten Cloud-Felder `install_script` und `start_skill` wurden bestätigt
als Entwurf gespeichert. Der Entwurf führt keine Befehle aus und veröffentlicht
nichts. Für Aktivierung in den Umgebungseinstellungen prüfen und speichern,
anschließend die Umgebung veröffentlichen. Eine Veröffentlichung oder Wiederherstellung
in einer neuen Task wurde in dieser Sitzung nicht nachgewiesen.

Native Änderungen, reguläre Produktionssignierung und Auslieferung folgen erst
nach den erforderlichen Entscheidungen und vollständigen Nachweisen. Frühere
Ergebnisse aus CLAUDE.md, Sitzungsbriefen oder Private Brain sind keine neuen
Workflow-PDF-Pro-Tests.

Aktueller Folgeschritt: [Chrome-Transporterprobung](../../native/chrome/README.md) mit 11 bestandenen Host-/Browserprüfungen. Keine native oder echte Google-Übersetzung daraus ableiten.

Gemeinsame Signierung und Veröffentlichung für Claude Code und Codex:
[Einrichtung und tatsächliche Zugriffsgrenzen](../SIGNIERUNG-UND-GITHUB.md).
Die dauerhafte Signieridentität wurde inzwischen eingerichtet und auf GitHub
wiederhergestellt/geprüft; siehe dort die verlinkten Läufe. Noch kein ausgeliefertes
natives Paket. Diese frühere Prüfung wurde für die Speicherergänzung nicht neu ausgeführt.
