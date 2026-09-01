@echo off
title Image Forge
color 0E
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js is not on this computer yet.
  echo   Get it from https://nodejs.org (the big green LTS button), install it,
  echo   then double-click this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo   First run — downloading the parts ^(a few minutes^)...
  call npm install
  if errorlevel 1 ( echo   npm install failed — check your internet. & pause & exit /b 1 )
)

echo.
echo   Starting the forge...
echo   A browser link will appear below — hold Ctrl and click it.
echo   To stop, press Ctrl+C in this window.
echo.
call npm run dev
pause
