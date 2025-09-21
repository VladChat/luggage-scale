@echo off
set MSG=%*
if "%MSG%"=="" set MSG=update
powershell -ExecutionPolicy Bypass -File "%~dp0quick-push.ps1" -Message "%MSG%"
