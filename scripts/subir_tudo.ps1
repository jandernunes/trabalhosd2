<#
.SYNOPSIS
  Sobe o sistema inteiro: uma janela de terminal por processo, com título.
.EXAMPLE
  ./scripts/subir_tudo.ps1 -IpLocal 192.168.0.33 -Backend sim
  ./scripts/subir_tudo.ps1 -IpLocal 192.168.0.33 -Backend real -PhComCo2 6.2 -TauS 30
#>
param(
    [Parameter(Mandatory = $true)][string]$IpLocal,
    [ValidateSet("sim", "real")][string]$Backend = "sim",
    [double]$PhComCo2 = 6.6,                 # 6.2 para demonstrar o alerta de pH
    [double]$TauS = 60,
    [ValidateSet("normal", "superaquecimento")][string]$Cenario = "normal",
    [switch]$SemDashboard,
    [switch]$SemCli
)

$raiz = Split-Path -Parent $PSScriptRoot
$python = if (Test-Path "$raiz\.venv\Scripts\python.exe") { "$raiz\.venv\Scripts\python.exe" } else { "python" }
$jar = "$raiz\gateway\target\gateway.jar"
$pids = "$PSScriptRoot\.pids"

if (-not (Test-Path "$raiz\gen\python\aquario_pb2.py")) { & "$PSScriptRoot\gerar_proto.ps1" }
if (-not (Test-Path $jar)) { Write-Host "Compilando o gateway..."; Push-Location "$raiz\gateway"; mvn -q -B package -DskipTests; Pop-Location }
if (-not (Get-NetIPAddress -IPAddress $IpLocal -ErrorAction SilentlyContinue)) {
    Write-Warning "$IpLocal não é um IP desta máquina. Confira com ipconfig."
}

$tomada = if ($Backend -eq "real") { "tuya" } else { "sim" }
$luz = if ($Backend -eq "real") { "magichome" } else { "sim" }

function Abrir([string]$titulo, [string]$comando, [string]$pasta = $raiz) {
    $script = "`$host.UI.RawUI.WindowTitle='$titulo'; Set-Location '$pasta'; $comando"
    $p = Start-Process powershell -ArgumentList "-NoExit", "-Command", $script -PassThru
    Add-Content $pids $p.Id
    Start-Sleep -Milliseconds 700
}

Remove-Item $pids -ErrorAction SilentlyContinue
Abrir "gateway" "java -jar '$jar' --ip-local $IpLocal" "$raiz\gateway"
Start-Sleep -Seconds 2
Abrir "tomada-co2" "& '$python' -m fontes.tomada --ip-local $IpLocal --id tomada-co2 --tipo TOMADA_CO2 --porta-grpc 50052 --backend $tomada --failsafe"
Abrir "tomada-luminaria" "& '$python' -m fontes.tomada --ip-local $IpLocal --id tomada-luminaria --tipo TOMADA_LUMINARIA --porta-grpc 50053 --backend $tomada"
Abrir "luminaria-smartled" "& '$python' -m fontes.luminaria --ip-local $IpLocal --backend $luz"
Abrir "sensor-ph" "& '$python' -m fontes.sensor_ph --ip-local $IpLocal --ph-com-co2 $PhComCo2 --tau-s $TauS"
Abrir "sensor-temperatura" "& '$python' -m fontes.sensor_temperatura --ip-local $IpLocal --cenario $Cenario"
if (-not $SemDashboard) {
    if (-not (Test-Path "$raiz\dashboard\node_modules")) { Push-Location "$raiz\dashboard"; npm install; Pop-Location }
    Abrir "dashboard" "`$env:GATEWAY_ADDR='${IpLocal}:50010'; npm run dev" "$raiz\dashboard"
}
if (-not $SemCli) {
    Abrir "cliente" "& '$python' -m cliente_cli --gateway ${IpLocal}:50010"
}
Write-Host "Sistema no ar (backend $Backend). Dashboard: http://localhost:3000  |  Para encerrar: ./scripts/parar_tudo.ps1"
