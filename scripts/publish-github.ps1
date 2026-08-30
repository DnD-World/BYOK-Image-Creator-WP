# Publish Image Forge to GitHub — one-click push.
# Run via scripts/publish-github.bat (double-click) or: powershell -File scripts/publish-github.ps1

param([string]$RepoUrl = "")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor DarkGray }

# 1. git installed?
try { $null = & git --version } catch {
  Write-Host "git is not installed. Grab it from https://git-scm.com/download/win, install it," -ForegroundColor Red
  Write-Host "then close and re-open this script." -ForegroundColor Red
  exit 1
}

# 2. repository URL
if (-not $RepoUrl) {
  Write-Host ""
  Write-Host "First create an EMPTY repository on github.com (New repository -> name it" -ForegroundColor Yellow
  Write-Host "'image-forge' -> do NOT add README/license/.gitignore -> Create)." -ForegroundColor Yellow
  $RepoUrl = Read-Host "Now paste its URL (https://github.com/YOU/image-forge.git)"
}
if ($RepoUrl -notmatch "^https?://") { $RepoUrl = "https://$RepoUrl" }
$RepoUrl = $RepoUrl.TrimEnd('/')
if ($RepoUrl -notmatch "\.git$") { $RepoUrl += ".git" }

# 3. init + add + commit
if (-not (Test-Path ".git")) { Step "git init"; & git init | Out-Null }
Step "git add ."
& git add .
Step "git commit"
& git commit -m "Image Forge - BYOK image pipeline"
Step "git branch -M main"
& git branch -M main

# 4. point origin at your repo
$existing = & git remote get-url origin 2>$null
if ($existing) { & git remote set-url origin $RepoUrl } else { & git remote add origin $RepoUrl }

# 5. push
Step "git push -u origin main  (a sign-in window or token prompt may appear)"
& git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Push failed. The two usual causes:" -ForegroundColor Red
  Write-Host "  1. AUTH — GitHub no longer accepts passwords. Create a Personal Access Token"
  Write-Host "     (github.com > Settings > Developer settings > Personal access tokens > classic,"
  Write-Host "     tick 'repo') and paste it when the password is asked. Or use GitHub Desktop."
  Write-Host "  2. 'Updates were rejected / remote contains work' — you created the repo WITH a"
  Write-Host "     README. Fix with:  git pull origin main --allow-unrelated-histories"
  Write-Host "     then run this script again."
  exit 1
}

Write-Host ""
Write-Host "Done — your Image Forge is live at:" -ForegroundColor Green
Write-Host ("    " + $RepoUrl.Replace('.git', '')) -ForegroundColor Cyan
Write-Host ""
Write-Host "Next step, the executable:   node scripts/build-exe.js" -ForegroundColor DarkGray
