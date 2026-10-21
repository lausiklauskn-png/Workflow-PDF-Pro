#!/usr/bin/env bash
# Preserve the actual test status and publish bounded runtime diagnostics when
# hosted Actions log downloads are unavailable to a later coding environment.
set -uo pipefail
cd "$(dirname "$0")/../../android" || exit 1
./gradlew --no-daemon --max-workers=2 :app:connectedDebugAndroidTest
native_test_status=$?
if (( native_test_status != 0 )); then
  native_runtime_log="${RUNNER_TEMP:-/tmp}/workflow-native-runtime-errors.txt"
  adb logcat -d -s AndroidRuntime:E Capacitor/Console:E > "$native_runtime_log" 2>&1 || true
  python3 - "$native_runtime_log" <<'PY'
import sys
from pathlib import Path
text = Path(sys.argv[1]).read_text(errors='replace')[-12000:]
for offset in range(0, len(text), 3000):
    piece = text[offset:offset + 3000].replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
    print('::notice title=Native Laufzeitfehler::' + piece)
PY
fi
exit "$native_test_status"
