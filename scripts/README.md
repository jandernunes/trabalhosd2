# scripts/ — Geração de código e execução do sistema

**Responsável:** quem fizer a integração (Pessoa A, com apoio de todos).
**Objetivo:** subir o sistema inteiro com **um comando**, igual no ensaio e na gravação do vídeo.

## Scripts

| Script | O que faz |
|---|---|
| `gerar_proto.ps1` / `gerar_proto.sh` | Gera o código Python em `gen/python` (`grpc_tools.protoc`). O Java gera sozinho no `mvn package` |
| `subir_tudo.ps1` | Abre **uma janela de terminal por processo**, com título, na ordem abaixo. Gera o proto e compila o gateway se faltar |
| `parar_tudo.ps1` | Encerra todos os processos abertos pelo `subir_tudo.ps1` (PIDs em `scripts/.pids`) |

```powershell
./scripts/subir_tudo.ps1 -IpLocal 192.168.0.33 -Backend sim
./scripts/subir_tudo.ps1 -IpLocal 192.168.0.33 -Backend real -PhComCo2 6.2 -TauS 30   # demo do alerta de pH
./scripts/subir_tudo.ps1 -IpLocal 192.168.0.33 -Cenario superaquecimento -SemDashboard
./scripts/parar_tudo.ps1
```
`-Backend real` usa `tuya` nas tomadas e `magichome` na luminária, e exige o `fontes/config.json`. Os sensores são sempre simulados. Os scripts usam o Python do `.venv` se ele existir.

## Ordem de subida

1. `gateway` (já começa a enviar a descoberta)
2. `tomada-co2`, `tomada-luminaria`, `luminaria-smartled`
3. `sensor-ph` (depois do CO2, porque consulta o gRPC dele), `sensor-temperatura`
4. `cliente_cli` e, se houver, `dashboard` (`npm start` em `dashboard/`, http://localhost:3000)

A ordem não é obrigatória: o Gateway reenvia a descoberta a cada 30 s, então quem subir depois aparece sozinho. Mas seguir a ordem deixa o vídeo mais claro.

## Antes de rodar (checklist de ambiente)

- [ ] **VPN desligada.** Com VPN, o multicast sai pela interface errada.
- [ ] `ipconfig`: descobrir o IP da rede local (ex.: `192.168.0.33`) e passar em `-IpLocal`.
- [ ] Firewall do Windows: permitir **Python** e **Java** em rede **privada** (o aviso aparece na primeira execução).
- [ ] `fontes/config.json` preenchido (apenas para `-Backend real`).
