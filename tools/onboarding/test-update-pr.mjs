// Real Git commit/push to a local bare repo; GitHub CLI responses are explicitly simulated.
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const temp = mkdtempSync(join(tmpdir(), 'pdf-update-pr-'));
const tool = resolve('tools/onboarding/update-pr.mjs');
const run = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
try {
  const repo = join(temp, 'repo'), remote = join(temp, 'remote.git'), bin = join(temp, 'bin');
  mkdirSync(repo); mkdirSync(bin); mkdirSync(remote);
  run(remote, 'init', '--bare'); run(repo, 'init');
  run(repo, 'config', 'user.name', 'Probe'); run(repo, 'config', 'user.email', 'probe@example.invalid');
  const put = (p, v) => { mkdirSync(join(repo, p, '..'), { recursive: true }); writeFileSync(join(repo, p), v); };
  put('upstream/workflow-pdf/probe.js', '// vorher\n'); run(repo, 'add', '.'); run(repo, 'commit', '-m', 'Erfundener Stand');
  run(repo, 'remote', 'add', 'origin', remote);
  put('upstream/workflow-pdf/probe.js', '// nachher\n');
  const patch = run(repo, 'diff', '--binary') + '\n'; run(repo, 'restore', '.');
  put('work/pdf-update/update.patch', patch);
  const quelle = 'a'.repeat(40), calls = join(temp, 'gh-calls.jsonl');
  put('work/pdf-update/stand.json', JSON.stringify({ quelle, bisher: 'b'.repeat(40), pro: 'c'.repeat(40), updateVorhanden: true, angewendet: true, designAenderungen: [] }));
  const gh = join(bin, 'gh');
  writeFileSync(gh, `#!/usr/bin/env node\nconst fs=require('fs');const args=process.argv.slice(2);fs.appendFileSync(process.env.PDF_PR_CALLS,JSON.stringify(args)+'\\n');if(args[0]==='pr'&&args[1]==='list')process.stdout.write(process.env.PDF_PR_EXISTS==='1'?'[{"url":"https://example.invalid/pr/1","state":"OPEN"}]':'[]');if(args[0]==='run'&&args[1]==='list')process.stdout.write(process.env.PDF_PR_RUNS?JSON.stringify([{headSha:process.env.PDF_PR_RUNS}]):'[]');if(args[0]==='pr'&&args[1]==='create'){if(process.env.PDF_PR_FAIL_CREATE==='1')process.exit(1);process.stdout.write('https://example.invalid/pr/1');}\n`);
  chmodSync(gh, 0o755);
  const env = { ...process.env, PATH: bin + ':' + process.env.PATH, PDF_PR_CALLS: calls };
  const invoke = extra => spawnSync(process.execPath, [tool], { cwd: repo, env: { ...env, ...extra }, encoding: 'utf8' });
  const base = run(repo, 'rev-parse', 'HEAD');
  let r = invoke({ PDF_PR_FAIL_CREATE: '1' }); assert.notEqual(r.status, 0);
  run(repo, 'switch', '--detach', base);
  r = invoke(); assert.equal(r.status, 0, r.stderr);
  assert.ok(run(remote, 'show', 'refs/heads/automation/pdf-' + quelle + ':upstream/workflow-pdf/probe.js').includes('nachher'));
  const aufrufe = readFileSync(calls, 'utf8').trim().split('\n').map(s => JSON.parse(s));
  assert.ok(aufrufe.some(a => a[0] === 'pr' && a[1] === 'create' && a.includes('--draft')));
  assert.equal(aufrufe.filter(a => a[0] === 'workflow' && a[1] === 'run').length, 2);
  assert.ok(!aufrufe.some(a => a.includes('merge') || a.includes('release')));
  const kopf = run(repo, 'rev-parse', 'HEAD');
  r = invoke({ PDF_PR_EXISTS: '1', PDF_PR_RUNS: run(remote, 'rev-parse', 'refs/heads/automation/pdf-' + quelle) }); assert.equal(r.status, 0, r.stderr); assert.equal(run(repo, 'rev-parse', 'HEAD'), kopf);
  assert.equal(readFileSync(calls, 'utf8').trim().split('\n').map(s => JSON.parse(s)).filter(a => a[0] === 'workflow' && a[1] === 'run').length, 2);
  run(repo, 'reset', '--hard', base); // independent invalid-patch case in this disposable fixture
  put('work/pdf-update/stand.json', JSON.stringify({ quelle: 'd'.repeat(40), angewendet: true, updateVorhanden: true, designAenderungen: [] }));
  put('work/pdf-update/update.patch', 'diff --git a/app/fremd.js b/app/fremd.js\nnew file mode 100644\n--- /dev/null\n+++ b/app/fremd.js\n@@ -0,0 +1 @@\n+unerlaubt\n');
  r = invoke(); assert.notEqual(r.status, 0); assert.match(r.stderr, /Unerlaubter Updatepfad/); // valid but out-of-scope patch is never pushed
  assert.equal(run(remote, 'ls-tree', '--name-only', 'refs/heads/automation/pdf-' + quelle, 'app'), '');
  console.log('Update-PR: echter lokaler Git-Push, simulierter GitHub-Aufruf, Entwurf, zwei explizite Prüfläufe, Wiederaufnahme nach PR-Fehler, Wiederholung und unzulässiger Patch geprüft.');
} finally { rmSync(temp, { recursive: true, force: true }); }
