@echo off
setlocal
cd /d "%~dp0"
title SURVEYOR - Servidor Local
set "SURVEYOR_LOCAL_HOST=127.0.0.1"
set "SURVEYOR_LOCAL_PORT=5500"

where node.exe >nul 2>&1
if errorlevel 1 (
  echo [SURVEYOR] ERRO: Node.js nao encontrado no PATH.
  echo [SURVEYOR] Instale/ative o Node.js e tente novamente.
  exit /b 1
)

echo [SURVEYOR] Iniciando servidor local em http://localhost:5500/
echo [SURVEYOR] O navegador nao sera aberto automaticamente.
node scripts\dev.mjs
endlocal
