import threading
import time

from fontes.comum import config
from fontes.comum.fonte import ErroEquipamento, Fonte, parser_base
from fontes.comum.log import log
import aquario_pb2 as pb
from .backends import LuzMagicHome, LuzSimulada

TOLERANCIA_PCT = 2  # arredondamento 0–255 <-> 0–100 no controlador


class Luminaria(Fonte):
    fonte_id = "luminaria-smartled"
    tipo = pb.LUMINARIA
    controlavel = True
    amostragem_s = 2.0

    def __init__(self, args):
        super().__init__(args)
        if args.backend == "magichome":
            self.backend = LuzMagicHome(args.ip or config.carregar(args.config)["luminaria"]["ip"])
        else:
            self.backend = LuzSimulada()
        self.rampa_s = 0.0
        self._geracao_rampa = 0
        try:
            self._ligada, self._intensidade = self.backend.ler()
        except ErroEquipamento as e:
            log("ERRO", f"sem resposta da luminária ao iniciar ({e})")
            self._ligada, self._intensidade = False, 0
        self._esperado = (self._ligada, self._intensidade)
        log("LUMINARIA", f"{self.backend.descricao()} estado inicial: "
                         f"{'ligada' if self._ligada else 'desligada'} {self._intensidade}%")

    def ler(self):
        with self.lock:
            self._ligada, self._intensidade = self.backend.ler()
        return [("ligada", 1.0 if self._ligada else 0.0, ""), ("intensidade", float(self._intensidade), "%")]

    def eventos(self, medidas, agora):
        ligada, intensidade = self._esperado
        if self._ligada != ligada or abs(self._intensidade - intensidade) > TOLERANCIA_PCT:
            self._esperado = (self._ligada, self._intensidade)  # mudou por fora (app Magic Home)
            return ["mudou_estado"]
        return []

    def ligada(self):
        return self._ligada

    def parametros(self):
        return {"intensidade": float(self._intensidade), "rampa_s": self.rampa_s}

    def detalhe(self):
        return self.backend.descricao()

    def set_power(self, ligada: bool):
        with self.lock:
            self._geracao_rampa += 1  # cancela rampa em andamento
            self.backend.ligar(ligada)
            self._ligada = ligada
            self._esperado = (ligada, self._intensidade)

    def set_parametro_especifico(self, nome, valor):
        if nome == "rampa_s":
            if not 0 <= valor <= 3600:
                raise ValueError("rampa_s deve estar entre 0 e 3600")
            self.rampa_s = float(valor)
        elif nome == "intensidade":
            if not 0 <= valor <= 100:
                raise ValueError("intensidade deve estar entre 0 e 100")
            self._mudar_intensidade(round(valor))
        else:
            raise ValueError(f"parâmetro desconhecido: {nome} (aceitos: intensidade, rampa_s, intervalo_envio_s)")

    def _aplicar(self, pct: int):
        with self.lock:
            if pct > 0 and not self._ligada:
                self.backend.ligar(True)
                self._ligada = True
            self.backend.intensidade(pct)
            self._intensidade = pct
            self._esperado = (self._ligada, pct)

    def _mudar_intensidade(self, alvo: int):
        with self.lock:
            self._geracao_rampa += 1
            geracao = self._geracao_rampa
            inicio = self._intensidade
        passos = int(self.rampa_s)
        if passos <= 1 or inicio == alvo:
            self._aplicar(alvo)
            return

        def rampa():  # amanhecer/entardecer: um passo por segundo
            log("RAMPA", f"{inicio}% -> {alvo}% em {passos}s")
            for i in range(1, passos + 1):
                if self._geracao_rampa != geracao:
                    log("RAMPA", "cancelada por novo comando")
                    return
                try:
                    self._aplicar(round(inicio + (alvo - inicio) * i / passos))
                except ErroEquipamento as e:
                    log("ERRO", f"rampa interrompida: {e}")
                    return
                time.sleep(1)
            log("RAMPA", f"concluída em {alvo}%")

        threading.Thread(target=rampa, daemon=True, name="rampa").start()


def main():
    p = parser_base("Luminária Smartled / Magic Home (controlável)")
    p.add_argument("--porta-grpc", type=int, default=50051)
    p.add_argument("--backend", choices=["sim", "magichome"], default="sim")
    p.add_argument("--config", help="caminho do config.json (padrão: fontes/config.json)")
    p.add_argument("--ip", help="IP do controlador (sobrepõe o config.json)")
    Luminaria(p.parse_args()).executar()


if __name__ == "__main__":
    main()
