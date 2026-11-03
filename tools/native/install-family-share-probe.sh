#!/usr/bin/env bash
# Published receiver, pinned bytes. Only synthetic PDFs enter this installation.
set -euo pipefail
mkdir -p work/appwechsel
curl --fail --location --retry 3 --output work/appwechsel/family.apk https://github.com/lausiklauskn-png/Meine-Familienakte/releases/download/android-v2.28.16/Familienakte-android-v2.28.16.apk
echo '2e2ea9cb7a393f72f97b10eb17f1a8f5951285c364faadea2d8e5797cdbcc8f1  work/appwechsel/family.apk' | sha256sum --check
adb install -r work/appwechsel/family.apk
