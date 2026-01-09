@echo off
REM DALP (Dual-Agent Loop Protocol) 服务启动脚本
REM 适用于 Windows

setlocal

set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%..

REM 检查 Node.js 是否已安装
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 错误: 未找到 Node.js，请先安装 Node.js 18+
    exit /b 1
)

REM 检查 dist 目录是否存在
if not exist "%PROJECT_DIR%\dist\index.js" (
    echo 错误: 未找到 dist\index.js，请先运行 'npm run package'
    exit /b 1
)

cd /d "%PROJECT_DIR%"

echo 启动 DALP 服务...
echo Dashboard: http://localhost:3000
echo SSE Endpoint: http://localhost:3000/sse
echo.

node dist\index.js
