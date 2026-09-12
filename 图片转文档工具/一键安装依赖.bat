@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem ===== 自动挑选 Python 3.9+（优先用项目自带的 .venv，其次 py 启动器） =====
set "PY=%~dp0..\.venv\Scripts\python.exe"
if exist "%PY%" goto :run
where py >nul 2>nul && (set "PY=py -3.9" & goto :run)
set "PY=python"

:run
echo 使用解释器：%PY%
echo 开始安装 OCR 与 Word 组件（联网，约2~5分钟）...
%PY% -m pip install -r requirements.txt
if errorlevel 1 (
    echo 默认源安装失败，换官方源重试...
    %PY% -m pip install -r requirements.txt -i https://pypi.org/simple
)
echo.
echo 完成！以后把练习卷截图拖到「拖入图片转文档.bat」上即可。
pause
