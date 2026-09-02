@echo off
title Image Forge
color 0E
cd /d "%~dp0"

echo.
echo   ===============================================
echo     IMAGE FORGE
echo   ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js is not on this computer yet.
  echo   Get it from https://nodejs.org ^(the big green LTS button^), install it,
  echo   then double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo   First run - downloading the parts ^(a few minutes^)...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   npm install failed - check your internet and try again.
    pause
    exit /b 1
  )
  echo.
)

REM If it is already running, just open the browser and stop.
curl -s -o nul --max-time 2 http://localhost:3000 >nul 2>nul
if not errorlevel 1 (
  echo   The forge is already running. Opening it...
  start "" http://localhost:3000
  timeout /t 2 >nul
  exit /b 0
)

echo   Starting the forge. Your browser will open in a moment.
echo.
echo   Leave this black window OPEN while you work.
echo   To stop the forge, close this window.
echo.

REM Open the browser once the server is actually answering.
start "" cmd /c "for /l %%i in (1,1,60) do (curl -s -o nul --max-time 1 http://localhost:3000 && (start "" http://localhost:3000 & exit) || timeout /t 1 >nul)"

call npm run dev

echo.
echo   The forge has stopped.
pause
