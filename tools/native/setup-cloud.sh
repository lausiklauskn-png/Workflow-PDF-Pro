#!/usr/bin/env bash
set -euo pipefail
cd /workspace/Workflow-PDF-Pro
mkdir -p /workspace/downloads /workspace/jdk /workspace/android-sdk/cmdline-tools /workspace/android-user /workspace/.gradle
if [[ ! -f /workspace/downloads/jdk-21.tar.gz ]]; then
  curl --fail --location --show-error --silent --proto '=https' --proto-redir '=https' \
    https://download.oracle.com/java/21/archive/jdk-21.0.12.1_linux-x64_bin.tar.gz -o /workspace/downloads/jdk-21.tar.gz
fi
echo '12f870b21301b42292558a3f872ce543affa2b86cb6458591c78388c41ddb111  /workspace/downloads/jdk-21.tar.gz' | sha256sum -c -
if [[ ! -x /workspace/jdk/jdk-21.0.12.1/bin/javac ]]; then
  tar -xzf /workspace/downloads/jdk-21.tar.gz -C /workspace/jdk
fi
if [[ ! -f /workspace/downloads/android-commandlinetools.zip ]]; then
  curl --fail --location --show-error --silent --proto '=https' --proto-redir '=https' \
    https://dl.google.com/android/repository/commandlinetools-linux-16111833_latest.zip -o /workspace/downloads/android-commandlinetools.zip
fi
echo '0877a1d048fe4a24efe2eff536ca4223f7adeb58648bb81909d33c446918cfa8  /workspace/downloads/android-commandlinetools.zip' | sha256sum -c -
if [[ ! -x /workspace/android-sdk/cmdline-tools/latest/bin/sdkmanager ]]; then
  unpack=$(mktemp -d /workspace/downloads/workflow-android.XXXXXX)
  unzip -q /workspace/downloads/android-commandlinetools.zip -d "$unpack"
  mv "$unpack/cmdline-tools" /workspace/android-sdk/cmdline-tools/latest
  rmdir "$unpack"
fi
source tools/native/env.sh
# ADB uses its fixed user configuration directory. Preserve existing user files.
# The cloud snapshot retains this helper link; setup on a new host may need its
# normal filesystem permission for this one directory, never a change to HOME.
if [[ ! -e "$HOME/.android" && ! -L "$HOME/.android" ]]; then
  ln -s /workspace/android-user "$HOME/.android"
fi
if [[ ! -x "$ANDROID_HOME/platform-tools/adb" || ! -f "$ANDROID_HOME/platforms/android-36/android.jar" || ! -x "$ANDROID_HOME/build-tools/36.0.0/aapt" ]]; then
  # A finite input avoids a SIGPIPE/pipefail false result after the SDK tool closes stdin.
  python3 - <<'PY'
import os, subprocess
args=[os.environ['ANDROID_HOME']+'/cmdline-tools/latest/bin/sdkmanager', '--sdk_root='+os.environ['ANDROID_HOME'],
      'platform-tools','platforms;android-36','build-tools;36.0.0']
subprocess.run(args,input='y\n'*40,text=True,check=True)
PY
fi
npm ci --cache /tmp/workflow-native-npm-cache
npm run sync:android
"$JAVA_HOME/bin/javac" -version
"$ANDROID_HOME/platform-tools/adb" version
node tools/onboarding/verify-upstream.mjs
