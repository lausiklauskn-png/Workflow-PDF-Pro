import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('./create-unlock-file.mjs', import.meta.url));
test('Zufällige Freigabe wird nur in neuer privater Datei außerhalb Git abgelegt', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wf-unlock-fixture-'));
  try {
    const file = path.join(dir, 'unlock'), result = spawnSync(process.execPath, [cli, file], { encoding: 'utf8' });
    assert.equal(result.status, 0); const secret = await readFile(file, 'utf8');
    assert.match(secret, /^[a-f0-9]{64}$/); assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.ok(!result.stdout.includes(secret)); assert.ok(!result.stderr.includes(secret));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('Vorhandene Freigabe bleibt unverändert', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'wf-unlock-fixture-'));
  try {
    const file = path.join(dir, 'unlock'); await writeFile(file, 'existing');
    assert.notEqual(spawnSync(process.execPath, [cli, file], { stdio: 'pipe' }).status, 0);
    assert.equal(await readFile(file, 'utf8'), 'existing');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('Klartextfreigabe im Repo wird abgewiesen', async () => {
  const file = fileURLToPath(new URL('../../signing/forbidden-unlock-fixture', import.meta.url));
  assert.notEqual(spawnSync(process.execPath, [cli, file], { stdio: 'pipe' }).status, 0);
  await assert.rejects(access(file));
});
