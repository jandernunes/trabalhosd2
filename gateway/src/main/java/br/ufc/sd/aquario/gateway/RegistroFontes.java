package br.ufc.sd.aquario.gateway;

import br.ufc.sd.aquario.proto.DiscoveryResponse;
import br.ufc.sd.aquario.proto.InfoFonte;
import br.ufc.sd.aquario.proto.Leitura;
import br.ufc.sd.aquario.proto.ListaFontes;
import br.ufc.sd.aquario.proto.Medida;
import br.ufc.sd.aquario.proto.Status;

import java.util.Comparator;
import java.util.concurrent.ConcurrentHashMap;

/** Fontes conhecidas pelo Gateway: endereço, estado, última leitura e se estão online. */
final class RegistroFontes {

    static final class Entrada {
        volatile DiscoveryResponse info;
        volatile Status estado;
        volatile Leitura ultima;
        volatile long vistoEm;   // última leitura recebida (a descoberta não conta: uma fonte em falha ainda responde a ela)
        volatile boolean online = true;
    }

    private final ConcurrentHashMap<String, Entrada> fontes = new ConcurrentHashMap<>();

    void registrar(DiscoveryResponse r) {
        boolean[] nova = {false};
        Entrada e = fontes.computeIfAbsent(r.getFonteId(), id -> {
            nova[0] = true;
            Entrada x = new Entrada();
            x.vistoEm = System.currentTimeMillis();
            return x;
        });
        boolean mudouEndereco = e.info != null
                && (!e.info.getIp().equals(r.getIp()) || e.info.getPortaGrpc() != r.getPortaGrpc());
        e.info = r;
        e.estado = r.getEstado();
        if (nova[0] || mudouEndereco) {
            String grpc = r.getControlavel() ? r.getIp() + ":" + r.getPortaGrpc() : r.getIp() + " (sem gRPC)";
            Log.info("FONTE", r.getFonteId() + " (" + r.getTipo() + ") " + grpc + " registrada");
        }
    }

    Entrada atualizarLeitura(Leitura l) {
        Entrada e = fontes.get(l.getFonteId());
        if (e == null) {
            return null;
        }
        e.ultima = l;
        e.vistoEm = System.currentTimeMillis();
        // mantém o estado coerente com a leitura (ex.: tomada ligada pelo timer do app)
        Status.Builder s = e.estado.toBuilder();
        for (Medida m : l.getMedidasList()) {
            if (m.getNome().equals("ligada")) {
                s.setLigada(m.getValor() >= 0.5);
            } else if (s.containsParametros(m.getNome())) {
                s.putParametros(m.getNome(), m.getValor());
            }
        }
        e.estado = s.build();
        if (!e.online) {
            e.online = true;
            Log.info("FONTE", l.getFonteId() + " ONLINE novamente");
        }
        return e;
    }

    void atualizarEstado(String id, Status s) {
        Entrada e = fontes.get(id);
        if (e != null) {
            e.estado = s;
        }
    }

    long intervaloMs(String id) {
        Entrada e = fontes.get(id);
        int s = e == null ? 0 : e.estado.getIntervaloEnvioS();
        return (s > 0 ? s : 10) * 1000L;
    }

    void verificarOffline() {
        long agora = System.currentTimeMillis();
        fontes.forEach((id, e) -> {
            long limite = Math.max(5000, 3 * intervaloMs(id));
            if (e.online && agora - e.vistoEm > limite) {
                e.online = false;
                Log.info("FONTE", id + " OFFLINE (sem leituras há " + (agora - e.vistoEm) / 1000 + " s)");
            }
        });
    }

    Entrada obter(String id) {
        return fontes.get(id);
    }

    ListaFontes listar() {
        ListaFontes.Builder b = ListaFontes.newBuilder();
        fontes.entrySet().stream().sorted(Comparator.comparing(java.util.Map.Entry::getKey)).forEach(x -> {
            Entrada e = x.getValue();
            InfoFonte.Builder i = InfoFonte.newBuilder()
                    .setFonteId(x.getKey()).setTipo(e.info.getTipo()).setIp(e.info.getIp())
                    .setPortaGrpc(e.info.getPortaGrpc()).setControlavel(e.info.getControlavel())
                    .setOnline(e.online).setEstado(e.estado).setVistoEmMs(e.vistoEm);
            if (e.ultima != null) {
                i.setUltimaLeitura(e.ultima);
            }
            b.addFontes(i);
        });
        return b.build();
    }
}
