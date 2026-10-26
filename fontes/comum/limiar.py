class DetectorLimiar:
    """Dispara um evento ao cruzar o limiar, repete no máximo a cada `repetir_s` e rearma com histerese."""

    def __init__(self, limiar: float, abaixo: bool, histerese: float = 0.1, repetir_s: float = 60):
        self.limiar = limiar
        self.abaixo = abaixo  # True: alerta quando valor < limiar (pH); False: valor > limiar (temperatura)
        self.histerese = histerese
        self.repetir_s = repetir_s
        self.em_alerta = False
        self._ultimo_aviso = 0.0

    def avaliar(self, valor: float, agora: float) -> bool:
        fora = valor < self.limiar if self.abaixo else valor > self.limiar
        if fora:
            if not self.em_alerta or agora - self._ultimo_aviso >= self.repetir_s:
                self.em_alerta = True
                self._ultimo_aviso = agora
                return True
            return False
        normal = valor >= self.limiar + self.histerese if self.abaixo else valor <= self.limiar - self.histerese
        if normal:
            self.em_alerta = False
        return False
