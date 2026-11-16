# AxioMedica All-In-One Dev Launcher (PowerShell)
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  Starting AxioMedica Tele-Rehab (FastAPI Backend + Expo Mobile)" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Start Backend in new window
Write-Host "`n[1/2] Starting FastAPI Backend on http://localhost:8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir\backend'; `$env:PYTHONPATH='.'; python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

# 2. Start Mobile in new window
Write-Host "[2/2] Starting Expo Metro Bundler on http://localhost:8081..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir\mobile'; npx expo start"

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "  Both services have been launched in dedicated terminal windows!" -ForegroundColor Green
Write-Host "  - Backend API Docs:   http://localhost:8000/docs" -ForegroundColor White
Write-Host "  - ML Model Status:    http://localhost:8000/api/v1/ml/status" -ForegroundColor White
Write-Host "  - Mobile Dev Server:  http://localhost:8081" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan
