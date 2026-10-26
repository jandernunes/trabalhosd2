import socket
import struct

import aquario_pb2 as pb


class GatewayIndisponivel(Exception):
    pass


def enviar_msg(sock: socket.socket, msg) -> None:
    corpo = msg.SerializeToString()
    sock.sendall(struct.pack(">I", len(corpo)) + corpo)


def _ler_exato(sock: socket.socket, n: int) -> bytes:
    partes, falta = [], n
    while falta:
        bloco = sock.recv(falta)  # o TCP pode entregar menos bytes do que o pedido
        if not bloco:
            raise ConnectionError("conexão fechada pelo gateway")
        partes.append(bloco)
        falta -= len(bloco)
    return b"".join(partes)


def receber_msg(sock: socket.socket, tipo):
    (n,) = struct.unpack(">I", _ler_exato(sock, 4))
    return tipo.FromString(_ler_exato(sock, n))


class ConexaoGateway:
    """Conexão TCP persistente com o Gateway; reconecta uma vez se a conexão tiver caído."""

    def __init__(self, host: str, porta: int, timeout: float = 5):
        self.endereco = (host, porta)
        self.timeout = timeout
        self.sock: socket.socket | None = None

    def _conectar(self) -> socket.socket:
        if self.sock is None:
            try:
                self.sock = socket.create_connection(self.endereco, timeout=self.timeout)
            except OSError as e:
                raise GatewayIndisponivel(f"Gateway indisponível em {self.endereco[0]}:{self.endereco[1]} ({e})")
        return self.sock

    def enviar(self, req: pb.Requisicao) -> pb.Resposta:
        for tentativa in (1, 2):
            sock = self._conectar()
            try:
                enviar_msg(sock, req)
                return receber_msg(sock, pb.Resposta)
            except (OSError, ConnectionError) as e:
                self.fechar()
                if tentativa == 2:
                    raise GatewayIndisponivel(f"Gateway indisponível ({e})")

    def fechar(self) -> None:
        if self.sock is not None:
            self.sock.close()
            self.sock = None
