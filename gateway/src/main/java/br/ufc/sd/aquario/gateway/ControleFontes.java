package br.ufc.sd.aquario.gateway;

import br.ufc.sd.aquario.proto.Comando;
import br.ufc.sd.aquario.proto.FonteControlavelGrpc;
import br.ufc.sd.aquario.proto.Status;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/** Cliente gRPC das fontes controláveis: traduz o Comando do cliente para o RPC correspondente. */
final class ControleFontes {
    private final RegistroFontes registro;
    private final Map<String, ManagedChannel> canais = new ConcurrentHashMap<>(); // chave: ip:porta

    ControleFontes(RegistroFontes registro) {
        this.registro = registro;
    }

    Status executar(Comando c) {
        RegistroFontes.Entrada e = registro.obter(c.getFonteId());
        if (e == null) {
            throw new IllegalArgumentException("fonte desconhecida: " + c.getFonteId());
        }
        if (!e.info.getControlavel()) {
            throw new IllegalArgumentException("fonte não controlável: " + c.getFonteId());
        }
        String endereco = e.info.getIp() + ":" + e.info.getPortaGrpc();
        ManagedChannel canal = canais.computeIfAbsent(endereco,
                k -> ManagedChannelBuilder.forTarget(k).usePlaintext().build());
        var stub = FonteControlavelGrpc.newBlockingStub(canal).withDeadlineAfter(3, TimeUnit.SECONDS);
        try {
            Status s = switch (c.getAcaoCase()) {
                case POWER -> stub.setPower(c.getPower());
                case PARAMETRO -> stub.setParametro(c.getParametro());
                case FALHA -> stub.simularFalha(c.getFalha());
                case ACAO_NOT_SET -> throw new IllegalArgumentException("comando sem ação");
            };
            registro.atualizarEstado(c.getFonteId(), s);
            Log.info("COMANDO", c.getFonteId() + " " + descrever(c) + " -> ok");
            return s;
        } catch (StatusRuntimeException ex) {
            String motivo = switch (ex.getStatus().getCode()) {
                case UNAVAILABLE, DEADLINE_EXCEEDED -> "fonte inacessível (" + ex.getStatus().getCode() + ")";
                default -> String.valueOf(ex.getStatus().getDescription());
            };
            Log.info("COMANDO", c.getFonteId() + " " + descrever(c) + " -> falhou: " + motivo);
            throw new IllegalStateException(motivo);
        }
    }

    static String descrever(Comando c) {
        return switch (c.getAcaoCase()) {
            case POWER -> c.getPower().getLigada() ? "ligar" : "desligar";
            case PARAMETRO -> c.getParametro().getNome() + "=" + Log.numero(c.getParametro().getValor());
            case FALHA -> "simular falha " + (c.getFalha().getAtiva() ? "on" : "off");
            case ACAO_NOT_SET -> "?";
        };
    }
}
