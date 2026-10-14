# Serve the renderer alone at http://localhost:1420 for browser review.
# VITE_MOCK_ENGINE=1 selects the recorded-snapshot mock engine (wired in by the
# renderer bootstrap task); until then the variable is simply unused.
$env:VITE_MOCK_ENGINE = '1'
Set-Location (Split-Path $PSScriptRoot -Parent)
pnpm dev:web
