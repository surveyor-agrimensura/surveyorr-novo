@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo SURVEYOR SAVE FUNCTION 1.1.0 - COMMIT/PUSH
 echo ================================================
git status
if errorlevel 1 goto :erro
git add -A
git commit -m "fix: elimina preflight da Function de salvamento 1.1.0"
if errorlevel 1 echo Nenhuma alteracao para commit ou commit nao criado.
git push origin main
if errorlevel 1 goto :erro
echo.
echo Publicacao enviada para main.
pause
exit /b 0
:erro
echo.
echo Falha. Verifique a mensagem acima.
pause
exit /b 1
