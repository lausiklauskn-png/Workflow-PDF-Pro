import { spawnSync } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { stableTag, compareTags, validateReceipt, validateUpdate } from './release-policy.mjs';

const repo = 'lausiklauskn-png/Workflow-PDF-Pro';
const [tag, commit, folder] = process.argv.slice(2);
const run = args => {
  const r = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('GitHub-Vorgang fehlgeschlagen: ' + args[0]);
  return r.stdout;
};
let dir, created = false;
try {
  if (!stableTag.test(tag || '') || !/^[a-f0-9]{40}$/.test(commit || '') || !folder) throw new Error('Regulärer Tag, Quellcommit und Ausgabeordner erforderlich.');
  const filename = 'Workflow-PDF-Pro-' + tag.slice(1) + '.apk';
  const apk = path.resolve(folder, filename), receipt = JSON.parse(await readFile(apk + '.json', 'utf8'));
  validateReceipt(receipt, tag, commit);
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  if (sha(await readFile(apk)) !== receipt.apkSha256) throw new Error('APK wurde nach der Signaturprüfung verändert.');
  const remoteTag = spawnSync('git', ['ls-remote', '--tags', 'https://github.com/' + repo + '.git', 'refs/tags/' + tag], { encoding: 'utf8' });
  if (remoteTag.status !== 0) throw new Error('Vorhandene Tags nicht prüfbar.');
  if (remoteTag.stdout.trim()) throw new Error('Tag bereits vorhanden; keine abweichende Quellzuordnung oder Überschreibung.');
  const releases = JSON.parse(run(['api', '--paginate', '--slurp', 'repos/' + repo + '/releases?per_page=100'])).flat();
  if (releases.some(r => r.tag_name === tag)) throw new Error('Tag bereits vorhanden; bestehende Version nie ersetzen.');
  const stable = releases.filter(r => !r.draft && !r.prerelease && stableTag.test(r.tag_name));
  const latest = stable.sort((a, b) => compareTags(b.tag_name, a.tag_name))[0];
  dir = await mkdtemp(path.join(tmpdir(), 'wf-pdf-release-'));
  if (latest) {
    if (compareTags(tag, latest.tag_name) <= 0) throw new Error('Release-Version steigt nicht.');
    run(['release', 'download', latest.tag_name, '--repo', repo, '--pattern', '*.apk.json', '--dir', dir]);
    const entries = await import('node:fs/promises').then(fs => fs.readdir(dir));
    if (entries.length !== 1) throw new Error('Vorheriger Update-Nachweis fehlt oder ist uneindeutig.');
    const previous = JSON.parse(await readFile(path.join(dir, entries[0]), 'utf8'));
    validateReceipt(previous, latest.tag_name, previous.commit);
    validateUpdate(receipt, previous);
  }
  run(['release', 'create', tag, apk, apk + '.sha256', apk + '.json', '--repo', repo, '--target', commit, '--title', 'Workflow PDF Pro ' + receipt.versionName, '--generate-notes', '--draft']); created = true;
  run(['release', 'edit', tag, '--repo', repo, '--draft=false', '--latest']);
  const downloaded = path.join(dir, filename);
  const url = 'https://github.com/' + repo + '/releases/download/' + tag + '/' + filename;
  const download = spawnSync('curl', ['--fail', '--location', '--retry', '3', '--proto', '=https', '--proto-redir', '=https', '--output', downloaded, url], { encoding: 'utf8' });
  if (download.status !== 0 || sha(await readFile(downloaded)) !== receipt.apkSha256) throw new Error('Öffentlicher Download fehlt oder weicht von der geprüften APK ab.');
  console.log('Reguläre Version veröffentlicht und öffentlicher Download bytegleich geprüft: ' + url);
} catch (error) {
  if (created) {
    const rollback = spawnSync('gh', ['release', 'edit', tag, '--repo', repo, '--draft=true'], { encoding: 'utf8' });
    if (rollback.status !== 0) console.error('Rücknahme als Entwurf nicht bestätigt; Release manuell prüfen.');
  }
  console.error(error.message); process.exitCode = 1;
} finally { if (dir) await rm(dir, { recursive: true, force: true }); }
