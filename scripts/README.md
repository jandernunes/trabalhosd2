# scripts/ — Geração de código e execução do sistema

**Responsável:** quem fizer a integração (Pessoa A, com apoio de todos).
**Objetivo:** subir o sistema inteiro com **um comando**, igual no ensaio e na gravação do vídeo.

## Scripts a criar

| Script | O que faz |
|---|---|
| `gerar_proto.ps1` / `gerar_proto.sh` | Gera o código Python em `gen/python` (`grpc_tools.protoc`). O Java gera sozinho no `mvn package` |
| `subir_tudo.ps1` | Abre **uma janela de terminal por processo**, com título, na ordem abaixo. Parâmetros: `-IpLocal`, `-Backend sim\|real` |
| `parar_tudo.ps1` | Encerra todos os processos do sistema |

Exemplo de uma linha do `subir_tudo.ps1`:
```powershell
Start-Process powershell -ArgumentList "-NoExit","-Command","`$host.UI.RawUI.WindowTitle='tomada-co2'; `$env:PYTHONPATH='gen/python'; python -m fontes.tomada --ip-local $IpLocal --id tomada-co2 --tipo TOMADA_CO2 --porta-grpc 50052 --backend $BackendTomada --failsafe"
```

## Ordem de subida

1. `gateway` (já começa a enviar a descoberta)
2. `tomada-co2`, `tomada-luminaria`, `luminaria-smartled`
3. `sensor-ph` (depois do CO2, porque consulta o gRPC dele), `sensor-temperatura`
4. `cliente_cli` e, se houver, `dashboard`

A ordem não é obrigatória: o Gateway reenvia a descoberta a cada 30 s, então quem subir depois aparece sozinho. Mas seguir a ordem deixa o vídeo mais claro.

## Antes de rodar (checklist de ambiente)

- [ ] **VPN desligada.** Com VPN, o multicast sai pela interface errada.
- [ ] `ipconfig`: descobrir o IP da rede local (ex.: `192.168.0.33`) e passar em `-IpLocal`.
- [ ] Firewall do Windows: permitir **Python** e **Java** em rede **privada** (o aviso aparece na primeira execução).
- [ ] `fontes/config.json` preenchido (apenas para `-Backend real`).
