param(
    [Parameter(Mandatory=$true)][string]$File,
    [Parameter(Mandatory=$true)][string]$ExpectedSubject
)
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($ExpectedSubject)) { throw 'A verified publisher identity is required.' }
$signature = Get-AuthenticodeSignature -LiteralPath $File
if ($signature.Status -ne 'Valid' -or !$signature.SignerCertificate) { throw 'Installer Authenticode signature is not trusted or valid.' }
if ($signature.SignerCertificate.Subject -cne $ExpectedSubject) { throw 'Installer publisher does not match the configured identity.' }
if (!$signature.TimeStamperCertificate) { throw 'A trusted timestamp is required.' }
$eku = $signature.SignerCertificate.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.37' }
if (!$eku -or !($eku.EnhancedKeyUsages | Where-Object { $_.Value -eq '1.3.6.1.5.5.7.3.3' })) { throw 'The certificate is not a code-signing certificate.' }
Write-Output 'Installer signature, publisher, code-signing purpose and timestamp verified.'
