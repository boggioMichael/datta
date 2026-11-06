@echo off
rem The No Bank sharing server. Double-click to start; close this window to stop.
rem Brings this copy of the site up to date first (when git is installed), so the server
rem always matches the live page. The block below is read whole before it runs, so an
rem update to this very file can't trip it up.
setlocal
cd /d "%~dp0"
title DATTA piggy server
(
  where node >nul 2>nul || (
    echo Node.js is not installed. Install it once, then start this again:
    echo   winget install -e --id OpenJS.NodeJS.LTS
    pause
    exit /b 1
  )
  where git >nul 2>nul && git pull --ff-only --quiet
  node server.mjs
  pause
  exit /b
)
