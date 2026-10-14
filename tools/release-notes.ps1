# Writes the GitHub Release body for one version: install steps for an
# ordinary user first, then the CHANGELOG section, then the developer assets.
# Used by .github/workflows/release.yml, and by hand to re-edit an older
# release (gh release edit v<version> --notes-file <Out>).
#
#   pwsh tools/release-notes.ps1 -Version 0.1.9 -EngineZip engine-dlls-4c91fe6.zip -Out release-notes.md
#   pwsh tools/release-notes.ps1 -Version 0.1.9 -ChangelogOnly -Out changelog-section.md
#
# -ChangelogOnly writes just the "## <Version>" section (the updater's
# latest.json "notes"). See docs/tooling/SoundConnect Desktop - Build Toolchain.md (Releases).
param(
  [Parameter(Mandatory)] [string] $Version,
  [string] $EngineZip = "",
  [string] $Repo = "B-Howell/soundconnect-desktop",
  [switch] $ChangelogOnly,
  [Parameter(Mandatory)] [string] $Out
)
$ErrorActionPreference = "Stop"
# .NET resolves relative paths against the process directory, not PowerShell's location.
$Out = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Out)
$root = Split-Path $PSScriptRoot -Parent
$lines = Get-Content -Encoding utf8 (Join-Path $root "CHANGELOG.md")
$start = [array]::FindIndex($lines, [Predicate[string]] { param($l) $l -match "^## $([regex]::Escape($Version))( |$)" })
if ($start -lt 0) { throw "CHANGELOG.md has no '## $Version' section" }
$section = New-Object System.Collections.Generic.List[string]
for ($i = $start + 1; $i -lt $lines.Count -and $lines[$i] -notmatch '^## '; $i++) { $section.Add($lines[$i]) }
$changes = ($section -join "`n").Trim()

if ($ChangelogOnly) {
  [IO.File]::WriteAllText($Out, $changes, [Text.UTF8Encoding]::new($false))
  return
}

$base = "https://github.com/$Repo/releases/download/v$Version"
# 0.1.9 is the first version with the in-app updater (latest.json and a .sig).
$updater = [version]$Version -ge [version]'0.1.9'
$selfUpdate = if ($updater) { 'Already on 0.1.9 or later? SoundConnect updates itself (Settings, Updates).' } else { 'From 0.1.9 on, SoundConnect updates itself (Settings, Updates).' }
$versioned = if ($updater) { "the same installer under its versioned name; the in-app updater downloads this one and checks it against $setup.sig." } else { 'the same installer under its versioned name.' }
$setup = "SoundConnect.Desktop_${Version}_x64-setup.exe"
$body = @"
## Install (Windows 10/11)

1. Download **[SoundConnect-Desktop-Setup.exe]($base/SoundConnect-Desktop-Setup.exe)**.
2. Run it. If Windows shows "Windows protected your PC", click **More info**, then **Run anyway** (the app is not code-signed). It installs for your user only, with no admin prompt.
3. Open **SoundConnect Desktop** from the Start menu, pair your headphones in Windows Bluetooth settings if you have not, and follow the setup wizard.

$selfUpdate

## What's new

$changes

## For developers

- [$setup]($base/$setup): $versioned
- $(if ($EngineZip) { "[$EngineZip]($base/$EngineZip): the prebuilt engine DLLs and import libraries, for building from source." } else { "engine-dlls-<sha>.zip: the prebuilt engine DLLs and import libraries, for building from source." })
- [SHA256SUMS.txt]($base/SHA256SUMS.txt): checksums of every file above.

Not affiliated with Sony.
"@
# UTF-8 without a BOM on both Windows PowerShell 5.1 and pwsh 7.
[IO.File]::WriteAllText($Out, $body, [Text.UTF8Encoding]::new($false))
