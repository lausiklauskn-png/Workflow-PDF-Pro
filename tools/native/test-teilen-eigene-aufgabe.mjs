// Klaus 2026-11-03: nach „Teilen → Familienakte“ zeigte Workflow PDF Pro die Familienakte und kam nicht zurück.
// Ursache: das Teilen-Fenster wurde „für Ergebnis“ gestartet (startActivityForResult) — Android legt die Ziel-App dann in die
// Aufgabe des Absenders. Diese Probe hält fest, dass das Teilen gewöhnlich gestartet wird (wie BookLedgerPro BlpFilesPlugin).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const quelle = readFileSync(new URL('../../android/app/src/main/java/de/familyprojekt/workflowpdf/pro/ProFilesPlugin.java', import.meta.url), 'utf8');
const teilen = quelle.slice(quelle.indexOf('@PluginMethod public void share('), quelle.indexOf('@PluginMethod public void appInfo('));
test('Teilen startet das Teilen-Fenster gewöhnlich, nicht „für Ergebnis“ (Ziel-App in eigener Aufgabe)', () => {
  assert.ok(teilen.includes('createChooser'), 'Teilen-Methode nicht gefunden');
  assert.ok(!/startActivityForResult\s*\(\s*call\s*,\s*chooser/.test(teilen), 'Teilen-Fenster wird für Ergebnis gestartet');
  assert.match(teilen, /getActivity\(\)\.startActivity\(chooser\)/);
});
test('Antwort an die App bleibt gleich: geöffnet, Zustellung nicht bestätigt', () => {
  assert.match(teilen, /put\("opened", true\)\.put\("deliveryConfirmed", false\)/);
});
