import socket
import struct
import threading
import unittest

import cliente_cli  # noqa: F401  (ajusta o sys.path para gen/python)
import aquario_pb2 as pb
from cliente_cli.conexao import receber_msg


class TestEnquadramento(unittest.TestCase):
    def test_mensagem_partida_em_pedacos_e_lida_inteira(self):
        a, b = socket.socketpair()
        msg = pb.Resposta(ok=True, erro="x" * 300)
        corpo = msg.SerializeToString()
        dados = struct.pack(">I", len(corpo)) + corpo

        def enviar_aos_pedacos():
            for i in range(0, len(dados), 7):
                a.sendall(dados[i:i + 7])

        threading.Thread(target=enviar_aos_pedacos).start()
        self.assertEqual(receber_msg(b, pb.Resposta), msg)
        a.close()
        b.close()


if __name__ == "__main__":
    unittest.main()
