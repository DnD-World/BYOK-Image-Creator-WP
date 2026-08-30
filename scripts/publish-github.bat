@echo off
title Publish Image Forge to GitHub
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish-github.ps1" %*
echo.
pause
