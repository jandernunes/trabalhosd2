$pids = "$PSScriptRoot\.pids"
if (-not (Test-Path $pids)) { Write-Host "Nada para encerrar (scripts\.pids não existe)."; exit 0 }
foreach ($id in Get-Content $pids) {
    taskkill /PID $id /T /F 2>$null | Out-Null
}
Remove-Item $pids
Write-Host "Processos encerrados."
