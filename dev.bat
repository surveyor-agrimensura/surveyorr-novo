@echo off
setlocal
cd /d "%~dp0"
title Surveyor - Servidor local
where node >nul 2>nul || (echo [ERRO] Node.js 22+ nao encontrado.& pause & exit /b 1)
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5500/login/"
npm run dev
if errorlevel 1 pause
