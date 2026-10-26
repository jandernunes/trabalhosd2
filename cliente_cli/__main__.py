import argparse
import cmd
import shlex
import time

import aquario_pb2 as pb
from .conexao import ConexaoGateway, GatewayIndisponivel

TIPOS_CURTOS = {
    pb.LUMINARIA: "luminária", pb.TOMADA_CO2: "tomada CO2", pb.TOMADA_LUMINARIA: "tomada luminária",
    pb.SENSOR_PH: "sensor pH", pb.SENSOR_TEMPERATURA: "sensor temp.",
}


def tabela(cabecalho: list[str], linhas: list[list[str]]) -> str:
    larguras = [max(len(str(x)) for x in col) for col in zip(cabecalho, *linhas)]
    fmt = "  ".join(f"{{:<{w}}}" for w in larguras)
    return "\n".join([fmt.format(*cabecalho), fmt.format(*("-" * w for w in larguras))]
                     + [fmt.format(*map(str, l)) for l in linhas])


def numero(v: float) -> str:
    return f"{v:g}" if float(v).is_integer() else f"{v:.2f}"


def medidas(leitura: pb.Leitura) -> str:
    return " ".join(f"{m.nome}={numero(m.valor)}{m.unidade}" for m in leitura.medidas if m.nome != "ligada")


def janela(args: list[str], i: int) -> int:
    return int(args[i]) if len(args) > i else 60


class Cli(cmd.Cmd):
    intro = "Aquário Plantado Inteligente — cliente do Gateway. Digite 'ajuda' para ver os comandos."
    prompt = "aquario> "

    def __init__(self, conexao: ConexaoGateway):
        super().__init__()
        self.conexao = conexao

    # ---- infraestrutura ------------------------------------------------------------------------
    def _pedir(self, **campos) -> pb.Resposta | None:
        try:
            resp = self.conexao.enviar(pb.Requisicao(**campos))
        except GatewayIndisponivel as e:
            print(e)
            return None
        if not resp.ok:
            print(f"Erro: {resp.erro}")
            return None
        return resp

    def onecmd(self, linha):
        try:
            return super().onecmd(linha)
        except IndexError:
            print("Faltam argumentos. Digite 'ajuda'.")
        except ValueError as e:
            print(f"Uso inválido ({e}). Digite 'ajuda'.")

    def emptyline(self):
        pass

    def default(self, linha):
        print(f"Comando desconhecido: {linha.split()[0]}. Digite 'ajuda'.")

    # ---- fontes e comandos ----------------------------------------------------------------------
    def do_fontes(self, _):
        """fontes — lista as fontes, estados e últimas leituras"""
        resp = self._pedir(listar=pb.ListarFontes())
        if resp is None:
            return
        agora = time.time() * 1000
        linhas = []
        for f in resp.fontes.fontes:
            params = " ".join(f"{k}={numero(v)}" for k, v in sorted(f.estado.parametros.items()))
            linhas.append([f.fonte_id, TIPOS_CURTOS.get(f.tipo, "?"), "ONLINE" if f.online else "OFFLINE",
                           ("sim" if f.estado.ligada else "não") if f.controlavel else "-",
                           medidas(f.ultima_leitura) or "-", params or "-",
                           f"{(agora - f.visto_em_ms) / 1000:.0f}s", "FALHA SIMULADA" if f.estado.em_falha else ""])
        if not linhas:
            print("Nenhuma fonte descoberta ainda (o Gateway pergunta a cada 30 s).")
            return
        print(tabela(["ID", "TIPO", "STATUS", "LIGADA", "ÚLTIMA LEITURA", "PARÂMETROS", "VISTO HÁ", ""], linhas))

    def _comando(self, fonte_id, **acao):
        resp = self._pedir(comando=pb.Comando(fonte_id=fonte_id, **acao))
        if resp is not None:
            e = resp.estado
            params = " ".join(f"{k}={numero(v)}" for k, v in sorted(e.parametros.items()))
            print(f"OK {fonte_id}: ligada={'sim' if e.ligada else 'não'} intervalo={e.intervalo_envio_s}s "
                  f"{params} {'FALHA SIMULADA' if e.em_falha else ''}".rstrip())

    def do_ligar(self, arg):
        """ligar <id> — liga uma fonte controlável"""
        self._comando(shlex.split(arg)[0], power=pb.ComandoPower(ligada=True))

    def do_desligar(self, arg):
        """desligar <id> — desliga uma fonte controlável"""
        self._comando(shlex.split(arg)[0], power=pb.ComandoPower(ligada=False))

    def do_param(self, arg):
        """param <id> <nome> <valor> — ex.: param luminaria-smartled intensidade 40"""
        fonte, nome, valor = shlex.split(arg)
        self._comando(fonte, parametro=pb.ComandoParametro(nome=nome, valor=float(valor)))

    def do_falha(self, arg):
        """falha <id> on|off — simula falha (a fonte para de enviar leituras)"""
        fonte, estado = shlex.split(arg)
        if estado not in ("on", "off"):
            raise ValueError("use on ou off")
        self._comando(fonte, falha=pb.ComandoFalha(ativa=estado == "on"))

    # ---- consultas ------------------------------------------------------------------------------
    def _consulta(self, **campos):
        resp = self._pedir(consulta=pb.Consulta(**campos))
        if resp is None:
            return
        r = resp.resultado
        print(r.descricao)
        if r.linhas:
            print(tabela(["", "VALOR", ""], [[l.chave, numero(round(l.valor, 3)), l.unidade] for l in r.linhas]))

    def do_media(self, arg):
        """media <id> <medida> [min] — média, desvio padrão, mín. e máx. (padrão: 60 min)"""
        a = shlex.split(arg)
        self._consulta(tipo=pb.MEDIA_DESVIO, fonte_id=a[0], medida=a[1], janela_min=janela(a, 2))

    def do_consumo(self, arg):
        """consumo [min] — energia (Wh) por tomada"""
        self._consulta(tipo=pb.CONSUMO_WH, janela_min=janela(shlex.split(arg), 0))

    def do_tempo_ligado(self, arg):
        """tempo-ligado [min] — horas ligada por fonte controlável"""
        self._consulta(tipo=pb.TEMPO_LIGADO, janela_min=janela(shlex.split(arg), 0))

    def do_ph(self, arg):
        """ph [min] — pH mínimo e número de alertas"""
        self._consulta(tipo=pb.PH_MIN_ALERTAS, janela_min=janela(shlex.split(arg), 0))

    def do_variacao(self, arg):
        """variacao [min] — fonte/medida com maior coeficiente de variação"""
        self._consulta(tipo=pb.MAIOR_VARIACAO, janela_min=janela(shlex.split(arg), 0))

    def do_historico(self, arg):
        """historico <id> <medida> [min] — série temporal (até 20 pontos)"""
        a = shlex.split(arg)
        resp = self._pedir(historico=pb.PedidoHistorico(fonte_id=a[0], medida=a[1], janela_min=janela(a, 2),
                                                        max_pontos=20))
        if resp is None:
            return
        pontos = resp.serie.pontos
        if not pontos:
            print("Sem pontos na janela.")
            return
        print(tabela(["HORA", a[1].upper()], [[time.strftime("%H:%M:%S", time.localtime(p.timestamp_ms / 1000)),
                                               numero(round(p.valor, 3))] for p in pontos]))

    # ---- utilidades -----------------------------------------------------------------------------
    def do_ajuda(self, _):
        """ajuda — mostra os comandos"""
        for nome in ["fontes", "ligar", "desligar", "param", "falha", "media", "consumo", "tempo_ligado", "ph",
                     "variacao", "historico", "sair"]:
            print("  " + getattr(self, f"do_{nome}").__doc__)

    def do_sair(self, _):
        """sair — encerra o cliente"""
        self.conexao.fechar()
        return True

    do_EOF = do_sair

    def precmd(self, linha):
        return linha.replace("tempo-ligado", "tempo_ligado", 1)


def main():
    p = argparse.ArgumentParser(description="Cliente de linha de comando do Gateway")
    p.add_argument("--gateway", default="127.0.0.1:50010", help="host:porta do Gateway")
    p.add_argument("-c", "--comando", action="append", help="executa o comando e sai (pode repetir)")
    args = p.parse_args()
    host, porta = args.gateway.rsplit(":", 1)
    cli = Cli(ConexaoGateway(host, int(porta)))
    if args.comando:
        for c in args.comando:
            print(f"{cli.prompt}{c}")
            cli.onecmd(cli.precmd(c))
        cli.conexao.fechar()
    else:
        cli.cmdloop()


if __name__ == "__main__":
    main()
