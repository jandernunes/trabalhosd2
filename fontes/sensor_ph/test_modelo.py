import unittest

from fontes.comum.limiar import DetectorLimiar
from fontes.sensor_ph.modelo import proximo_ph


class TestModeloPh(unittest.TestCase):
    def test_aproxima_alvo_em_3_tau(self):
        ph = 7.2
        for _ in range(180):
            ph = proximo_ph(ph, 6.2, dt=1, tau=60)
        self.assertAlmostEqual(ph, 6.25, delta=0.01)

    def test_evento_so_ao_cruzar_com_histerese_e_repeticao(self):
        d = DetectorLimiar(6.4, abaixo=True, histerese=0.1, repetir_s=60)
        self.assertFalse(d.avaliar(6.5, 0))
        self.assertTrue(d.avaliar(6.39, 1))
        self.assertFalse(d.avaliar(6.35, 2))
        self.assertTrue(d.avaliar(6.35, 62))
        self.assertFalse(d.avaliar(6.45, 63))
        self.assertTrue(d.em_alerta)
        self.assertFalse(d.avaliar(6.51, 64))
        self.assertFalse(d.em_alerta)
        self.assertTrue(d.avaliar(6.3, 65))


if __name__ == "__main__":
    unittest.main()
