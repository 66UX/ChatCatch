@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 20 or newer. See README.md.
  pause
  exit /b 1
)
echo Open http://localhost:8787 in your browser.
node dev.mjs
pause
