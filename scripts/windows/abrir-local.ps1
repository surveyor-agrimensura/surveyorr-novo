$ErrorActionPreference = "Stop"
$Raiz = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Raiz

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js não foi encontrado. Instale o Node.js 22 ou superior."
}

$Porta = 5500
$Url = "http://localhost:$Porta/login/"
$EmUso = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue

if (-not $EmUso) {
  Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-Command', "Set-Location '$Raiz'; `$env:SURVEYOR_LOCAL_PORT='$Porta'; npm run dev"
  )
  Start-Sleep -Seconds 2
}

Start-Process $Url
Write-Host "Surveyor aberto em $Url"
