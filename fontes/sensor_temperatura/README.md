# fontes/sensor_temperatura/ — Sensor de temperatura (simulado, não controlável)

**Responsável:** Pessoa C
**fonte_id:** `sensor-temperatura` · **Tipo:** `SENSOR_TEMPERATURA` · **Sem gRPC**

## Por que existe
Peixes e plantas tropicais vivem entre ~24 e 28 °C. Este sensor detecta falha do aquecedor ou superaquecimento. Também alimenta as consultas de média e desvio padrão.

## Modelo de simulação

```
temperatura = base + amplitude * sin(2π * t / periodo) + ruido(±0,1)
```

| Argumento | Padrão | Observação |
|---|---|---|
| `--base` | 26.0 | °C |
| `--amplitude` | 0.8 | variação "dia/noite" |
| `--periodo-s` | 600 | acelerado (10 min) para aparecer no gráfico do vídeo |
| `--limiar` | 30.0 | acima disso → evento `temperatura_alta` |
| `--cenario` | `normal` | `superaquecimento` sobe a base 0,1 °C por amostra (1 s) até 32 °C. Passa do limiar em ~40 s (para a demo) |
| `--intervalo` | 10 | s |

## Leituras UDP

- Periódica: `temperatura` (unidade `C`).
- **Evento imediato** `temperatura_alta` ao cruzar o limiar, no máximo 1 a cada 60 s enquanto continuar acima.

## Pronto quando

- [ ] Leituras chegando no Gateway a cada 10 s.
- [ ] A consulta `MEDIA_DESVIO sensor-temperatura temperatura 60` devolve média ≈ 26 °C.
- [ ] Com `--cenario superaquecimento`, o alerta aparece no Gateway.
