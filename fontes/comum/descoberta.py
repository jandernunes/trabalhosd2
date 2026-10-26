import socket
import threading
import time
from typing import Callable

from google.protobuf.message import DecodeError

import aquario_pb2 as pb
from .log import log

GRUPO = "239.10.10.10"
PORTA = 50000


class Descoberta:
    """Escuta os DiscoveryRequest do Gateway (multicast) e responde em unicast."""

    def __init__(self, ip_local: str, montar_resposta: Callable[[], pb.DiscoveryResponse]):
        self.ip_local = ip_local
        self.montar_resposta = montar_resposta
        self.gateway: tuple[str, int] | None = None  # (gateway_ip, porta_dados)
        self.ultimo_pedido_em: float | None = None  # time.monotonic() do último pedido (failsafe)

    def iniciar(self) -> None:
        threading.Thread(target=self._laco, daemon=True, name="descoberta").start()

    def _laco(self) -> None:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)  # várias fontes no mesmo PC
        s.bind(("", PORTA))
        # Amarra a inscrição à interface da rede local (com VPN/WSL o padrão do SO pode ser outra).
        mreq = socket.inet_aton(GRUPO) + socket.inet_aton(self.ip_local)
        s.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
        resposta = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        log("DESCOBERTA", f"escutando {GRUPO}:{PORTA} na interface {self.ip_local}")
        while True:
            dados, _ = s.recvfrom(65535)
            try:
                req = pb.DiscoveryRequest.FromString(dados)
            except DecodeError:
                continue
            if not req.gateway_ip or not req.porta_resposta:
                continue
            novo = self.gateway != (req.gateway_ip, req.porta_dados)
            self.gateway = (req.gateway_ip, req.porta_dados)
            self.ultimo_pedido_em = time.monotonic()
            resposta.sendto(self.montar_resposta().SerializeToString(), (req.gateway_ip, req.porta_resposta))
            if novo:
                log("DESCOBERTA", f"gateway em {req.gateway_ip} (dados na porta {req.porta_dados})")
