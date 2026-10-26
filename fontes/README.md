# fontes/ — Fontes de dados (Python)

**Responsáveis:** Pessoa B (adaptadores reais: `luminaria/`, `tomada/`) e Pessoa C (simulados: `sensor_ph/`, `sensor_temperatura/`).
**Linguagem:** Python 3.10+. As bibliotecas dos equipamentos reais (`tinytuya`, `flux_led`) são Python.

Cada fonte é **um processo separado**, como pede a especificação.

| Pasta | fonte_id | Tipo | Controlável | Backend real |
|---|---|---|---|---|
| [`luminaria/`](luminaria/README.md) | `luminaria-smartled` | LUMINARIA | ✅ gRPC :50051 | Magic Home (`flux_led`) |
| [`tomada/`](tomada/README.md) | `tomada-co2` | TOMADA_CO2 | ✅ gRPC :50052 | Tuya (`tinytuya`) |
| [`tomada/`](tomada/README.md) | `tomada-luminaria` | TOMADA_LUMINARIA | ✅ gRPC :50053 | Tuya (`tinytuya`) |
| [`sensor_ph/`](sensor_ph/README.md) | `sensor-ph` | SENSOR_PH | ❌ | — (simulado) |
| [`sensor_temperatura/`](sensor_temperatura/README.md) | `sensor-temperatura` | SENSOR_TEMPERATURA | ❌ | — (simulado) |
| [`comum/`](comum/README.md) | — | código compartilhado | — | — |

## Esqueleto comum (todas as fontes)

1. **Descoberta:** entra no grupo `239.10.10.10:50000`. Ao receber um `DiscoveryRequest`, guarda `gateway_ip` e `porta_dados` e responde com um `DiscoveryResponse` (unicast) para `gateway_ip:porta_resposta`.
2. **Envio de dados:** só começa depois de conhecer o Gateway. Envia uma `Leitura` a cada `intervalo_envio_s` (padrão **10 s**) e **imediatamente** quando há evento (`evento=true` e `motivo_evento`).
3. **gRPC (só as controláveis):** servidor `FonteControlavel` na porta da tabela. Os comandos mudam o estado e a resposta é sempre o `Status` atual.
4. **Falha simulada:** `SimularFalha(ativa=true)` para o envio de leituras (o Gateway marca OFFLINE) e faz `Status.em_falha=true`. `ativa=false` retoma.
5. **Backend trocável:** `--backend sim` funciona sem hardware. **Todo o desenvolvimento e os testes de integração usam `sim`**, e o hardware real só entra no fim.

## Como rodar (da raiz do repositório)

```bash
python -m pip install -r requirements.txt
python -m grpc_tools.protoc -I proto --python_out=gen/python --grpc_python_out=gen/python proto/aquario.proto
```

Depois, com `PYTHONPATH=gen/python` (PowerShell: `$env:PYTHONPATH="gen/python"`):

```bash
python -m fontes.luminaria --ip-local 192.168.0.33 --backend sim
python -m fontes.tomada --ip-local 192.168.0.33 --id tomada-co2 --tipo TOMADA_CO2 --porta-grpc 50052 --backend sim --failsafe
python -m fontes.tomada --ip-local 192.168.0.33 --id tomada-luminaria --tipo TOMADA_LUMINARIA --porta-grpc 50053 --backend sim
python -m fontes.sensor_ph --ip-local 192.168.0.33
python -m fontes.sensor_temperatura --ip-local 192.168.0.33
```

Cada pasta vira um pacote Python com `__init__.py` e `__main__.py`.

## Configuração do hardware real

Copie [`config.exemplo.json`](config.exemplo.json) para `config.json` e preencha com IP, device id e local key. O **`config.json` está no `.gitignore`**: as chaves das tomadas nunca vão para o GitHub.

## Segurança (aquário real)

- A **tomada do CO2** roda com `--failsafe`: se ficar **90 s sem receber `DiscoveryRequest`** (o Gateway envia a cada 30 s), ela desliga o CO2 sozinha.
- Testes com o backend real no CO2 devem ser **curtos e supervisionados**.
- Os horários (timers) das tomadas **continuam no app Smart Life**. O sistema monitora, detecta mudanças de estado e permite comando manual, mas não substitui os timers.
