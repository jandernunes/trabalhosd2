package br.ufc.sd.aquario.gateway;

import br.ufc.sd.aquario.proto.Comando;
import br.ufc.sd.aquario.proto.ComandoPower;
import br.ufc.sd.aquario.proto.Leitura;

import java.io.File;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public final class Main {
    static final int PORTA_DADOS = 50002;
    static final int PORTA_CLIENTES = 50010;

    private Main() {
    }

    public static void main(String[] args) throws Exception {
        String ipLocal = null;
        String db = "dados/aquario.db";
        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--ip-local" -> ipLocal = args[++i];
                case "--db" -> db = args[++i];
                case "--silencioso" -> Log.mostrarDados = false;
                default -> uso("argumento desconhecido: " + args[i]);
            }
        }
        if (ipLocal == null) {
            uso("--ip-local é obrigatório");
        }
        File arquivo = new File(db).getAbsoluteFile();
        arquivo.getParentFile().mkdirs();

        Repositorio repositorio = new Repositorio("jdbc:sqlite:" + arquivo);
        RegistroFontes registro = new RegistroFontes();
        ControleFontes controle = new ControleFontes(registro);
        ScheduledExecutorService agenda = Executors.newScheduledThreadPool(2);
        agenda.scheduleAtFixedRate(registro::verificarOffline, 5, 5, TimeUnit.SECONDS);

        ReceptorDados receptor = new ReceptorDados(PORTA_DADOS, registro, repositorio, l -> {
            if (l.getFonteId().equals("sensor-ph") && l.getMotivoEvento().contains("ph_baixo")) {
                agenda.execute(() -> desligarCo2(controle, l));
            }
        });
        new Thread(receptor, "dados").start();
        new Thread(new ServidorClientes(PORTA_CLIENTES, registro, controle, repositorio), "clientes").start();
        new Descoberta(ipLocal, PORTA_DADOS, registro).iniciar(agenda);

        Log.info("GATEWAY", "pronto em " + ipLocal + " | leituras UDP " + PORTA_DADOS + " | clientes TCP "
                + PORTA_CLIENTES + " | banco " + arquivo);
    }

    /** Regra de segurança: pH baixo = excesso de CO2, então o Gateway desliga a tomada do CO2. */
    private static void desligarCo2(ControleFontes controle, Leitura alerta) {
        try {
            controle.executar(Comando.newBuilder().setFonteId("tomada-co2")
                    .setPower(ComandoPower.newBuilder().setLigada(false)).build());
            Log.info("SEGURANCA", "pH baixo (" + Log.medidas(alerta.getMedidasList()) + "): tomada-co2 DESLIGADA automaticamente");
        } catch (RuntimeException e) {
            Log.info("SEGURANCA", "pH baixo, mas não foi possível desligar o CO2: " + e.getMessage());
        }
    }

    private static void uso(String erro) {
        System.err.println(erro);
        System.err.println("uso: java -jar gateway.jar --ip-local <ip da rede local> [--db dados/aquario.db] [--silencioso]");
        System.exit(2);
    }
}
