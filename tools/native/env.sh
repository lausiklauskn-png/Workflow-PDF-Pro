#!/usr/bin/env bash
# Source this file for a local Android build. No credential values are read or written.
export JAVA_HOME=/workspace/jdk/jdk-21.0.12.1
export ANDROID_HOME=/workspace/android-sdk
export ANDROID_USER_HOME=/workspace/android-user
export GRADLE_USER_HOME=/workspace/.gradle
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts"
if [[ -n "${HTTPS_PROXY:-}" ]]; then
  # Proxy host/port only: never copy authentication into a properties file or logs.
  native_proxy=$(python3 -c 'import os,urllib.parse; p=urllib.parse.urlsplit(os.environ["HTTPS_PROXY"]); print(p.hostname or ""); print(p.port or 8080)')
  native_proxy_host=${native_proxy%%$'\n'*}
  native_proxy_port=${native_proxy##*$'\n'}
  export JAVA_TOOL_OPTIONS="$JAVA_TOOL_OPTIONS -Dhttps.proxyHost=$native_proxy_host -Dhttps.proxyPort=$native_proxy_port -Dhttp.proxyHost=$native_proxy_host -Dhttp.proxyPort=$native_proxy_port"
  unset native_proxy native_proxy_host native_proxy_port
fi
