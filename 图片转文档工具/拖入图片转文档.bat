@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PY=%~dp0..\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=py -3.9"
if "%~1"=="" (
    %PY% "%~dp0图片转文档.py"
) else (
    %PY% "%~dp0图片转文档.py" %*
)
if errorlevel 1 pause
