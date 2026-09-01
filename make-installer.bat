@echo off
title Image Forge — making your installer
color 0E
cd /d "%~dp0"

echo.
echo   ===============================================
echo     IMAGE FORGE - installer maker
echo   ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js is not on this computer yet.
  echo.
  echo   1. Open  https://nodejs.org
  echo   2. Click the big green LTS button, install it (Next, Next, Next)
  echo   3. Double-click this file again
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo   First run — downloading the parts ^(this is the slow bit, a few minutes^)...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   npm install failed — check your internet and double-click this file again.
    pause
    exit /b 1
  )
  echo.
)

call node scripts\build-exe.js
if errorlevel 1 (
  echo.
  echo   Something failed — scroll up for the reason, fix it, and run this again.
  pause
  exit /b 1
)

echo.
echo   All done! Opening the release folder...
if exist release explorer release
echo.
pause
