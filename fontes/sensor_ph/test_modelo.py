import unittest

from fontes.comum.limiar import DetectorLimiar
from fontes.sensor_ph.modelo import proximo_ph


class TestModeloPh(unittest.TestCase):
    def test_aproxima_alvo_em_3_tau(self):
        ph = 7.2
        for _ in range(180):  # 3·tau com tau = 60 s e passos de 1 s
            ph = proximo_ph(ph, 6.2, dt=1, tau=60)
        self.assertAlmostEqual(ph, 6.25, delta=0.01)

    def test_evento_so_ao_cruzar_com_histerese_e_repeticao(self):
        d = DetectorLimiar(6.4, abaixo=True, histerese=0.1, repetir_s=60)
        self.assertFalse(d.avaliar(6.5, 0))
        self.assertTrue(d.avaliar(6.39, 1))      # cruzou
        self.assertFalse(d.avaliar(6.35, 2))     # continua baixo: não repete antes de 60 s
        self.assertTrue(d.avaliar(6.35, 62))     # repete depois de 60 s
        self.assertFalse(d.avaliar(6.45, 63))    # dentro da histerese: ainda em alerta
        self.assertTrue(d.em_alerta)
        self.assertFalse(d.avaliar(6.51, 64))    # rearmou
        self.assertFalse(d.em_alerta)
        self.assertTrue(d.avaliar(6.3, 65))      # novo cruzamento avisa na hora


if __name__ == "__main__":
    unittest.main()
