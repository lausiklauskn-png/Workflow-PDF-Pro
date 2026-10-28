// Gemeinsame Bedien-Bausteine (Quelle Private Brain Pro): Kopie byte-gleich mit dem Pin und die Probe im Browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pruefen } from './bedienung-nachziehen.mjs';
test('Bedien-Bausteine byte-gleich mit Private Brain Pro (native/pro-bedienung-herkunft.json)', () => assert.deepEqual(pruefen(), []));
