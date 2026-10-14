# Launch the native SoundConnect Desktop window (tauri dev).
# Adds the Rust toolchain to PATH for shells opened before rustup was installed;
# without it `tauri dev` fails with "cargo metadata ... program not found".
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if ($env:Path -notlike "*$cargoBin*") { $env:Path = "$cargoBin;$env:Path" }
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

# The engine DLLs (mdr-shared.dll, mdr-bt-shared.dll). src-tauri/crates/mdr-sys/build.rs
# links them from here and copies them next to target/debug/soundconnect-desktop.exe.
if (-not $env:MDR_ENGINE_BIN) { $env:MDR_ENGINE_BIN = Join-Path $root 'engine\bin\RelWithDebInfo' }
if (-not (Test-Path (Join-Path $env:MDR_ENGINE_BIN 'mdr-shared.dll'))) {
    Write-Error "Engine DLLs missing in $env:MDR_ENGINE_BIN; run tools/fetch-engine.ps1 first."
    exit 1
}

# The upstream client holds the headphones' RFCOMM channel while it runs.
Get-Process SonyHeadphonesClient -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Stopping SonyHeadphonesClient (pid $($_.Id)): it holds the RFCOMM channel."
    $_ | Stop-Process
}

pnpm dev
