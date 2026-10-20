// Read-only capability observation. Never fetch, print or copy a GitHub token.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const repo = 'lausiklauskn-png/Workflow-PDF-Pro';
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
const git = run('git', ['ls-remote', 'https://github.com/' + repo + '.git', 'refs/heads/main']);
const result = { repository: repo, gitRead: git.status === 0, apiRead: false, repositoryWriteIndicated: null, actionsRead: null, gitWriteDryRun: null,
  workflowDispatch: 'nicht ausgeführt', releaseWrite: 'nicht ausgeführt', signingIdentity: 'separat prüfen; kein GitHub-Zugang' };
if (process.argv.includes('--probe-write')) {
  const ref = 'refs/heads/access-check-' + randomBytes(8).toString('hex');
  result.gitWriteDryRun = run('git', ['push', '--dry-run', 'https://github.com/' + repo + '.git', 'HEAD:' + ref]).status === 0;
}
const api = run('gh', ['api', 'repos/' + repo]);
if (api.status === 0) {
  const metadata = JSON.parse(api.stdout); result.apiRead = true; result.repositoryWriteIndicated = !!metadata.permissions?.push;
  result.actionsRead = run('gh', ['api', 'repos/' + repo + '/actions/workflows', '--jq', '.total_count']).status === 0;
} else result.blocker = 'GitHub API nicht erreichbar oder nicht autorisiert; keine Tokenwerte auslesen.';
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.gitRead && result.apiRead && result.repositoryWriteIndicated && result.actionsRead ? 0 : 2;
