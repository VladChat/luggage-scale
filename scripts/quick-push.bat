@echo off
REM Always forward everything to PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0quick-push.ps1" -Message "%*"
