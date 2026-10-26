# Gera o código Python do proto em gen/python (o Java gera sozinho no `mvn package`; o dashboard lê o .proto direto).
$raiz = Split-Path -Parent $PSScriptRoot
$python = if (Test-Path "$raiz\.venv\Scripts\python.exe") { "$raiz\.venv\Scripts\python.exe" } else { "python" }
New-Item -ItemType Directory -Force "$raiz\gen\python" | Out-Null
& $python -m grpc_tools.protoc -I "$raiz\proto" --python_out="$raiz\gen\python" --grpc_python_out="$raiz\gen\python" "$raiz\proto\aquario.proto"
if ($LASTEXITCODE -eq 0) { Write-Host "Código gerado em gen\python" } else { exit $LASTEXITCODE }
