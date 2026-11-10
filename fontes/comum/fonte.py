import argparse
import threading
import time

import aquario_pb2 as pb
from .descoberta import Descoberta
from .envio import EnviadorLeituras, Medidas
from .log import log


class ErroEquipamento(Exception):
    pass


def parser_base(descricao: str) -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=descricao)
    p.add_argument("--ip-local", required=True, help="IP desta máquina na rede local (ex.: 192.168.0.33)")
    p.add_argument("--intervalo", type=int, default=10, help="período de envio das leituras (s)")
    return p


class Fonte:
    fonte_id = ""
    tipo = pb.TIPO_DESCONHECIDO
    controlavel = False
    amostragem_s = 1.0

    def __init__(self, args):
        self.ip_local = args.ip_local
        self.intervalo = args.intervalo
        self.porta_grpc = getattr(args, "porta_grpc", 0) if self.controlavel else 0
        self.em_falha = False
        self.lock = threading.RLock()
        self._acordar = threading.Event()
        self.descoberta = Descoberta(self.ip_local, self.resposta_descoberta)
        self.enviador = EnviadorLeituras(self.descoberta, self.fonte_id, self.tipo)

    def ler(self) -> Medidas:
        raise NotImplementedError

    def eventos(self, medidas: Medidas, agora: float) -> list[str]:
        return []

    def ligada(self) -> bool:
        return True

    def parametros(self) -> dict[str, float]:
        return {}

    def detalhe(self) -> str:
        return ""

    def set_power(self, ligada: bool) -> None:
        raise ValueError("fonte não controlável")

    def set_parametro_especifico(self, nome: str, valor: float) -> None:
        raise ValueError(f"parâmetro desconhecido: {nome}")

    def status(self) -> pb.Status:
        with self.lock:
            return pb.Status(ligada=self.ligada(), intervalo_envio_s=self.intervalo, parametros=self.parametros(),
                             em_falha=self.em_falha, detalhe=self.detalhe())

    def resposta_descoberta(self) -> pb.DiscoveryResponse:
        return pb.DiscoveryResponse(fonte_id=self.fonte_id, tipo=self.tipo, ip=self.ip_local,
                                    porta_grpc=self.porta_grpc, controlavel=self.controlavel, estado=self.status())

    def set_parametro(self, nome: str, valor: float) -> None:
        if nome == "intervalo_envio_s":
            if not 1 <= valor <= 3600:
                raise ValueError("intervalo_envio_s deve estar entre 1 e 3600")
            self.intervalo = int(valor)
            self._acordar.set()
            log("COMANDO", f"intervalo de envio = {self.intervalo} s")
            return
        self.set_parametro_especifico(nome, valor)

    def simular_falha(self, ativa: bool) -> None:
        self.em_falha = ativa
        log("FALHA", "simulação ATIVADA: leituras suspensas" if ativa else "simulação desativada: leituras retomadas")

    def executar(self) -> None:
        self.descoberta.iniciar()
        if self.controlavel:
            from .servidor import iniciar_grpc
            self._grpc = iniciar_grpc(self, self.porta_grpc)
        log("FONTE", f"{self.fonte_id} iniciada (amostragem {self.amostragem_s}s, envio a cada {self.intervalo}s)")
        ultimo_envio = 0.0
        while True:
            agora = time.monotonic()
            if not self.em_falha:
                try:
                    medidas = self.ler()
                    if self.descoberta.gateway is None:
                        self._acordar.wait(self.amostragem_s)
                        continue
                    motivos = self.eventos(medidas, agora)
                    if motivos:
                        if self.enviador.enviar(medidas, evento=True, motivo=",".join(motivos)):
                            log("EVENTO", f"{','.join(motivos)} {formatar(medidas)}")
                            ultimo_envio = agora
                    elif agora - ultimo_envio >= self.intervalo:
                        if self.enviador.enviar(medidas):
                            log("DADOS", formatar(medidas))
                            ultimo_envio = agora
                except ErroEquipamento as e:
                    log("ERRO", f"equipamento sem resposta: {e}")
            self._acordar.wait(self.amostragem_s)
            if self._acordar.is_set():
                self._acordar.clear()
                ultimo_envio = 0.0


def formatar(medidas: Medidas) -> str:
    return " ".join(f"{n}={v:.2f}{u}" if isinstance(v, float) and not v.is_integer() else f"{n}={v:g}{u}"
                    for n, v, u in medidas)
