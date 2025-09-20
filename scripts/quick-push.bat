@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0quick-push.ps1" -Message "%*"