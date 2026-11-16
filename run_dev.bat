@echo off
title AxioMedica Dev Launcher
echo ======================================================================
echo   Starting AxioMedica Tele-Rehab (FastAPI Backend + Expo Mobile)
echo ======================================================================

echo.
echo [1/2] Starting FastAPI Backend on http://localhost:8000...
start "AxioMedica Backend" cmd /k "cd /d %~dp0backend && set PYTHONPATH=. && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo.
echo [2/2] Starting Expo Metro Bundler on http://localhost:8081...
start "AxioMedica Mobile" cmd /k "cd /d %~dp0mobile && npx expo start"

echo.
echo ======================================================================
echo   Services launched in separate windows!
echo   - Backend API Docs:   http://localhost:8000/docs
echo   - ML Status:          http://localhost:8000/api/v1/ml/status
echo   - Mobile Bundler:     http://localhost:8081
echo ======================================================================
pause
