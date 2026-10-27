@echo off
setlocal
cd /d "%~dp0"
title Surveyor - Verificacao completa
where npm >nul 2>nul || (echo [ERRO] npm nao encontrado.& pause & exit /b 1)
call npm run verify
if errorlevel 1 (
  echo.
  echo [FALHA] A verificacao encontrou problemas.
  pause
  exit /b 1
)
echo.
echo [OK] Verificacao concluida.
pause
