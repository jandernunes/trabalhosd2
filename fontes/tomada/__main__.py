import threading
import time

from fontes.comum import config
from fontes.comum.fonte import ErroEquipamento, Fonte, parser_base
from fontes.comum.log import log
import aquario_pb2 as pb
from .backends import TomadaSimulada, TomadaTuya

FAILSAFE_S = 90         # sem DiscoveryRequest por esse tempo -> desliga o CO2
SEM_CONSUMO_W = 0.5
SEM_CONSUMO_S = 10      # ligada sem consumo por esse tempo -> evento (lâmpada queimada, solenoide com defeito)


class Tomada(Fonte):
    controlavel = True
    amostragem_s = 2.0

    def __init__(self, args):
        self.fonte_id = args.id
        self.tipo = pb.TipoFonte.Value(args.tipo)
        super().__init__(args)
        if args.backend == "tuya":
            self.backend = TomadaTuya(config.dispositivo_tuya(config.carregar(args.config), self.fonte_id))
        else:
            potencia = args.potencia_sim or (8.0 if self.tipo == pb.TOMADA_CO2 else 20.0)
            self.backend = TomadaSimulada(potencia)
        self.failsafe = args.failsafe
        try:
            self._estado = self.backend.ler()   # última leitura conhecida
        except ErroEquipamento as e:
            log("ERRO", f"sem resposta da tomada ao iniciar ({e}); assumindo desligada")
            self._estado = {"ligada": False, "potencia": 0.0, "corrente": 0.0, "tensao": 0.0}
        self._ligada_esperada = self._estado["ligada"]
        self._sem_consumo_desde = None
        self._avisou_sem_consumo = False
        self._failsafe_acionado = False
        self._inicio = time.monotonic()
        log("TOMADA", f"{self.backend.descricao()} estado inicial: {'ligada' if self._estado['ligada'] else 'desligada'}")

    def ler(self):
        with self.lock:
            self._estado = self.backend.ler()
            e = self._estado
        return [("ligada", 1.0 if e["ligada"] else 0.0, ""), ("potencia", e["potencia"], "W"),
                ("corrente", e["corrente"], "mA"), ("tensao", e["tensao"], "V")]

    def eventos(self, medidas, agora):
        motivos = []
        e = self._estado
        if e["ligada"] != self._ligada_esperada:   # mudou por fora do sistema (timer do app, botão físico)
            self._ligada_esperada = e["ligada"]
            motivos.append("mudou_estado")
        if e["ligada"] and e["potencia"] < SEM_CONSUMO_W:
            self._sem_consumo_desde = self._sem_consumo_desde or agora
            if agora - self._sem_consumo_desde >= SEM_CONSUMO_S and not self._avisou_sem_consumo:
                self._avisou_sem_consumo = True
                motivos.append("ligada_sem_consumo")
        else:
            self._sem_consumo_desde = None
            self._avisou_sem_consumo = False
        return motivos

    def ligada(self):
        return self._estado["ligada"]

    def detalhe(self):
        return self.backend.descricao() + (" failsafe" if self.failsafe else "")

    def set_power(self, ligada: bool):
        with self.lock:
            self.backend.definir(ligada)
            self._ligada_esperada = ligada
            self._estado = dict(self._estado, ligada=ligada)

    def _vigiar_gateway(self):
        while True:
            time.sleep(5)
            referencia = self.descoberta.ultimo_pedido_em or self._inicio
            ausente = time.monotonic() - referencia > FAILSAFE_S
            if not ausente:
                self._failsafe_acionado = False
            elif self._estado["ligada"] and not self._failsafe_acionado:
                self._failsafe_acionado = True
                try:
                    self.set_power(False)
                    log("FAILSAFE", f"gateway ausente há mais de {FAILSAFE_S}s: {self.fonte_id} DESLIGADA")
                except ErroEquipamento as e:
                    self._failsafe_acionado = False
                    log("FAILSAFE", f"falhou ao desligar ({e}); tentando de novo em 5 s")

    def executar(self):
        if self.failsafe:
            threading.Thread(target=self._vigiar_gateway, daemon=True, name="failsafe").start()
        super().executar()


def main():
    p = parser_base("Tomada Wi-Fi Gaya/Tuya (controlável)")
    p.add_argument("--id", required=True, help="tomada-co2 ou tomada-luminaria")
    p.add_argument("--tipo", required=True, choices=["TOMADA_CO2", "TOMADA_LUMINARIA"])
    p.add_argument("--porta-grpc", type=int, required=True)
    p.add_argument("--backend", choices=["sim", "tuya"], default="sim")
    p.add_argument("--config", help="caminho do config.json (padrão: fontes/config.json)")
    p.add_argument("--failsafe", action="store_true", help="desliga a tomada se o gateway sumir por 90 s")
    p.add_argument("--potencia-sim", type=float, help="potência simulada quando ligada (W)")
    Tomada(p.parse_args()).executar()


if __name__ == "__main__":
    main()
