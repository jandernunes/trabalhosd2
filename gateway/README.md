# gateway/ — Gateway central

**Responsável:** Pessoa A (núcleo). A parte de consultas e SQLite é da Pessoa C.
**Linguagem:** Java 17+ com Maven (recomendado). Se o grupo escolher Go, a estrutura é a mesma.
**Contrato:** [`../proto/aquario.proto`](../proto/aquario.proto). Portas em [`../proto/README.md`](../proto/README.md).

## Responsabilidades

1. **Descoberta (multicast):** envia `DiscoveryRequest` para `239.10.10.10:50000` ao iniciar e **a cada 30 s**. O reenvio periódico cobre fontes que sobem depois do Gateway e também serve de "batimento" para o failsafe do CO2.
2. **Registro de fontes:** escuta `DiscoveryResponse` em UDP `50001` e guarda em memória `fonte_id → InfoFonte` (ip, porta gRPC, tipo, estado, visto_em).
3. **Recepção de dados:** escuta `Leitura` em UDP `50002`. Para cada leitura: atualiza `ultima_leitura` e `visto_em`, grava no SQLite e, se `evento=true`, imprime um **ALERTA** no console.
4. **Detecção de fonte offline:** a cada 5 s, marca `online=false` se `agora - visto_em > 3 × intervalo_envio_s`. Volta a `online=true` sozinho quando chega uma leitura ou resposta de descoberta.
5. **Comandos (cliente gRPC):** mantém um `ManagedChannel` por fonte controlável e traduz o `Comando` vindo do cliente para `SetPower`, `SetParametro` ou `SimularFalha`. Use timeout de 3 s (deadline). Se a chamada falhar, devolva `Resposta{ok=false, erro=...}`.
6. **Servidor TCP (porta 50010):** uma thread por cliente, com enquadramento de 4 bytes. Atende `ListarFontes`, `Comando`, `Consulta` e `PedidoHistorico`.
7. **Regra de segurança automática:** quando chegar uma leitura de `sensor-ph` com `evento=true` e `motivo_evento="ph_baixo"`, chama `SetPower(false)` na `tomada-co2` e registra no log. É a cena principal do vídeo.
8. **Persistência (extra):** SQLite em `gateway/dados/aquario.db` (ignorado pelo git).

## Consultas (Pessoa C)

Tabela única:
```sql
CREATE TABLE IF NOT EXISTS leitura (
  fonte_id TEXT, tipo INTEGER, ts_ms INTEGER, medida TEXT, valor REAL, unidade TEXT, evento INTEGER, motivo TEXT
);
CREATE INDEX IF NOT EXISTS ix_leitura ON leitura(fonte_id, medida, ts_ms);
```
Cada `Medida` da `Leitura` vira uma linha.

| TipoConsulta | Cálculo |
|---|---|
| `MEDIA_DESVIO` | `AVG`, desvio padrão (calcular no código ou `AVG(x*x)-AVG(x)^2`), `MIN`, `MAX`, `COUNT` de `fonte_id`/`medida` na janela |
| `CONSUMO_WH` | Para cada tomada, integra `potencia` no tempo (trapézio entre leituras consecutivas, Δt em horas). Ignore intervalos maiores que 3 × intervalo (fonte estava offline) |
| `TEMPO_LIGADO` | Para cada controlável, soma os Δt entre leituras consecutivas em que `ligada=1` (mesmo limite de Δt). Resultado em horas |
| `PH_MIN_ALERTAS` | `MIN(valor)` de `sensor-ph`/`ph` + `COUNT` de linhas com `evento=1` do `sensor-ph` na janela |
| `MAIOR_VARIACAO` | Para cada par (fonte, medida numérica, excluindo `ligada`), calcula o coeficiente de variação (desvio/média) e devolve o maior |
| `PedidoHistorico` | `SELECT ts_ms, valor ... ORDER BY ts_ms`; se `max_pontos > 0`, faz amostragem uniforme |

`janela_min = 0` significa 60 minutos.

## Estrutura sugerida (Java)

```
gateway/
  pom.xml                       # grpc-netty-shaded, grpc-protobuf, grpc-stub, protobuf-java, sqlite-jdbc
  src/main/java/br/ufc/sd/aquario/gateway/
    Main.java                   # lê args, sobe as threads
    Descoberta.java             # envia DiscoveryRequest e recebe DiscoveryResponse
    ReceptorDados.java          # UDP 50002
    RegistroFontes.java         # ConcurrentHashMap<String, InfoFonte> + verificação de offline
    ControleFontes.java         # canais e stubs gRPC
    ServidorClientes.java       # TCP 50010
    Repositorio.java            # SQLite + consultas
```
Gere o código do proto com o `protobuf-maven-plugin` (`org.xolstice.maven.plugins`) apontando `protoSourceRoot` para `${project.basedir}/../proto`.

## Argumentos de linha de comando

```
java -jar gateway.jar --ip-local 192.168.0.33 [--db dados/aquario.db]
```
`--ip-local` é **obrigatório**: define a interface do multicast (`MulticastSocket.setNetworkInterface(NetworkInterface.getByInetAddress(...))`) e o `gateway_ip` anunciado. Sem isso, em PCs com VPN, WSL ou Hyper-V, o multicast sai pela interface errada (já aconteceu nos testes).

## Saída esperada no console

```
[DESCOBERTA] enviada para 239.10.10.10:50000
[FONTE] tomada-co2 (TOMADA_CO2) 192.168.0.33:50052 ONLINE
[DADOS] sensor-ph ph=6.92
[ALERTA] sensor-ph ph_baixo ph=6.38 -> desligando tomada-co2
[FONTE] tomada-luminaria OFFLINE (sem leituras há 45 s)
```

## Pronto quando

- [ ] Lista as 5 fontes depois de subir (simuladas ou reais), inclusive as que sobem depois do Gateway.
- [ ] Marca OFFLINE em até 3 intervalos depois de matar uma fonte e volta a ONLINE quando ela retorna.
- [ ] Executa comandos vindos do cliente e devolve o `Status` atualizado.
- [ ] As 5 consultas e o histórico funcionam pelo cliente CLI.
- [ ] O alerta de pH baixo desliga o CO2 automaticamente.
- [ ] Testes unitários das consultas com dados fixos (ex.: 2 leituras de 10 W com 1 h de diferença → 10 Wh).
