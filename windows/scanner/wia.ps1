# Scanner über Windows-WIA (Pro-Umbau 5). Quelle: Workflow PDF Pro windows/scanner/, byte-gleich in jeder Pro-Hülle.
# Der Auftrag kommt nur als Base64-JSON in der Umgebung (PRO_SCANNER_AUFTRAG), nie als Befehlstext.
# Antwort: eine Zeile JSON auf stdout. Bilder legt das Skript als Dateien in den Ordner des Auftrags (ziel).
$ErrorActionPreference = 'Stop'
$JPEG = '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'
function Antwort($o) { [Console]::Out.Write(($o | ConvertTo-Json -Depth 6 -Compress)); exit 0 }
function Code($e) {
  $h = 0; try { $h = $e.Exception.HResult } catch {}
  if ($e.Exception.InnerException) { try { $h = $e.Exception.InnerException.HResult } catch {} }
  switch ($h) { -2145320957 { 'SCANNER_KEIN_PAPIER' } -2145320954 { 'SCANNER_BESCHAEFTIGT' } -2145320955 { 'SCANNER_WEG' } -2145320953 { 'SCANNER_WEG' } default { 'SCANNER_FEHLER' } }
}
function Setze($props, $id, $wert) { foreach ($p in $props) { if ($p.PropertyID -eq $id) { try { $p.Value = $wert } catch {} ; return } } }
function Lies($props, $id) { foreach ($p in $props) { if ($p.PropertyID -eq $id) { return $p.Value } } return $null }
function AlsJpeg($img) {
  if ($img.FormatID -eq $JPEG) { return $img }
  $ip = New-Object -ComObject WIA.ImageProcess
  $ip.Filters.Add($ip.FilterInfos.Item('Convert').FilterID)
  $ip.Filters.Item(1).Properties.Item('FormatID').Value = $JPEG
  $ip.Filters.Item(1).Properties.Item('Quality').Value = 92
  return $ip.Apply($img)
}
try { $a = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:PRO_SCANNER_AUFTRAG)) | ConvertFrom-Json } catch { Antwort @{ fehler = 'SCANNER_AUFTRAG' } }
try { $dm = New-Object -ComObject WIA.DeviceManager } catch { Antwort @{ fehler = 'SCANNER_WIA_FEHLT' } }
if ($a.aktion -eq 'geraete') {
  $liste = @()
  foreach ($d in $dm.DeviceInfos) {
    if ($d.Type -ne 1 -and $d.Type -ne 2) { continue }
    $name = ''; try { $name = [string]$d.Properties.Item('Name').Value } catch {}
    $port = ''; try { $port = [string]$d.Properties.Item('Port').Value } catch {}
    $verbindung = if ($port -match '(?i)usb') { 'usb' } elseif ($port -match '(?i)wsd|http|ip|tcp|net|esc') { 'netz' } else { '' }
    $einzug = $false; $glas = $true
    if ($d.Type -eq 1) {
      try { $dev = $d.Connect(); $f = Lies $dev.Properties 3086; if ($f -ne $null) { $einzug = (($f -band 1) -ne 0); $glas = (($f -band 2) -ne 0) -or -not $einzug } } catch {}
    }
    $liste += @{ id = [string]$d.DeviceID; name = $name; art = $(if ($d.Type -eq 2) { 'kamera' } else { 'scanner' }); verbindung = $verbindung; einzug = $einzug; glas = $glas }
  }
  Antwort @{ geraete = @($liste) }
}
if ($a.aktion -ne 'scannen') { Antwort @{ fehler = 'SCANNER_AUFTRAG' } }
$info = $null; foreach ($d in $dm.DeviceInfos) { if ([string]$d.DeviceID -eq [string]$a.geraet) { $info = $d } }
if (-not $info) { Antwort @{ fehler = 'SCANNER_FEHLT' } }
try { $dev = $info.Connect() } catch { Antwort @{ fehler = (Code $_) } }
$dateien = @(); $n = 0
function Ablegen($img) { $script:n++; $pfad = Join-Path $a.ziel ('seite-' + $script:n.ToString('000') + '.jpg'); (AlsJpeg $img).SaveFile($pfad); $script:dateien += $pfad }
if ($info.Type -eq 2) {
  # Kamera über WIA: die neuesten Aufnahmen (höchstens 30), älteste zuerst.
  $zahl = $dev.Items.Count; $von = [Math]::Max(1, $zahl - 29)
  for ($i = $von; $i -le $zahl; $i++) { try { Ablegen ($dev.Items.Item($i).Transfer($JPEG)) } catch {} }
  Antwort @{ dateien = @($dateien) }
}
Setze $dev.Properties 3088 $(if ($a.quelle -eq 'einzug') { 1 } else { 2 })
$item = $dev.Items.Item(1)
Setze $item.Properties 6146 $(switch ($a.farbe) { 'grau' { 2 } 'sw' { 4 } default { 1 } })
Setze $item.Properties 6147 ([int]$a.dpi); Setze $item.Properties 6148 ([int]$a.dpi)
while ($true) {
  try { Ablegen ($item.Transfer($JPEG)) }
  catch { $c = Code $_; if ($c -eq 'SCANNER_KEIN_PAPIER' -and $dateien.Count -gt 0) { break }; Antwort @{ fehler = $c } }
  if ($a.quelle -ne 'einzug' -or $dateien.Count -ge 100) { break }
}
Antwort @{ dateien = @($dateien) }
