from fontes.comum.fonte import ErroEquipamento


class LuzSimulada:
    def __init__(self):
        self._ligada = False
        self._intensidade = 100

    def ler(self) -> tuple[bool, int]:
        return self._ligada, self._intensidade

    def ligar(self, ligada: bool) -> None:
        self._ligada = ligada

    def intensidade(self, pct: int) -> None:
        self._intensidade = pct

    def descricao(self) -> str:
        return "backend=sim"


class LuzMagicHome:
    """Controlador Magic Home 'Controller Dimmable (0x41)': brilho no canal warm white, TCP 5577 sem chave."""

    def __init__(self, ip: str):
        self.ip = ip
        self._bulb = None

    def _lampada(self):
        if self._bulb is None:
            from flux_led import WifiLedBulb
            try:
                self._bulb = WifiLedBulb(self.ip, timeout=3)
            except Exception as e:  # flux_led levanta exceções variadas de socket
                raise ErroEquipamento(str(e)) from e
        return self._bulb

    def _chamar(self, acao):
        try:
            return acao(self._lampada())
        except ErroEquipamento:
            raise
        except Exception as e:
            self._bulb = None  # reconecta na próxima
            raise ErroEquipamento(str(e)) from e

    def ler(self) -> tuple[bool, int]:
        def ler(b):
            b.update_state()
            return bool(b.is_on), round(b.brightness * 100 / 255)
        return self._chamar(ler)

    def ligar(self, ligada: bool) -> None:
        self._chamar(lambda b: b.turnOn() if ligada else b.turnOff())

    def intensidade(self, pct: int) -> None:
        self._chamar(lambda b: b.setWarmWhite(pct))

    def descricao(self) -> str:
        return f"backend=magichome ip={self.ip}"
