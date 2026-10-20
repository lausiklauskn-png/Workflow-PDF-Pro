// Android reference font for Linux browser tests. No product CSS or PDF fonts
// are changed, and the original layout assertions remain active.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const temporary = process.env.RUNNER_TEMP || '/workspace/setup';
mkdirSync(temporary, { recursive: true });
const path = join(temporary, 'workflow-android-fonts.conf');
const cache = join(temporary, 'workflow-font-cache');
mkdirSync(cache, { recursive: true });
const directories = ['/usr/share/fonts', '/usr/local/share/fonts'];
if (existsSync('/workspace/setup/roboto-fonts/usr/share/fonts/truetype')) directories.push('/workspace/setup/roboto-fonts/usr/share/fonts/truetype');
const xml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const aliases = ['system-ui', 'sans-serif', 'system', 'sans', 'Sans', 'Arial'];
writeFileSync(path, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <include>/etc/fonts/conf.d/49-sansserif.conf</include>
  ${directories.map(dir => '<dir>' + xml(dir) + '</dir>').join('\n  ')}
  <cachedir>${xml(cache)}</cachedir>
  ${aliases.map(family => '<alias binding="strong"><family>' + family + '</family><prefer><family>Roboto</family></prefer></alias>').join('\n  ')}
  <alias><family>serif</family><prefer><family>DejaVu Serif</family></prefer></alias>
  <alias><family>monospace</family><prefer><family>DejaVu Sans Mono</family></prefer></alias>
</fontconfig>
`);
const check = spawnSync('fc-match', ['-f', '%{family}', 'sans\\-serif'], { encoding: 'utf8', env: { ...process.env, FONTCONFIG_FILE: path } });
if (check.status !== 0 || !check.stdout.includes('Roboto')) throw new Error('Android reference font missing. Install fonts-roboto-unhinted; no fallback font is accepted.');
console.log(path);
