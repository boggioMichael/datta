@echo off
rem The No Bank sharing server. Double-click to start; close this window to stop.
cd /d "%~dp0"
title DATTA piggy server
node server.mjs
pause
