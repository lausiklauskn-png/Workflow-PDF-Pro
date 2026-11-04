// Canonical core updates only. Native adapters, settings and personal files stay outside upstream/.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
if (args.some(a => !['--anwenden', '--lokal'].includes(a))) throw new Error('Erlaubt: --anwenden, --lokal');
const quelle = resolve(root, 'work/Workflow-PDF');
const url = 'https://github.com/lausiklauskn-png/Workflow-PDF.git';
const git = (...a) => execFileSync('git', a, { cwd: quelle, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
if (!args.includes('--lokal')) {
  mkdirSync(dirname(quelle), { recursive: true });
  if (!existsSync(quelle)) execFileSync('git', ['clone', '--depth', '1', url, quelle], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (git('remote', 'get-url', 'origin') !== url) throw new Error('Unerwartete Quelladresse');
  if (git('status', '--porcelain')) throw new Error('Quelle hat lokale Änderungen');
  execFileSync('git', ['fetch', '--depth', '1', 'origin', 'main'], { cwd: quelle, stdio: ['ignore', 'ignore', 'inherit'] });
  execFileSync('git', ['checkout', '--detach', 'FETCH_HEAD'], { cwd: quelle, stdio: ['ignore', 'ignore', 'inherit'] });
}
if (git('status', '--porcelain')) throw new Error('Quelle hat lokale Änderungen');
const alt = JSON.parse(readFileSync(resolve(root, 'docs/portierung/QUELLDATEIEN-SHA256.json'), 'utf8')).commit;
const neu = git('rev-parse', 'HEAD');
execFileSync(process.execPath, ['tools/onboarding/verify-upstream.mjs'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
if (alt !== neu && args.includes('--anwenden')) {
  execFileSync('python3', ['tools/onboarding/nachziehen.py', quelle, neu], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
  execFileSync(process.execPath, ['tools/onboarding/verify-upstream.mjs'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
}
console.log(JSON.stringify({ bisher: alt, quelle: neu, updateVorhanden: alt !== neu, angewendet: alt !== neu && args.includes('--anwenden') }, null, 2));
