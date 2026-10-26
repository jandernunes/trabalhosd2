# fontes/tomada/ — Tomadas Gaya/Tuya (controláveis, reais)

**Responsável:** Pessoa B
O **mesmo código** atende as duas tomadas. Só os argumentos mudam:

| Instância | fonte_id | Tipo | gRPC | Uso no aquário |
|---|---|---|---|---|
| 1 | `tomada-co2` | `TOMADA_CO2` | `:50052` | Válvula solenoide do CO2 (**com `--failsafe`**) |
| 2 | `tomada-luminaria` | `TOMADA_LUMINARIA` | `:50053` | Luminária secundária |

**Hardware:** tomadas Wi-Fi Gaya 9812 (plataforma Tuya, protocolo **v3.3**), pareadas no app Smart Life. Elas **medem energia**.

## Mapeamento DPS (confirmado no `tinytuya wizard`)

| DPS | Significado | Conversão |
|---|---|---|
| `1` | ligada/desligada | bool |
| `9` | contagem regressiva (s) | não usar |
| `18` | corrente | mA |
| `19` | potência | ÷ 10 → W |
| `20` | tensão | ÷ 10 → V |
| `38` | comportamento ao voltar a energia | **no CO2 deixar "off"** (configurar pelo app) |

## Backends

| `--backend` | Comportamento |
|---|---|
| `sim` | Estado em memória. Potência simulada: ligada → ~8 W (CO2) ou ~20 W (luminária) com ruído; desligada → 0 W; tensão ~220 V |
| `tuya` | `tinytuya.OutletDevice(dev_id, ip, local_key, version=3.3)` |

```python
import tinytuya
d = tinytuya.OutletDevice(dev_id, ip, local_key, version=3.3)
d.set_socketPersistent(False)
d.turn_on(); d.turn_off()
dps = d.status()["dps"]        # {'1': True, '18': 37, '19': 82, '20': 2225, ...}
```
`config.json` → `tomadas.<fonte_id>` traz o `nome` (como no Smart Life) e o `ip`. O `dev_id` e a `local_key` são lidos do `devices.json` do wizard (`devices_json` no config). A `local_key` muda se a tomada for pareada de novo; nesse caso, rode `python -m tinytuya wizard` outra vez.

## Comandos gRPC

| RPC | Efeito |
|---|---|
| `GetStatus` | Lê o estado real |
| `SetPower(ligada)` | Liga/desliga a tomada |
| `SetParametro("intervalo_envio_s", N)` | Muda o período de envio |
| `SimularFalha(ativa)` | Para ou retoma o envio de leituras |

## Leituras UDP

- Periódica: `ligada`, `potencia` (W), `corrente` (mA), `tensao` (V).
- **Eventos imediatos:**
  - `mudou_estado`: o estado mudou por fora do sistema (timer do Smart Life ou botão físico).
  - `ligada_sem_consumo`: ligada com potência < 0,5 W por **10 s seguidos**. Indica lâmpada queimada ou solenoide com defeito. A espera evita um falso alarme logo depois de ligar, quando a tomada ainda não atualizou a potência.

## Failsafe do CO2 (`--failsafe`)

Uma thread verifica a cada 10 s: se `time.monotonic() - descoberta.ultimo_pedido_em > 90`, chama `turn_off()` e loga `FAILSAFE: gateway ausente, CO2 desligado`. Só age **se a tomada estiver ligada**, e só uma vez por ausência.

## Argumentos

```
python -m fontes.tomada --ip-local 192.168.0.33 --id tomada-co2 --tipo TOMADA_CO2 --porta-grpc 50052 --backend tuya --failsafe [--config fontes/config.json]
```

## Pronto quando

- [ ] As duas instâncias rodam no mesmo PC e aparecem no Gateway.
- [ ] Liga/desliga pelo CLI muda a tomada real (testar primeiro na **tomada-luminaria**).
- [ ] O Gateway recebe potência real (W) com a tomada ligada.
- [ ] Mudar o estado pelo app Smart Life gera evento imediato.
- [ ] Matar o Gateway com o CO2 ligado (backend `sim`): em ~90 s a fonte desliga sozinha.
