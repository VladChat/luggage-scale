@echo off
setlocal EnableDelayedExpansion
set "MSG=%*"
rem strip any outer quotes the user typed so we don't double-quote later
set "MSG=%MSG:"=%"

if "%MSG%"=="" set "MSG=update"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0quick-push.ps1" -Message "%MSG%"
endlocal
