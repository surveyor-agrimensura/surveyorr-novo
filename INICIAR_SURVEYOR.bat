@echo off
cd /d "%~dp0"
where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instale Node.js 22 ou superior.
  pause
  exit /b 1
)
if not exist "node_modules\leaflet\package.json" goto install
if not exist "node_modules\shpjs\package.json" goto install
if not exist "node_modules\read-excel-file\package.json" goto install
goto start
:install
echo Instalando e atualizando dependencias do SURVEYOR...
call npm install
if errorlevel 1 (pause & exit /b 1)
:start
echo Abrir no navegador: http://localhost:5500/login/
call npm run dev
pause
