import socket
import time

import aquario_pb2 as pb
from .descoberta import Descoberta
from .log import log

Medidas = list[tuple[str, float, str]]  # (nome, valor, unidade)


class EnviadorLeituras:
    def __init__(self, descoberta: Descoberta, fonte_id: str, tipo: int):
        self.descoberta = descoberta
        self.fonte_id = fonte_id
        self.tipo = tipo
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._avisou_sem_gateway = False

    def enviar(self, medidas: Medidas, evento: bool = False, motivo: str = "") -> bool:
        destino = self.descoberta.gateway
        if destino is None:
            if not self._avisou_sem_gateway:
                log("DADOS", "gateway ainda desconhecido; aguardando descoberta")
                self._avisou_sem_gateway = True
            return False
        leitura = pb.Leitura(fonte_id=self.fonte_id, tipo=self.tipo, timestamp_ms=int(time.time() * 1000),
                             evento=evento, motivo_evento=motivo)
        for nome, valor, unidade in medidas:
            leitura.medidas.add(nome=nome, valor=float(valor), unidade=unidade)
        try:
            self.sock.sendto(leitura.SerializeToString(), destino)
        except OSError as e:  # rede fora do ar (ex.: Wi-Fi voltando da hibernação): tenta de novo na próxima amostra
            log("DADOS", f"falha ao enviar leitura: {e}")
            return False
        return True
