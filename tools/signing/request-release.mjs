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
  const result = spawnSync('gh', ['workflow', 'run', 'workflow-pdf-release.yml', '--repo', repo, '--ref', 'main', '-f', 'tag=' + tag, '-f', 'commit=' + commit], { encoding: 'utf8' });
  if (result.status !== 0) {
    // Some connected coding services allow Git pushes but deny workflow_dispatch.
    // Use an auditable exact-main Git request, never an exported platform token.
    const url = 'https://github.com/' + repo + '.git';
    const fetched = spawnSync('git', ['fetch', '--no-tags', url, 'main'], { encoding: 'utf8' });
    const head = spawnSync('git', ['rev-parse', '--verify', 'FETCH_HEAD^{commit}'], { encoding: 'utf8' });
    if (fetched.status !== 0 || head.status !== 0 || head.stdout.trim() !== commit) throw new Error('main wurde geändert oder ist nicht lesbar. Aktuellen geprüften Stand erneut anfordern.');
    const exists = spawnSync('git', ['cat-file', '-e', commit + ':.github/workflows/release-request.yml']);
    if (exists.status !== 0) throw new Error('Git-Release-Brücke ist noch nicht auf main. Keinen Schlüssel oder Token zwischen Diensten übertragen.');
    const previous = spawnSync('git', ['ls-remote', url, 'refs/heads/release-requests/' + tag], { encoding: 'utf8' });
    if (previous.status !== 0) throw new Error('Vorhandener Release-Auftrag konnte nicht geprüft werden.');
    if (previous.stdout.trim().split(/\s/)[0] === commit) {
      console.log('Dieser Git-Release-Auftrag ist bereits vorhanden. Vorhandene Läufe prüfen; kein neuer Lauf wurde behauptet.');
      process.exit(0);
    }
    const pushed = spawnSync('git', ['push', url, commit + ':refs/heads/release-requests/' + tag], { stdio: 'inherit' });
    if (pushed.status !== 0) throw new Error('Git-Release-Auftrag nicht übergeben. Repo-Schreibrechte und vorhandenen Auftragsbranch prüfen.');
    console.log('Release-Auftrag per Git übergeben. Den Brückenlauf und den anschließenden regulären Release-Lauf prüfen.');
  }
  console.log('Release angefordert für ' + commit + '. Das ist noch keine erfolgreiche Veröffentlichung.');
  console.log('Lauf prüfen: gh run list --repo ' + repo + ' --workflow workflow-pdf-release.yml');
} catch (error) { console.error(error.message); process.exitCode = 1; }
