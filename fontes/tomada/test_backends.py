import unittest

from fontes.tomada.backends import converter_dps


class TestConversaoDps(unittest.TestCase):
    def test_converte_leitura_real_do_wizard(self):
        dps = {'1': True, '9': 0, '18': 37, '19': 82, '20': 2225, '38': 'on'}
        self.assertEqual(converter_dps(dps), {"ligada": True, "corrente": 37.0, "potencia": 8.2, "tensao": 222.5})

    def test_desligada_sem_campos_de_energia(self):
        self.assertEqual(converter_dps({'1': False}), {"ligada": False, "corrente": 0.0, "potencia": 0.0, "tensao": 0.0})


if __name__ == "__main__":
    unittest.main()
