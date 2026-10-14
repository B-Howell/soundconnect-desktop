# Downloads the CI-built engine DLLs (artifact "engine-win-x64" from
# .github/workflows/engine.yml) for the current branch into engine/bin/RelWithDebInfo,
# then verifies SHA256SUMS.txt and that UPSTREAM_COMMIT.txt matches the pinned submodule.
# Requires an authenticated `gh` CLI. See docs/tooling/SoundConnect Desktop - Engine Build.md.
param(
  [string]$Branch = (git -C (Split-Path $PSScriptRoot -Parent) rev-parse --abbrev-ref HEAD),
  [string]$RunId = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$dest = Join-Path $root "engine\bin\RelWithDebInfo"

if (-not $RunId) {
  $runs = gh run list --workflow engine.yml --branch $Branch --status success --limit 1 --json databaseId,headSha,createdAt | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "gh run list failed" }
  if (-not $runs) { throw "no successful engine.yml run on branch '$Branch'; push or run: gh workflow run engine.yml --ref $Branch" }
  $RunId = "$($runs[0].databaseId)"
  Write-Host "Using run $RunId (commit $($runs[0].headSha), $($runs[0].createdAt))"
  $localHead = git -C $root rev-parse HEAD
  if ($runs[0].headSha -ne $localHead) {
    Write-Warning "run was built from $($runs[0].headSha), local HEAD is $localHead (the upstream pin is still checked below)"
  }
}

# Download into a staging folder so a failed download or verification never
# leaves engine/bin/RelWithDebInfo empty or half-replaced.
$stage = Join-Path $root "engine\bin\.fetch-staging"
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $stage | Out-Null
gh run download $RunId -n engine-win-x64 -D $stage
if ($LASTEXITCODE -ne 0) { Remove-Item -Recurse -Force $stage; throw "gh run download failed for run $RunId" }
$final = $dest
$dest = $stage

# Verify every hash line; also fail if the artifact has files the manifest does not list.
$sums = Join-Path $dest "SHA256SUMS.txt"
if (-not (Test-Path $sums)) { throw "artifact has no SHA256SUMS.txt" }
$listed = @{}
foreach ($line in Get-Content $sums) {
  if (-not $line.Trim()) { continue }
  $hash, $name = $line -split "\s+", 2
  $file = Join-Path $dest $name
  if (-not (Test-Path $file)) { throw "listed file missing: $name" }
  $actual = (Get-FileHash -Algorithm SHA256 $file).Hash.ToLower()
  if ($actual -ne $hash.ToLower()) { throw "SHA-256 mismatch for ${name}: expected $hash, got $actual" }
  $listed[$name] = $true
}
$unlisted = Get-ChildItem $dest -File | Where-Object { $_.Name -ne "SHA256SUMS.txt" -and -not $listed[$_.Name] }
if ($unlisted) { throw "files not in SHA256SUMS.txt: $($unlisted.Name -join ', ')" }
Write-Host "SHA256SUMS.txt verified ($($listed.Count) files)"

# The DLLs must come from the exact upstream commit this checkout pins (the gitlink
# recorded in HEAD, not whatever is checked out in the submodule).
$pinned = (git -C $root rev-parse HEAD:upstream/SonyHeadphonesClient).Trim()
if ($LASTEXITCODE -ne 0) { throw "cannot read the upstream submodule pin" }
$built = (Get-Content (Join-Path $dest "UPSTREAM_COMMIT.txt") -Raw).Trim()
if ($built -ne $pinned) { throw "artifact built from upstream $built but submodule pins $pinned" }
Write-Host "UPSTREAM_COMMIT.txt matches submodule pin ($pinned)"

if (Test-Path $final) { Remove-Item -Recurse -Force $final }
Move-Item $stage $final
$dest = $final
Get-ChildItem $dest -File | Sort-Object Name | Format-Table Name, Length -AutoSize
