import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('release request: no shared credentials, exact-main fallback and unsafe requests rejected', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'workflow-request-'));
  const script = fileURLToPath(new URL('request-release.mjs', import.meta.url));
  try {
    const mock = `#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2),cmd=path.basename(process.argv[1]),mode=process.env.WFP_REQUEST_MODE;
fs.appendFileSync(process.env.WFP_REQUEST_LOG,JSON.stringify({cmd,args})+'\\n');
const sha='a'.repeat(40);
if(cmd==='gh')process.exit(mode==='direct'?0:1);
if(args[0]==='ls-remote') { if(args.at(-1)==='refs/heads/main') console.log(sha+'\\trefs/heads/main'); else if(mode==='already')console.log(sha+'\\t'+args.at(-1)); }
else if(args[0]==='rev-parse')console.log(mode==='changed'?'b'.repeat(40):sha);
else if(args[0]==='cat-file'&&mode==='missing')process.exit(1);
else if(!['fetch','cat-file','push'].includes(args[0]))process.exit(99);
`;
    for (const name of ['git', 'gh']) { const file = join(folder, name); await writeFile(file, mock); await chmod(file, 0o700); }
    async function run(mode, tag = 'v1.0.0') {
      const log = join(folder, 'calls-' + mode); await writeFile(log, '');
      const child = spawnSync(process.execPath, [script, tag], { encoding: 'utf8', env: {
        PATH: folder + ':' + process.env.PATH, WFP_REQUEST_MODE: mode, WFP_REQUEST_LOG: log
      } });
      const calls = (await readFile(log, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      return { status: child.status, calls, stdout: child.stdout, stderr: child.stderr };
    }
    const direct = await run('direct');
    assert.equal(direct.status, 0); assert.ok(!direct.calls.some(c => c.args[0] === 'push'));
    const fallback = await run('fallback');
    assert.equal(fallback.status, 0);
    const push = fallback.calls.find(c => c.args[0] === 'push');
    assert.deepEqual(push.args, ['push', 'https://github.com/lausiklauskn-png/Workflow-PDF-Pro.git', 'a'.repeat(40) + ':refs/heads/release-requests/v1.0.0']);
    for (const mode of ['changed', 'missing']) {
      const result = await run(mode); assert.equal(result.status, 1); assert.ok(!result.calls.some(c => c.args[0] === 'push'));
    }
    const already = await run('already');
    assert.equal(already.status, 0); assert.match(already.stdout, /bereits vorhanden/); assert.ok(!already.calls.some(c => c.args[0] === 'push'));
    const preview = await run('preview', 'v1.0.0-preview'); assert.equal(preview.status, 1); assert.equal(preview.calls.length, 0);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
