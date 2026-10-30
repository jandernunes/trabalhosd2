import unittest
from unittest import mock

from fontes.comum.envio import EnviadorLeituras


class TestEnvio(unittest.TestCase):
    def test_rede_fora_do_ar_nao_derruba_a_fonte(self):
        e = EnviadorLeituras(mock.Mock(gateway=("192.168.0.33", 50002)), "sensor-temperatura", 0)
        e.sock = mock.Mock()
        e.sock.sendto.side_effect = OSError(10051, "rede inacessível")
        self.assertFalse(e.enviar([("temperatura", 26.0, "C")]))
        e.sock.sendto.side_effect = None
        self.assertTrue(e.enviar([("temperatura", 26.0, "C")]))


if __name__ == "__main__":
    unittest.main()
