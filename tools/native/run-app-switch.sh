#!/usr/bin/env bash
# Capture evidence before the emulator action stops its device. Preserve test failure.
set -uo pipefail
mkdir -p work/appwechsel
(cd android && ./gradlew --no-daemon --max-workers=2 connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=de.familyprojekt.workflowpdf.pro.NativeAppSwitchTest)
status=$?
timeout 15 adb logcat -d > work/appwechsel/logcat.txt || true
for file in chooser.xml chooser.png; do
  timeout 10 adb exec-out run-as de.familyprojekt.workflowpdf.pro.debug cat "files/$file" > "work/appwechsel/$file" || rm -f "work/appwechsel/$file"
done
exit "$status"
