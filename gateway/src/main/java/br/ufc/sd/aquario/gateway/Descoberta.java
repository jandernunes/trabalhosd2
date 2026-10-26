package br.ufc.sd.aquario.gateway;

import br.ufc.sd.aquario.proto.DiscoveryRequest;
import br.ufc.sd.aquario.proto.DiscoveryResponse;
import com.google.protobuf.InvalidProtocolBufferException;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.MulticastSocket;
import java.net.NetworkInterface;
import java.net.StandardSocketOptions;
import java.util.Arrays;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/** Envia DiscoveryRequest ao grupo multicast (ao iniciar e a cada 30 s) e registra os DiscoveryResponse. */
final class Descoberta {
    static final String GRUPO = "239.10.10.10";
    static final int PORTA_MULTICAST = 50000;
    static final int PORTA_RESPOSTA = 50001;
    static final int PERIODO_S = 30;

    private final String ipLocal;
    private final int portaDados;
    private final RegistroFontes registro;

    Descoberta(String ipLocal, int portaDados, RegistroFontes registro) {
        this.ipLocal = ipLocal;
        this.portaDados = portaDados;
        this.registro = registro;
    }

    void iniciar(ScheduledExecutorService agenda) throws IOException {
        InetAddress local = InetAddress.getByName(ipLocal);
        NetworkInterface nif = NetworkInterface.getByInetAddress(local);
        if (nif == null) {
            throw new IllegalArgumentException("--ip-local " + ipLocal + " não pertence a nenhuma interface desta máquina");
        }
        // Interface fixada: com VPN/WSL/Hyper-V o padrão do SO mandaria o multicast para a rede errada.
        MulticastSocket envio = new MulticastSocket(new InetSocketAddress(local, 0));
        envio.setNetworkInterface(nif);
        envio.setTimeToLive(1);
        envio.setOption(StandardSocketOptions.IP_MULTICAST_LOOP, true); // fontes no mesmo PC também recebem

        DatagramSocket respostas = new DatagramSocket(PORTA_RESPOSTA);
        Thread t = new Thread(() -> receber(respostas), "descoberta-respostas");
        t.setDaemon(true);
        t.start();

        byte[] pedido = DiscoveryRequest.newBuilder()
                .setGatewayIp(ipLocal).setPortaResposta(PORTA_RESPOSTA).setPortaDados(portaDados)
                .build().toByteArray();
        DatagramPacket pacote = new DatagramPacket(pedido, pedido.length, InetAddress.getByName(GRUPO), PORTA_MULTICAST);
        agenda.scheduleAtFixedRate(() -> {
            try {
                envio.send(pacote);
                Log.info("DESCOBERTA", "pedido enviado para " + GRUPO + ":" + PORTA_MULTICAST + " via " + nif.getName());
            } catch (IOException e) {
                Log.info("DESCOBERTA", "falha ao enviar: " + e.getMessage());
            }
        }, 0, PERIODO_S, TimeUnit.SECONDS);
    }

    private void receber(DatagramSocket s) {
        byte[] buf = new byte[65535];
        while (true) {
            DatagramPacket p = new DatagramPacket(buf, buf.length);
            try {
                s.receive(p);
                registro.registrar(DiscoveryResponse.parseFrom(Arrays.copyOf(p.getData(), p.getLength())));
            } catch (InvalidProtocolBufferException e) {
                Log.info("DESCOBERTA", "resposta inválida de " + p.getAddress());
            } catch (IOException e) {
                Log.info("DESCOBERTA", "erro ao receber: " + e.getMessage());
            }
        }
    }
}
