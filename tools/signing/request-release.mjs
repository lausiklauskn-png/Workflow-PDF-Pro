// Same entry point for Claude Code and Codex. Uses each environment's existing
// GitHub identity; the Android key and its unlock secret stay in Actions.
import { spawnSync } from 'node:child_process';
const [tag] = process.argv.slice(2), repo = 'lausiklauskn-png/Workflow-PDF-Pro';
const stable = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
try {
  if (!stable.test(tag || '')) throw new Error('Regulären Tag angeben, z. B. v1.0.0; kein Preview-/Testkanal.');
  const remote = spawnSync('git', ['ls-remote', 'https://github.com/' + repo + '.git', 'refs/heads/main'], { encoding: 'utf8' });
  const commit = remote.stdout?.trim().split(/\s/)[0];
  if (remote.status !== 0 || !/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Aktueller main-Stand nicht lesbar.');
  const result = spawnSync('gh', ['workflow', 'run', 'workflow-pdf-release.yml', '--repo', repo, '--ref', 'main', '-f', 'tag=' + tag, '-f', 'commit=' + commit], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Release-Workflow nicht gestartet; GitHub-Zugang und Workflow auf main prüfen.');
  console.log('Release angefordert für ' + commit + '. Das ist noch keine erfolgreiche Veröffentlichung.');
  console.log('Lauf prüfen: gh run list --repo ' + repo + ' --workflow workflow-pdf-release.yml');
} catch (error) { console.error(error.message); process.exitCode = 1; }
