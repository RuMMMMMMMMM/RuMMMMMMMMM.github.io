@echo off
chcp 65001 >nul
title 荔枝产销协同平台 - 演示服务器
echo ============================================================
echo   荔枝产销协同决策智能体平台 - 演示服务器启动
echo   启动后：手机连本机同一 WiFi，扫 扫码进入.png 即可打开平台
echo   互联网访问（无需同网）: https://RuMMMMMMMMM.github.io/
echo ============================================================
echo.

rem 1) 尝试放行防火墙入站端口（需管理员权限，失败不影响本机/回环访问）
netsh advfirewall firewall add rule name="荔枝产销协同平台演示(8080/8000/8899/9090)" dir=in action=allow protocol=TCP localport=8080,8000,8899,9090 >nul 2>nul
netsh advfirewall firewall add rule name="荔枝平台演示-Python" dir=in action=allow program="%SystemRoot%\System32\cmd.exe" >nul 2>nul

rem 2) 选择 Python：优先系统 PATH 的 python，其次 py 启动器，最后内置运行库
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY ( where py >nul 2>nul && set "PY=py -3" )
if not defined PY ( if exist "%LOCALAPPDATA%\..\..\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" set "PY=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" )
if not defined PY (
  echo [错误] 未找到 Python，请安装 Python 3 后重试。
  pause
  exit /b 1
)

rem 3) 启动演示服务器（自动探测局域网 IP、自动生成二维码、自动打开扫码页）
cd /d "%~dp0"
%PY% server.py
echo.
pause
