# fontes/luminaria/ — Luminária Smartled (controlável, real)

**Responsável:** Pessoa B
**fonte_id:** `luminaria-smartled` · **Tipo:** `LUMINARIA` · **gRPC:** `:50051`
**Hardware:** barras de LED com controlador Wi-Fi Magic Home **"Controller Dimmable (0x41)"**, MAC `B4:E8:42:B6:A0:5C`.
Controle local por TCP 5577, **sem chave**. O brilho fica no canal "warm white".

## Backends

| `--backend` | Comportamento |
|---|---|
| `sim` | Guarda `ligada` e `intensidade` em memória |
| `magichome` | Usa `flux_led`: `WifiLedBulb(ip)` |

Chamadas `flux_led` já validadas no hardware:
```python
from flux_led import WifiLedBulb
b = WifiLedBulb("192.168.0.71")
b.turnOn(); b.turnOff()
b.setWarmWhite(60)             # 0–100 % (equivalente a `flux_led IP -w 60`, testado)
b.update_state(); b.is_on; b.brightness   # brightness vem em 0–255 → converter para %
```
O IP vem de `config.json` (`luminaria.ip`) ou de `--ip`. Recomenda-se reservar o IP no DHCP do roteador.

## Comandos gRPC

| RPC | Efeito |
|---|---|
| `GetStatus` | Lê o estado real (no backend real, `update_state()`) |
| `SetPower(ligada)` | Liga/desliga |
| `SetParametro("intensidade", 0–100)` | Muda o brilho. Se `rampa_s > 0`, faz a transição em passos de 1 s (thread), simulando amanhecer/entardecer |
| `SetParametro("rampa_s", N)` | Define a duração das próximas transições (0 = imediata) |
| `SetParametro("intervalo_envio_s", N)` | Muda o período de envio |
| `SimularFalha(ativa)` | Para ou retoma o envio de leituras |

Valores fora da faixa → `context.abort(grpc.StatusCode.INVALID_ARGUMENT, ...)`.

## Leituras UDP

- Periódica: `ligada` (1/0) e `intensidade` (%).
- **Evento imediato** (`motivo_evento="mudou_estado"`): quando o estado real muda por fora do sistema, por exemplo pelo app Magic Home. Detectar comparando a leitura atual com a anterior.

## Argumentos

```
python -m fontes.luminaria --ip-local 192.168.0.33 --backend magichome [--config fontes/config.json] [--porta-grpc 50051]
```

## Pronto quando

- [ ] Responde à descoberta com o estado inicial lido do equipamento.
- [ ] O comando `intensidade=30` pelo cliente CLI muda o brilho real da luminária.
- [ ] A rampa de 0→80 % em 30 s é visível (boa cena para o vídeo).
- [ ] Mudar o brilho pelo app gera um evento imediato no Gateway.
- [ ] Se o equipamento estiver inacessível, o processo não cai: loga o erro e reporta `detalhe="sem comunicação"`.
