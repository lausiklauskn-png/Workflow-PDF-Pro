#!/usr/bin/env bash
# Gegenprobe Android (VaultCrypto.java, unverändert) <-> Windows (wfp-core), beide Richtungen.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd); repo=$(cd "$here/../../.." && pwd)
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
mkdir -p "$work/classes"
javac -d "$work/classes" "$repo/android/app/src/main/java/de/familyprojekt/workflowpdf/pro/VaultCrypto.java" "$here/VaultCompat.java" "$here/RecoveryCompat.java" "$repo/android/app/src/main/java/de/familyprojekt/workflowpdf/pro/VaultRecovery.java"
head -c 900000 /dev/urandom > "$work/daten.bin"
# Gleiches Passwort in zwei Unicode-Schreibweisen (zusammengesetzt / zerlegt): NFC muss beide öffnen.
printf 'Gem\xc3\xa4\xc3\x9figtes Passwort \xe2\x82\xac' > "$work/pw-nfc"
printf 'Gema\xcc\x88\xc3\x9figtes Passwort \xe2\x82\xac' > "$work/pw-nfd"
expected=$(sha256sum "$work/daten.bin" | cut -d' ' -f1)
cargo build --quiet --release --example compat --manifest-path "$here/../Cargo.toml"
bin="$here/../target/release/examples/compat"
# Android legt an, Windows liest.
a=$(java -cp "$work/classes" de.familyprojekt.workflowpdf.pro.VaultCompat write "$work/android" "$work/pw-nfd" "$work/daten.bin" 2>/dev/null)
b=$("$bin" read "$work/android" "$(cat "$work/pw-nfc")")
# Windows legt an, Android liest.
mkdir -p "$work/windows"
c=$("$bin" write "$work/windows" "$(cat "$work/pw-nfc")" "$work/daten.bin")
d=$(java -cp "$work/classes" de.familyprojekt.workflowpdf.pro.VaultCompat read "$work/windows/Workflow PDF Pro" "$work/pw-nfd" 2>/dev/null)
for v in "$a" "$b" "$c" "$d"; do test "$v" = "$expected" || { echo "ROT: $a $b $c $d (erwartet $expected)"; exit 1; }; done
# Ersatzschlüssel: Teile der einen Seite setzt die andere zusammen (je zwei Dreierauswahlen).
geheim=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
mapfile -t jt < <(java -cp "$work/classes" de.familyprojekt.workflowpdf.pro.RecoveryCompat split "$geheim" 2>/dev/null)
mapfile -t rt < <("$bin" share-split "$geheim")
test "${#jt[@]}" = 5 && test "${#rt[@]}" = 5
for auswahl in "0 2 4" "3 1 0"; do
  set -- $auswahl
  r=$("$bin" share-combine "${jt[$1]}" "${jt[$2]}" "${jt[$3]}")
  j=$(java -cp "$work/classes" de.familyprojekt.workflowpdf.pro.RecoveryCompat combine "${rt[$1]}" "${rt[$2]}" "${rt[$3]}" 2>/dev/null)
  test "$r" = "$geheim" && test "$j" = "$geheim" || { echo "ROT: Ersatzschlüssel $auswahl"; exit 1; }
done
echo "Gegenprobe Android <-> Windows bestanden: $expected; Ersatzschlüssel beidseitig gleich"
