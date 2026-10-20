#!/usr/bin/env bash
set -euo pipefail
cd /workspace/Workflow-PDF-Pro
command -v node
command -v npm
command -v chromium
command -v ffmpeg
node tools/onboarding/verify-upstream.mjs
base=/workspace/setup/workflow-pdf-baseline
if [ ! -d "$base" ]; then
  mkdir -p "$base"
  cp -a upstream/workflow-pdf/. "$base/"
fi
node tools/onboarding/verify-upstream.mjs "$base"
# Frischer Cache vermeidet die in dieser Maschine beobachteten kaputten Cache-Artefakte.
cache_dir=$(mktemp -d /tmp/workflow-npm-cache.XXXXXX)
npm ci --prefix "$base" --cache "$cache_dir"
cp tools/onboarding/use-system-chromium.mjs /workspace/setup/use-system-chromium.mjs
cp tools/onboarding/font-path.mjs /workspace/setup/font-path.mjs
cp tools/onboarding/run-baseline.mjs /workspace/setup/run-baseline.mjs
# Das Testskript kreis.mjs erwartet FreeSans an einem festen Systempfad.
# Ohne System-Schreibrechte: signiertes Debian-Paket lokal auspacken;
# ein externer Node-Preload passt ausschließlich diesen Dateipfad an.
mkdir -p /workspace/setup/apt-lists/partial /workspace/setup/apt-empty
cat > /workspace/setup/debian.list <<'SOURCES'
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian trixie main
SOURCES
apt_options=(-o Dir::Etc::parts=/workspace/setup/apt-empty -o Dir::Etc::sourcelist=/workspace/setup/debian.list -o Dir::Etc::sourceparts=- -o Dir::State::lists=/workspace/setup/apt-lists -o APT::Sandbox::User=agent)
apt-get "${apt_options[@]}" update
(cd /workspace/setup && apt-get "${apt_options[@]}" download fonts-freefont-ttf)
for package in /workspace/setup/fonts-freefont-ttf_*.deb; do
  dpkg-deb -x "$package" /workspace/setup/font-package
done
node tools/onboarding/verify-upstream.mjs "$base"

# Gemeinsame Signierprüfungen (keine produktiven Schlüssel erzeugen).
command -v keytool
command -v openssl
python3 tools/signing/setup-tools.py
