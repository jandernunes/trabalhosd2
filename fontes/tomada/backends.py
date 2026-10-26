import random

from fontes.comum.fonte import ErroEquipamento


def converter_dps(dps: dict) -> dict:
    """DPS da tomada Gaya/Tuya -> medidas (mapeamento confirmado no tinytuya wizard)."""
    return {
        "ligada": bool(dps.get("1", False)),
        "corrente": float(dps.get("18", 0)),         # mA
        "potencia": float(dps.get("19", 0)) / 10,    # W
        "tensao": float(dps.get("20", 0)) / 10,      # V
    }


class TomadaSimulada:
    def __init__(self, potencia_w: float):
        self.potencia_w = potencia_w
        self._ligada = False

    def ler(self) -> dict:
        tensao = 220 + random.uniform(-3, 3)
        potencia = self.potencia_w * random.uniform(0.95, 1.05) if self._ligada else 0.0
        return {"ligada": self._ligada, "potencia": round(potencia, 1),
                "corrente": round(potencia / tensao * 1000), "tensao": round(tensao, 1)}

    def definir(self, ligada: bool) -> None:
        self._ligada = ligada

    def descricao(self) -> str:
        return "backend=sim"


class TomadaTuya:
    def __init__(self, dispositivo: dict):
        import tinytuya
        self.ip = dispositivo["ip"]
        self.dev = tinytuya.OutletDevice(dispositivo["dev_id"], self.ip, dispositivo["local_key"],
                                         version=float(dispositivo["version"]), connection_timeout=3,
                                         connection_retry_limit=2, connection_retry_delay=1)
        self.dev.set_socketPersistent(False)

    @staticmethod
    def _checar(resultado):
        if not isinstance(resultado, dict) or "Error" in resultado:
            raise ErroEquipamento(resultado.get("Error") if isinstance(resultado, dict) else "sem resposta")
        return resultado

    def ler(self) -> dict:
        return converter_dps(self._checar(self.dev.status())["dps"])

    def definir(self, ligada: bool) -> None:
        self._checar(self.dev.turn_on() if ligada else self.dev.turn_off())

    def descricao(self) -> str:
        return f"backend=tuya ip={self.ip}"
