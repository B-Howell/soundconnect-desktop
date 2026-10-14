# Builds upstream libmdr + libmdr-bt as DLLs for the Rust core. Output: engine/bin/<config>/.
# Requires CMake >= 3.31 and MSVC. Does NOT build the ImGui client.
param([string]$Config = "RelWithDebInfo")
$ErrorActionPreference = "Stop"
$cmakeBin = "C:\Program Files\CMake\bin"
if ((Test-Path $cmakeBin) -and ($env:Path -notlike "*$cmakeBin*")) { $env:Path = "$cmakeBin;$env:Path" }
$root = Split-Path $PSScriptRoot -Parent
$src = Join-Path $root "upstream\SonyHeadphonesClient"
$build = Join-Path $root "engine\build"
$out = Join-Path $root "engine\bin\$Config"
if (-not (Test-Path (Join-Path $src "CMakeLists.txt"))) { throw "submodule missing: run git submodule update --init" }
# CMake ignores Visual Studio instances that vswhere reports as isComplete=0 (the VS 2019
# Build Tools on the maintainer's machine), so name the newest instance with MSVC explicitly.
$genArgs = @()
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
  $vs = & $vswhere -all -products * -format json | ConvertFrom-Json |
    Where-Object { Test-Path (Join-Path $_.installationPath "VC\Tools\MSVC") } |
    Sort-Object { [version]$_.installationVersion } -Descending | Select-Object -First 1
  if ($vs) {
    $major = ([version]$vs.installationVersion).Major
    $year = @{ 16 = "2019"; 17 = "2022" }[$major]
    if ($year) {
      $genArgs = @("-G", "Visual Studio $major $year",
        "-DCMAKE_GENERATOR_INSTANCE=$($vs.installationPath),version=$($vs.installationVersion)")
    }
  }
}
cmake -S $src -B $build -A x64 @genArgs `
  -DMDR_BUILD_CLIENT=OFF -DMDR_ENABLE_CODEGEN=OFF -DMDR_BUILD_SHARED=ON `
  -DBUILD_TESTING=ON -DMDR_ENABLE_LOG=ON
if ($LASTEXITCODE -ne 0) { throw "cmake configure failed" }
cmake --build $build --config $Config --target mdr_shared mdr-bt_shared mdr_replay_tests mdr_abi_tests
if ($LASTEXITCODE -ne 0) { throw "cmake build failed" }
New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem $build -Recurse -Include "mdr-shared.dll","mdr-shared.lib","mdr-bt-shared.dll","mdr-bt-shared.lib","mdr_replay_tests.exe" |
  Where-Object { $_.FullName -like "*\$Config\*" } | Copy-Item -Destination $out -Force
Get-ChildItem $out | Format-Table Name, Length
