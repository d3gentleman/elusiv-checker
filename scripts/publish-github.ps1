# Creates the GitHub repo and pushes (requires: gh auth login)
$ErrorActionPreference = "Stop"
$gh = "C:\Program Files\GitHub CLI\gh.exe"

if (-not (Test-Path $gh)) {
  Write-Error "GitHub CLI not found. Install: winget install GitHub.cli"
}

Set-Location (Split-Path $PSScriptRoot -Parent)

if (git ls-files --error-unmatch .env 2>$null) {
  Write-Error ".env is tracked by git — aborting. Run: git rm --cached .env"
}

& $gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Run: gh auth login"
  exit 1
}

& $gh repo create elusiv-checker `
  --public `
  --description "Check Solana wallets for Elusiv pool deposits and withdrawals (SOL/USDC)" `
  --source=. `
  --remote=origin `
  --push

Write-Host "Done. Repo: https://github.com/$(gh api user -q .login)/elusiv-checker"
