@echo off
setlocal
cd /d "%~dp0"

echo ======================================================
echo SURVEYOR - FUNCTION DEDICADA DE SALVAMENTO
echo ======================================================

git branch --show-current | findstr /x /c:"main" >nul
if errorlevel 1 (
  echo ERRO: execute este arquivo na branch main.
  pause
  exit /b 1
)

call npm test
if errorlevel 1 (
  echo ERRO: os testes falharam. Nenhum push sera feito.
  pause
  exit /b 1
)

git status
git add -A
git commit -m "feat: adiciona Function dedicada surveyor-save para Cloud Save"
if errorlevel 1 (
  echo Nenhuma alteracao nova para commit ou o commit falhou.
)

git fetch origin
if errorlevel 1 (
  echo ERRO no git fetch.
  pause
  exit /b 1
)

git push origin main
if errorlevel 1 (
  echo ERRO no git push. Nao use force-push.
  pause
  exit /b 1
)

echo.
echo Publicacao enviada para origin/main.
pause
