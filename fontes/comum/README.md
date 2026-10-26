# fontes/comum/ — Código compartilhado pelas fontes

**Responsável:** Pessoa B (com revisão da Pessoa C, que também usa).
**Objetivo:** escrever **uma vez** o que todas as fontes repetem. Cada fonte só implementa o próprio comportamento.

## Módulos sugeridos

### `descoberta.py`
```python
class Descoberta:
    def __init__(self, ip_local: str, montar_resposta: Callable[[], DiscoveryResponse]): ...
    def iniciar(self): ...                 # thread daemon
    gateway: tuple[str, int] | None        # (gateway_ip, porta_dados) depois do 1º pedido
    ultimo_pedido_em: float                # time.monotonic() do último DiscoveryRequest (usado no failsafe)
```
Socket de recepção do multicast:
```python
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)   # várias fontes no mesmo PC
s.bind(("", 50000))
mreq = socket.inet_aton("239.10.10.10") + socket.inet_aton(ip_local)  # amarra à interface certa
s.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
```
A resposta vai em unicast: `sendto(resp.SerializeToString(), (req.gateway_ip, req.porta_resposta))`.

### `envio.py`
```python
class EnviadorLeituras:
    def __init__(self, descoberta: Descoberta, fonte_id: str, tipo: TipoFonte): ...
    def enviar(self, medidas: list[tuple[str, float, str]], evento=False, motivo=""): ...
```
Monta a `Leitura` com `timestamp_ms = int(time.time()*1000)` e envia por UDP para `gateway`. Se o Gateway ainda é desconhecido, descarta (e loga uma vez).

### `laco.py`
Laço periódico padrão: a cada `intervalo_envio_s`, chama `ler()` da fonte, envia e verifica os eventos. Respeita `em_falha` (não envia).
`intervalo_envio_s` pode mudar em tempo real (via gRPC).

### `args.py`
Argumentos comuns: `--ip-local` (obrigatório), `--intervalo` (padrão 10), `--backend sim|real`.

## Pronto quando

- [ ] Duas fontes no **mesmo PC** recebem o mesmo `DiscoveryRequest` (o `SO_REUSEADDR` funciona no Windows).
- [ ] Teste rápido sem Gateway: um script envia um `DiscoveryRequest` para o grupo e imprime as respostas recebidas.
