#!/usr/bin/env bash
# Run independent installation evidence even if a product case fails. Preserve
# every failure: this never converts a failed native suite into a release pass.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
python3 tools/native/webview-runtime.py install work/webview-runtime || exit 1
bash tools/native/run-connected.sh
product_status=$?
python3 tools/native/verify-signed-install.py android/app/build/outputs/apk/debug/app-debug.apk --development-probe
installation_status=$?
if (( product_status != 0 )); then exit "$product_status"; fi
exit "$installation_status"
