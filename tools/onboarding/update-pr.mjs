import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const repo = 'lausiklauskn-png/Workflow-PDF-Pro';
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const stand = JSON.parse(readFileSync('work/pdf-update/stand.json', 'utf8'));
if (!stand.updateVorhanden || !stand.angewendet || !/^[a-f0-9]{40}$/.test(stand.quelle)) throw new Error('Kein geprüfter Quellstand');
const branch = 'automation/pdf-' + stand.quelle;
const prs = JSON.parse(run('gh', ['pr', 'list', '--repo', repo, '--head', branch, '--state', 'all', '--json', 'url']));
if (prs.length) {
  console.log('Vorschlag besteht bereits: ' + prs[0].url);
} else {
  if (run('git', ['status', '--porcelain', '--untracked-files=no'])) throw new Error('Eigene Änderungen im Arbeitsordner');
  if (run('git', ['ls-remote', '--heads', 'origin', 'refs/heads/' + branch])) throw new Error('Vorhandenen Updatezweig nicht überschreiben');
  run('git', ['apply', '--index', 'work/pdf-update/update.patch']);
  const erlaubt = new Set(['docs/portierung/QUELLDATEIEN-SHA256.json', 'docs/portierung/BEDIENELEMENTE.json', 'docs/portierung/FUNKTIONEN-QUELLINDEX.json']);
  const dateien = run('git', ['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
  if (!dateien.length || dateien.some(p => !p.startsWith('upstream/workflow-pdf/') && !erlaubt.has(p))) throw new Error('Unerlaubter Updatepfad');
  run('git', ['switch', '-c', branch]);
  run('git', ['config', 'user.name', 'github-actions[bot]']);
  run('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  run('git', ['commit', '-m', 'Gemeinsamen PDF-Kern aus ' + stand.quelle.slice(0, 7) + ' nachziehen']);
  run('git', ['push', 'origin', branch]);
  writeFileSync('work/pdf-update/pr.md', `Workflow-PDF-Kern ${stand.bisher} → ${stand.quelle}, mit dem vorhandenen Kopierwerkzeug bytegleich übernommen. Native Adapter und Nutzerdaten unverändert. Originalkette und native Webanbindungen wurden im Vorbereitungslauf geprüft. Android- und Windows-Prüfungen werden zusätzlich am Updatezweig gestartet. Keine automatische Zusammenführung oder Veröffentlichung. Nach Übernahme kann die Familienakte denselben Kern mit ihrem Designschutz übernehmen.\n`);
  console.log(run('gh', ['pr', 'create', '--repo', repo, '--base', 'main', '--head', branch, '--draft', '--title', 'Gemeinsamen PDF-Kern aktualisieren: ' + stand.quelle.slice(0, 7), '--body-file', 'work/pdf-update/pr.md']));
  for (const workflow of ['native-acceptance.yml', 'windows-app.yml']) run('gh', ['workflow', 'run', workflow, '--repo', repo, '--ref', branch]);
}
