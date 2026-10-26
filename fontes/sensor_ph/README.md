# fontes/sensor_ph/ — Sensor de pH (simulado, não controlável)

**Responsável:** Pessoa C
**fonte_id:** `sensor-ph` · **Tipo:** `SENSOR_PH` · **Sem gRPC** (`porta_grpc=0`, `controlavel=false`)

## Por que existe
O CO2 dissolvido acidifica a água, então o pH é o "termômetro do CO2". Se o pH cai demais, os peixes estão em risco. Este sensor é o que dispara o **alerta imediato** exigido pela especificação (requisito 5c).

## Modelo de simulação

O pH segue um alvo com resposta de primeira ordem, mais ruído:
```
alvo = ph_com_co2 se CO2 ligado, senão ph_sem_co2
ph  += (alvo - ph) * (dt / tau) + ruido(±0,02)
```

| Parâmetro (argumento) | Padrão | Observação |
|---|---|---|
| `--ph-sem-co2` | 7.2 | pH de equilíbrio sem CO2 |
| `--ph-com-co2` | 6.6 | operação normal. **Para a demo do alerta use 6.2** ("excesso de CO2") |
| `--tau-s` | 60 | tempo de resposta. Na vida real são horas; 60 s acelera para o vídeo |
| `--limiar` | 6.4 | abaixo disso → evento `ph_baixo` |
| `--intervalo` | 10 | período de envio (s) |
| `--co2-grpc` | `127.0.0.1:50052` | de onde ler o estado do CO2 |

**Como o simulador sabe se o CO2 está ligado:** ele chama `GetStatus` (só leitura) no gRPC da `tomada-co2`. Se não conseguir, assume CO2 desligado. É uma simplificação da simulação: na vida real o pH reage fisicamente ao CO2, sem comunicação nenhuma. Deixe isso claro nos slides.

## Leituras UDP

- Periódica: `ph` (unidade `pH`).
- **Evento imediato** `ph_baixo` quando cruza o limiar para baixo. Repete o evento **no máximo a cada 60 s** enquanto continuar abaixo, para não inundar o Gateway. Volta ao normal com histerese de +0,1.

Quando o Gateway recebe `ph_baixo`, ele desliga a `tomada-co2` sozinho, e o pH volta a subir. Esse é o ciclo completo da demo.

## Pronto quando

- [ ] Com o CO2 ligado (backend sim) e `--ph-com-co2 6.2`, o alerta aparece em ~1–2 min.
- [ ] O Gateway desliga o CO2 e o pH sobe de novo.
- [ ] Teste unitário do modelo: a partir de 7,2 com alvo 6,2, depois de 3·tau o valor está perto de 6,25.
