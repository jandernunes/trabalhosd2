package br.ufc.sd.aquario.gateway;

import br.ufc.sd.aquario.proto.Consulta;
import br.ufc.sd.aquario.proto.PedidoHistorico;
import br.ufc.sd.aquario.proto.Requisicao;
import br.ufc.sd.aquario.proto.Resposta;
import br.ufc.sd.aquario.proto.ResultadoConsulta;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Servidor TCP do Cliente: cada mensagem vem precedida de 4 bytes (uint32 big-endian) com o tamanho. */
final class ServidorClientes implements Runnable {
    static final int TAMANHO_MAXIMO = 1 << 20;

    private final int porta;
    private final RegistroFontes registro;
    private final ControleFontes controle;
    private final Repositorio repositorio;
    private final ExecutorService clientes = Executors.newCachedThreadPool();

    ServidorClientes(int porta, RegistroFontes registro, ControleFontes controle, Repositorio repositorio) {
        this.porta = porta;
        this.registro = registro;
        this.controle = controle;
        this.repositorio = repositorio;
    }

    @Override
    public void run() {
        try (ServerSocket ss = new ServerSocket(porta)) {
            Log.info("CLIENTE", "servidor TCP ouvindo na porta " + porta);
            while (true) {
                Socket s = ss.accept();
                clientes.submit(() -> atender(s));
            }
        } catch (IOException e) {
            Log.info("CLIENTE", "servidor TCP parou: " + e.getMessage());
        }
    }

    private void atender(Socket s) {
        String quem = s.getRemoteSocketAddress().toString();
        Log.info("CLIENTE", "conectado " + quem);
        try (s; DataInputStream in = new DataInputStream(new BufferedInputStream(s.getInputStream()));
             DataOutputStream out = new DataOutputStream(new BufferedOutputStream(s.getOutputStream()))) {
            while (true) {
                int n = in.readInt();
                if (n < 0 || n > TAMANHO_MAXIMO) {
                    Log.info("CLIENTE", quem + " enviou tamanho inválido (" + n + "); encerrando");
                    return;
                }
                byte[] corpo = new byte[n];
                in.readFully(corpo); // bloqueia até chegar a mensagem inteira, mesmo que venha em pedaços
                byte[] resposta = processar(Requisicao.parseFrom(corpo)).toByteArray();
                out.writeInt(resposta.length);
                out.write(resposta);
                out.flush();
            }
        } catch (EOFException e) {
            Log.info("CLIENTE", "desconectado " + quem);
        } catch (IOException e) {
            Log.info("CLIENTE", quem + ": " + e.getMessage());
        }
    }

    Resposta processar(Requisicao r) {
        try {
            return switch (r.getTipoCase()) {
                case LISTAR -> Resposta.newBuilder().setOk(true).setFontes(registro.listar()).build();
                case COMANDO -> Resposta.newBuilder().setOk(true).setEstado(controle.executar(r.getComando())).build();
                case CONSULTA -> Resposta.newBuilder().setOk(true).setResultado(consultar(r.getConsulta())).build();
                case HISTORICO -> Resposta.newBuilder().setOk(true).setSerie(historico(r.getHistorico())).build();
                case TIPO_NOT_SET -> erro("requisição vazia");
            };
        } catch (IllegalArgumentException | IllegalStateException e) {
            return erro(e.getMessage());
        } catch (Exception e) {
            Log.info("CLIENTE", "erro ao processar " + r.getTipoCase() + ": " + e);
            return erro("erro interno: " + e.getMessage());
        }
    }

    private ResultadoConsulta consultar(Consulta c) throws Exception {
        long agora = System.currentTimeMillis();
        int j = c.getJanelaMin();
        return switch (c.getTipo()) {
            case MEDIA_DESVIO -> {
                if (c.getFonteId().isEmpty() || c.getMedida().isEmpty()) {
                    throw new IllegalArgumentException("MEDIA_DESVIO exige fonte_id e medida");
                }
                yield repositorio.mediaDesvio(c.getFonteId(), c.getMedida(), j, agora);
            }
            case CONSUMO_WH -> repositorio.consumoWh(j, agora, this::lacunaMaxima);
            case TEMPO_LIGADO -> repositorio.tempoLigado(j, agora, this::lacunaMaxima);
            case PH_MIN_ALERTAS -> repositorio.phMinAlertas(j, agora);
            case MAIOR_VARIACAO -> repositorio.maiorVariacao(j, agora);
            case CONSULTA_DESCONHECIDA, UNRECOGNIZED -> throw new IllegalArgumentException("tipo de consulta inválido");
        };
    }

    private long lacunaMaxima(String fonte) {
        return 3 * registro.intervaloMs(fonte);
    }

    private br.ufc.sd.aquario.proto.SerieHistorica historico(PedidoHistorico p) throws Exception {
        if (p.getFonteId().isEmpty() || p.getMedida().isEmpty()) {
            throw new IllegalArgumentException("histórico exige fonte_id e medida");
        }
        return repositorio.historico(p.getFonteId(), p.getMedida(), p.getJanelaMin(), p.getMaxPontos(),
                System.currentTimeMillis());
    }

    private static Resposta erro(String msg) {
        return Resposta.newBuilder().setOk(false).setErro(msg).build();
    }
}
