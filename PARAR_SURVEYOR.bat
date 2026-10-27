@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-NetTCPConnection -LocalPort 5500 -State Listen -ErrorAction SilentlyContinue; foreach($x in $c){ try{$p=Get-Process -Id $x.OwningProcess -ErrorAction Stop; if($p.ProcessName -in @('node','cmd','powershell','pwsh')){Stop-Process -Id $p.Id -Force}}catch{}}"
echo [SURVEYOR] Solicitação de parada concluida.
endlocal
