import random
import time

import grpc

from fontes.comum.fonte import Fonte, parser_base
from fontes.comum.limiar import DetectorLimiar
from fontes.comum.log import log
import aquario_pb2 as pb
import aquario_pb2_grpc as pb_grpc
from .modelo import proximo_ph


class SensorPh(Fonte):
    fonte_id = "sensor-ph"
    tipo = pb.SENSOR_PH

    def __init__(self, args):
        super().__init__(args)
        self.ph_sem_co2 = args.ph_sem_co2
        self.ph_com_co2 = args.ph_com_co2
        self.tau = args.tau_s
        self.ph = args.ph_sem_co2
        self.detector = DetectorLimiar(args.limiar, abaixo=True)
        # Simplificação da simulação: o pH "sabe" do CO2 lendo o estado da tomada pelo gRPC (só leitura).
        self.co2 = pb_grpc.FonteControlavelStub(grpc.insecure_channel(args.co2_grpc))
        self.co2_ligado = False
        self._ultimo = time.monotonic()

    def _ler_co2(self) -> bool:
        try:
            return self.co2.GetStatus(pb.Vazio(), timeout=1).ligada
        except grpc.RpcError:
            return False

    def ler(self):
        agora = time.monotonic()
        ligado = self._ler_co2()
        if ligado != self.co2_ligado:
            log("SIM", f"CO2 {'ligado' if ligado else 'desligado'}: pH tende a "
                       f"{self.ph_com_co2 if ligado else self.ph_sem_co2}")
            self.co2_ligado = ligado
        alvo = self.ph_com_co2 if ligado else self.ph_sem_co2
        self.ph = proximo_ph(self.ph, alvo, agora - self._ultimo, self.tau)
        self._ultimo = agora
        return [("ph", round(self.ph + random.uniform(-0.02, 0.02), 3), "pH")]

    def eventos(self, medidas, agora):
        return ["ph_baixo"] if self.detector.avaliar(medidas[0][1], agora) else []

    def parametros(self):
        return {"limiar": self.detector.limiar}

    def detalhe(self):
        return "simulado"


def main():
    p = parser_base("Sensor de pH simulado (não controlável)")
    p.add_argument("--ph-sem-co2", type=float, default=7.2)
    p.add_argument("--ph-com-co2", type=float, default=6.6, help="use 6.2 para demonstrar o alerta")
    p.add_argument("--tau-s", type=float, default=60)
    p.add_argument("--limiar", type=float, default=6.4)
    p.add_argument("--co2-grpc", default="127.0.0.1:50052", help="endereço gRPC da tomada do CO2")
    SensorPh(p.parse_args()).executar()


if __name__ == "__main__":
    main()
