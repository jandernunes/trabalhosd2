# proto/ — Contrato entre todos os processos

**Responsável:** equipe toda (alterações combinadas no grupo).
**Arquivo:** [`aquario.proto`](aquario.proto). Ele é a única fonte de verdade para mensagens e serviços.

## Regras

1. **Nada é trocado fora do Protobuf**: UDP, gRPC e TCP usam só as mensagens deste arquivo.
2. **Nunca reutilize nem renumere campos.** Para mudar algo, crie um campo novo e avise o grupo.
3. Cada linguagem gera o próprio código a partir deste arquivo. O código gerado **não** vai para o git (`gen/`, `target/`).
   - Python (fontes, CLI, dashboard):
     ```bash
     python -m grpc_tools.protoc -I proto --python_out=gen/python --grpc_python_out=gen/python proto/aquario.proto
     ```
   - Java (gateway): o `protobuf-maven-plugin` lê `../proto/aquario.proto` no build (ver `gateway/README.md`).

## Endereços e portas (fixos)

| Uso | Protocolo | Endereço / porta | Quem escuta |
|---|---|---|---|
| Descoberta (pedido) | UDP multicast | `239.10.10.10:50000`, TTL 1 | Fontes |
| Descoberta (resposta) | UDP unicast | `gateway_ip:50001` | Gateway |
| Leituras | UDP unicast | `gateway_ip:50002` | Gateway |
| Cliente ↔ Gateway | TCP | `gateway_ip:50010` | Gateway |
| gRPC luminária Smartled | gRPC (HTTP/2) | `:50051` | Fonte `luminaria-smartled` |
| gRPC tomada CO2 | gRPC | `:50052` | Fonte `tomada-co2` |
| gRPC tomada luminária | gRPC | `:50053` | Fonte `tomada-luminaria` |
| Dashboard (extra) | HTTP | `:8080` | Backend do dashboard |

## Identificadores das fontes (`fonte_id`)

| fonte_id | TipoFonte | Controlável |
|---|---|---|
| `luminaria-smartled` | `LUMINARIA` | sim |
| `tomada-co2` | `TOMADA_CO2` | sim |
| `tomada-luminaria` | `TOMADA_LUMINARIA` | sim |
| `sensor-ph` | `SENSOR_PH` | não |
| `sensor-temperatura` | `SENSOR_TEMPERATURA` | não |

## Nomes de medidas (`Medida.nome`)

| nome | unidade | Enviado por |
|---|---|---|
| `ligada` | `""` (1.0/0.0) | todas as controláveis |
| `intensidade` | `%` | luminária |
| `potencia` | `W` | tomadas (DPS 19 ÷ 10) |
| `corrente` | `mA` | tomadas (DPS 18) |
| `tensao` | `V` | tomadas (DPS 20 ÷ 10) |
| `ph` | `pH` | sensor de pH |
| `temperatura` | `C` | sensor de temperatura |

## Fluxos

```
DESCOBERTA   Gateway --DiscoveryRequest--> 239.10.10.10:50000   (ao iniciar e a cada 30 s)
             Fonte   --DiscoveryResponse--> gateway_ip:50001     (unicast)
DADOS        Fonte   --Leitura--> gateway_ip:50002               (a cada intervalo_envio_s, ou já, se evento=true)
COMANDOS     Gateway --gRPC FonteControlavel--> ip_fonte:porta_grpc
CLIENTE      Cliente --[4 bytes tamanho][Requisicao]--> TCP 50010
             Gateway --[4 bytes tamanho][Resposta]-->
```

## Enquadramento TCP (Cliente ↔ Gateway)

O TCP é um fluxo de bytes e não separa uma mensagem da outra. Por isso, cada mensagem é enviada como:
`uint32 big-endian com o tamanho` + `bytes da mensagem serializada`.

- Python: `sock.sendall(struct.pack(">I", len(b)) + b)`. Para ler: leia exatamente 4 bytes, depois exatamente N bytes, em loop até completar.
- Java: `DataOutputStream.writeInt(len)` + `write(bytes)`. Para ler: `DataInputStream.readInt()` + `readFully(buf)`.
