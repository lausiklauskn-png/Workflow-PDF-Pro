#!/usr/bin/env python3
"""Locally install the checksum-pinned Google tools used by test-apk.mjs."""
import hashlib
import json
import pathlib
import subprocess
import zipfile

base = pathlib.Path('/workspace/setup/signing-sdk')
base.mkdir(parents=True, exist_ok=True)
manifest = json.loads(pathlib.Path(__file__).with_name('sdk-artifacts.json').read_text())
for item in manifest:
    archive = base / item['url'].rsplit('/', 1)[-1]
    if not archive.exists():
        subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location',
                        '--max-time', '90', '--proto', '=https', '--proto-redir', '=https',
                        item['url'], '--output', str(archive)], check=True)
    data = archive.read_bytes()
    if len(data) != item['size'] or hashlib.new(item['checksum_type'], data).hexdigest() != item['checksum'] or hashlib.sha256(data).hexdigest() != item['sha256']:
        raise RuntimeError('Google artifact checksum mismatch: ' + archive.name)
    destination = base / ('build-tools' if item['package'].startswith('build-tools') else 'platform')
    with zipfile.ZipFile(archive) as content:
        for name in content.namelist():
            if not (destination / name).resolve().is_relative_to(destination.resolve()):
                raise RuntimeError('Unsafe archive member')
        content.extractall(destination)
    print(item['package'] + ': official checksum and SHA-256 pin verified')
for file in base.rglob('*'):
    if file.name in ['apksigner', 'aapt', 'zipalign']:
        file.chmod(0o755)
