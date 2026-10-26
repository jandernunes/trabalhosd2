from concurrent import futures

import grpc

import aquario_pb2 as pb
import aquario_pb2_grpc as pb_grpc
from .fonte import ErroEquipamento
from .log import log


class _Servico(pb_grpc.FonteControlavelServicer):
    def __init__(self, fonte):
        self.fonte = fonte

    def _executar(self, context, acao, descricao):
        try:
            acao()
        except ValueError as e:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(e))
        except ErroEquipamento as e:
            context.abort(grpc.StatusCode.UNAVAILABLE, f"equipamento sem resposta: {e}")
        log("COMANDO", descricao)
        return self.fonte.status()

    def GetStatus(self, request, context):
        return self.fonte.status()

    def SetPower(self, request, context):
        return self._executar(context, lambda: self.fonte.set_power(request.ligada),
                              f"SetPower({'ligar' if request.ligada else 'desligar'})")

    def SetParametro(self, request, context):
        return self._executar(context, lambda: self.fonte.set_parametro(request.nome, request.valor),
                              f"SetParametro({request.nome}={request.valor:g})")

    def SimularFalha(self, request, context):
        return self._executar(context, lambda: self.fonte.simular_falha(request.ativa),
                              f"SimularFalha({request.ativa})")


def iniciar_grpc(fonte, porta: int) -> grpc.Server:
    servidor = grpc.server(futures.ThreadPoolExecutor(max_workers=4))
    pb_grpc.add_FonteControlavelServicer_to_server(_Servico(fonte), servidor)
    if servidor.add_insecure_port(f"0.0.0.0:{porta}") == 0:
        raise SystemExit(f"Não foi possível abrir a porta gRPC {porta} (já está em uso?)")
    servidor.start()
    log("GRPC", f"FonteControlavel ouvindo na porta {porta}")
    return servidor
