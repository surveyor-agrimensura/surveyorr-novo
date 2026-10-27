@echo off
setlocal
cd /d "%~dp0deploy\cloudflare-geoservices"
if errorlevel 1 goto :fail

echo ==========================================
echo SURVEYOR - DEPLOY GEOSERVICES CLOUDFLARE
ECHO ==========================================

echo [1/6] Instalando dependencias...
call npm install
if errorlevel 1 goto :fail

echo [2/6] Validando Worker...
call npm run check
if errorlevel 1 goto :fail

echo [3/6] Rodando testes da proxy...
call npm test
if errorlevel 1 goto :fail

echo [4/6] Conferindo login Cloudflare...
call npx wrangler whoami
if errorlevel 1 (
  echo Login necessario. Abrindo autenticacao...
  call npx wrangler login
  if errorlevel 1 goto :fail
)

echo [5/6] Publicando Worker...
call npm run deploy
if errorlevel 1 goto :fail

echo [6/6] Validando rota publica /health...
powershell -NoProfile -Command "$r=Invoke-RestMethod -Uri 'https://tiny-king-d719georural-geoservices.kaualucasfrancasantos.workers.dev/health' -TimeoutSec 30; if(-not $r.ok){exit 1}; Write-Host ('GeoServices OK - versao ' + $r.version)"
if errorlevel 1 goto :fail

echo.
echo DEPLOY CONCLUIDO COM SUCESSO.
pause
exit /b 0

:fail
echo.
echo FALHA NO DEPLOY. Veja a mensagem acima.
pause
exit /b 1
