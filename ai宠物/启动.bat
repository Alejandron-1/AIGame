@echo off
chcp 65001 >nul
cd /d "%~dp0"
title AI宠物乐园服务
set "PY=%~dp0..\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=py -3.9"
echo ============================================
echo   🐱 AI宠物乐园 正在启动...
echo   展示端   http://127.0.0.1:5175/show
echo   管理后台 http://127.0.0.1:5175/admin
echo   （关闭本窗口 = 停止服务）
echo ============================================
%PY% server.py --open
pause
