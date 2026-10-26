def proximo_ph(ph: float, alvo: float, dt: float, tau: float) -> float:
    """Resposta de primeira ordem: o pH caminha para o alvo com constante de tempo tau."""
    return ph + (alvo - ph) * min(1.0, dt / tau)
