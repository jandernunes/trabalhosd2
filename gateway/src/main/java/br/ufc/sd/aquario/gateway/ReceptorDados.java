package br.ufc.sd.aquario.gateway;

import br.ufc.sd.aquario.proto.Leitura;
import com.google.protobuf.InvalidProtocolBufferException;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.util.Arrays;
import java.util.function.Consumer;

/** Recebe as Leitura (UDP), atualiza o registro, persiste e repassa os eventos. */
final class ReceptorDados implements Runnable {
    private final DatagramSocket socket;
    private final RegistroFontes registro;
    private final Repositorio repositorio;
    private final Consumer<Leitura> aoEvento;

    ReceptorDados(int porta, RegistroFontes registro, Repositorio repositorio, Consumer<Leitura> aoEvento) throws IOException {
        this.socket = new DatagramSocket(porta);
        this.registro = registro;
        this.repositorio = repositorio;
        this.aoEvento = aoEvento;
    }

    @Override
    public void run() {
        byte[] buf = new byte[65535];
        while (true) {
            DatagramPacket p = new DatagramPacket(buf, buf.length);
            try {
                socket.receive(p);
                Leitura l = Leitura.parseFrom(Arrays.copyOf(p.getData(), p.getLength()));
                // horário de chegada no Gateway: as janelas das consultas não dependem do relógio das fontes
                repositorio.salvar(l, System.currentTimeMillis());
                if (registro.atualizarLeitura(l) == null) {
                    Log.info("DADOS", l.getFonteId() + " ainda não registrada (aguardando descoberta)");
                }
                if (l.getEvento()) {
                    Log.info("ALERTA", l.getFonteId() + " " + l.getMotivoEvento() + " " + Log.medidas(l.getMedidasList()));
                    aoEvento.accept(l);
                } else if (Log.mostrarDados) {
                    Log.info("DADOS", l.getFonteId() + " " + Log.medidas(l.getMedidasList()));
                }
            } catch (InvalidProtocolBufferException e) {
                Log.info("DADOS", "datagrama inválido de " + p.getAddress());
            } catch (Exception e) {
                Log.info("DADOS", "erro: " + e);
            }
        }
    }
}
