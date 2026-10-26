#!/usr/bin/env sh
# Gera o código Python do proto em gen/python (o Java gera sozinho no `mvn package`; o dashboard lê o .proto direto).
set -e
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
PY="python3"
[ -x "$RAIZ/.venv/bin/python" ] && PY="$RAIZ/.venv/bin/python"
[ -x "$RAIZ/.venv/Scripts/python.exe" ] && PY="$RAIZ/.venv/Scripts/python.exe"
mkdir -p "$RAIZ/gen/python"
"$PY" -m grpc_tools.protoc -I "$RAIZ/proto" --python_out="$RAIZ/gen/python" --grpc_python_out="$RAIZ/gen/python" "$RAIZ/proto/aquario.proto"
echo "Código gerado em gen/python"
