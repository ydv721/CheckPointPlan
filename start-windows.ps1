# Run this script inside the CHECKPOINT project folder on Windows PowerShell.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is not installed. Please install Node.js LTS." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is not available." }
if (-not (Test-Path .env.local)) {
    Copy-Item .env.example .env.local
    Write-Host "Created .env.local from example. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY before login." -ForegroundColor Yellow
}
Write-Host "Installing CHECKPOINT dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed. Check network connectivity and npm registry." }
Write-Host "Starting CHECKPOINT at http://localhost:3000" -ForegroundColor Cyan
npm run dev
