import math
import random
import time

from fontes.comum.fonte import Fonte, parser_base
from fontes.comum.limiar import DetectorLimiar
from fontes.comum.log import log
import aquario_pb2 as pb


class SensorTemperatura(Fonte):
    fonte_id = "sensor-temperatura"
    tipo = pb.SENSOR_TEMPERATURA

    def __init__(self, args):
        super().__init__(args)
        self.base = args.base
        self.amplitude = args.amplitude
        self.periodo = args.periodo_s
        self.superaquecimento = args.cenario == "superaquecimento"
        self.detector = DetectorLimiar(args.limiar, abaixo=False, histerese=0.3)
        self._inicio = time.monotonic()
        if self.superaquecimento:
            log("SIM", "cenário superaquecimento: a base sobe 0,1 °C por amostra até 32 °C")

    def ler(self):
        t = time.monotonic() - self._inicio
        if self.superaquecimento:
            self.base = min(32.0, self.base + 0.1)
        valor = self.base + self.amplitude * math.sin(2 * math.pi * t / self.periodo) + random.uniform(-0.1, 0.1)
        return [("temperatura", round(valor, 2), "C")]

    def eventos(self, medidas, agora):
        return ["temperatura_alta"] if self.detector.avaliar(medidas[0][1], agora) else []

    def parametros(self):
        return {"limiar": self.detector.limiar}

    def detalhe(self):
        return "simulado"


def main():
    p = parser_base("Sensor de temperatura simulado (não controlável)")
    p.add_argument("--base", type=float, default=26.0)
    p.add_argument("--amplitude", type=float, default=0.8)
    p.add_argument("--periodo-s", type=float, default=600)
    p.add_argument("--limiar", type=float, default=30.0)
    p.add_argument("--cenario", choices=["normal", "superaquecimento"], default="normal")
    SensorTemperatura(p.parse_args()).executar()


if __name__ == "__main__":
    main()
