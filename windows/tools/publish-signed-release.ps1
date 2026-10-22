$ErrorActionPreference = 'Stop'
$head = gh api "repos/$env:GITHUB_REPOSITORY/branches/main" --jq .commit.sha
if ($LASTEXITCODE -ne 0 -or $head -cne $env:GITHUB_SHA) { throw 'main changed; revalidate the current commit.' }
@"
Workflow PDF Pro für Windows $env:VERSION (Windows 10/11, 64 Bit).

Der Installer trägt eine geprüfte Windows-Herausgebersignatur mit Zeitstempel.
Updates werden automatisch gesucht und nach Bestätigung installiert. Vor der Installation werden Signatur und Version geprüft und der Arbeitsstand gespeichert.
Über Windows 1.0.1 installieren, vorher nicht deinstallieren. Die Android-App bleibt unverändert.

Windows-Bau und Abnahme: https://github.com/$env:GITHUB_REPOSITORY/actions/runs/$env:RUN
Auf Klaus' eigenem Windows-PC noch nicht gemessen.
"@ | Set-Content "$env:RUNNER_TEMP/windows-notes.md" -Encoding utf8
gh release create $env:RELEASE_TAG --repo $env:GITHUB_REPOSITORY --target $env:GITHUB_SHA --latest=false --title "Workflow PDF Pro für Windows $env:VERSION" --notes-file "$env:RUNNER_TEMP/windows-notes.md" "release-files/$env:INSTALLER" "release-files/$env:INSTALLER.sha256" "release-files/$env:INSTALLER.sig" release-files/latest.json
if ($LASTEXITCODE -ne 0) { throw 'Release publication failed.' }
try {
    New-Item -ItemType Directory check | Out-Null
    foreach ($name in @($env:INSTALLER, "$env:INSTALLER.sig", "$env:INSTALLER.sha256", 'latest.json')) {
        Invoke-WebRequest "https://github.com/$env:GITHUB_REPOSITORY/releases/download/$env:RELEASE_TAG/$name" -OutFile "check/$name" -TimeoutSec 120
        if ((Get-FileHash "check/$name").Hash -cne (Get-FileHash "release-files/$name").Hash) { throw 'Public download differs.' }
    }
    & "$PSScriptRoot/verify-windows-signature.ps1" -File "check/$env:INSTALLER" -ExpectedSubject $env:PUBLISHER
    node windows/tools/update-feed.mjs check $env:VERSION windows/signing/updater.pub
    if ($LASTEXITCODE -ne 0) { throw 'Downloaded update signature failed.' }
} catch {
    gh release edit $env:RELEASE_TAG --repo $env:GITHUB_REPOSITORY --draft
    throw
}
# Version releases are immutable by policy. Only this separate pointer changes.
gh release view windows-updates --repo $env:GITHUB_REPOSITORY 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    gh release create windows-updates --repo $env:GITHUB_REPOSITORY --target $env:GITHUB_SHA --latest=false --title 'Workflow PDF Pro Windows – Update-Adresse' --notes 'Nur der Update-Zeiger wird aktualisiert. Versions-Releases bleiben erhalten.'
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create update feed.' }
}
gh release upload windows-updates release-files/latest.json --clobber --repo $env:GITHUB_REPOSITORY
if ($LASTEXITCODE -ne 0) { throw 'Cannot publish update feed.' }
Invoke-WebRequest "https://github.com/$env:GITHUB_REPOSITORY/releases/download/windows-updates/latest.json" -OutFile "$env:RUNNER_TEMP/windows-feed.json" -TimeoutSec 60
if ((Get-FileHash "$env:RUNNER_TEMP/windows-feed.json").Hash -cne (Get-FileHash release-files/latest.json).Hash) { throw 'Published update feed differs.' }
