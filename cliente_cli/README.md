# cliente_cli/ — Cliente de linha de comando

**Responsável:** Pessoa C
**Linguagem:** Python 3.10+ (módulo `cmd` da biblioteca padrão para o prompt interativo).
**Conexão:** TCP com o Gateway na porta `50010`, mensagens `Requisicao`/`Resposta` com **prefixo de 4 bytes** (ver [`../proto/README.md`](../proto/README.md)).

## Comandos

| Comando | Requisição | Exemplo |
|---|---|---|
| `fontes` | `ListarFontes` | tabela: id, tipo, online, ligada, última leitura, visto há N s |
| `ligar <id>` / `desligar <id>` | `Comando{power}` | `ligar tomada-co2` |
| `param <id> <nome> <valor>` | `Comando{parametro}` | `param luminaria-smartled intensidade 40` |
| `falha <id> on\|off` | `Comando{falha}` | `falha tomada-luminaria on` |
| `media <id> <medida> [min]` | `Consulta MEDIA_DESVIO` | `media sensor-temperatura temperatura 60` |
| `consumo [min]` | `Consulta CONSUMO_WH` | `consumo 1440` |
| `tempo-ligado [min]` | `Consulta TEMPO_LIGADO` | `tempo-ligado 1440` |
| `ph [min]` | `Consulta PH_MIN_ALERTAS` | `ph 60` |
| `variacao [min]` | `Consulta MAIOR_VARIACAO` | `variacao 60` |
| `historico <id> <medida> [min]` | `PedidoHistorico` | `historico sensor-ph ph 30` |
| `ajuda`, `sair` | — | — |

## Requisitos de implementação

- Uma conexão TCP persistente. Se cair, tenta reconectar no próximo comando e avisa: `Gateway indisponível`.
- Função única `enviar(req) -> Resposta` com o enquadramento. Leitura com laço até completar os bytes (`recv` pode devolver menos do que o pedido).
- Se `Resposta.ok == false`, mostra `Erro: <erro>` e continua.
- Saída em **tabelas alinhadas**, legíveis no vídeo (fonte grande no terminal).

## Execução

```bash
python -m cliente_cli --gateway 192.168.0.33:50010
```
(com `PYTHONPATH=gen/python`)

## Pronto quando

- [ ] Todos os comandos da tabela funcionam contra o Gateway com as fontes simuladas.
- [ ] Um comando para uma fonte offline mostra um erro claro, sem travar o cliente.
- [ ] Matar e reiniciar o Gateway: o cliente reconecta sozinho no próximo comando.
