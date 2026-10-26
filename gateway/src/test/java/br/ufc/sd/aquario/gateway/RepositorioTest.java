package br.ufc.sd.aquario.gateway;

import br.ufc.sd.aquario.proto.Leitura;
import br.ufc.sd.aquario.proto.LinhaResultado;
import br.ufc.sd.aquario.proto.ResultadoConsulta;
import br.ufc.sd.aquario.proto.TipoFonte;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RepositorioTest {
    static final long H = 3_600_000L;
    static final long AGORA = 100 * H;

    Repositorio repo;

    @BeforeEach
    void abrir() throws Exception {
        repo = new Repositorio("jdbc:sqlite::memory:");
    }

    @AfterEach
    void fechar() throws Exception {
        repo.close();
    }

    void salvar(String fonte, String medida, double valor, long ts, boolean evento) throws Exception {
        Leitura l = Leitura.newBuilder().setFonteId(fonte).setTipo(TipoFonte.SENSOR_PH).setEvento(evento)
                .addMedidas(br.ufc.sd.aquario.proto.Medida.newBuilder().setNome(medida).setValor(valor).setUnidade("u"))
                .build();
        repo.salvar(l, ts);
    }

    static double valor(ResultadoConsulta r, String chave) {
        return r.getLinhasList().stream().filter(x -> x.getChave().equals(chave)).mapToDouble(LinhaResultado::getValor)
                .findFirst().orElseThrow();
    }

    @Test
    void consumoDeDezWattsPorUmaHoraSaoDezWh() throws Exception {
        salvar("tomada-co2", "potencia", 10, AGORA - H, false);
        salvar("tomada-co2", "potencia", 10, AGORA, false);
        ResultadoConsulta r = repo.consumoWh(120, AGORA, f -> 2 * H);
        assertEquals(10.0, valor(r, "tomada-co2"), 1e-9);
        assertEquals(10.0, valor(r, "total"), 1e-9);
    }

    @Test
    void lacunaMaiorQueOLimiteNaoContaComoLigada() {
        List<Repositorio.Amostra> s = List.of(new Repositorio.Amostra(0, 1), new Repositorio.Amostra(10_000, 1),
                new Repositorio.Amostra(10_000 + H, 1)); // 1 h sem leituras: fonte offline
        assertEquals(10_000 / (double) H, Repositorio.horasLigada(s, 30_000), 1e-12);
        assertEquals(0, Repositorio.integrarWh(s, 5_000), 1e-12);
    }

    @Test
    void mediaEDesvioPopulacional() throws Exception {
        salvar("sensor-temperatura", "temperatura", 24, AGORA - 3000, false);
        salvar("sensor-temperatura", "temperatura", 26, AGORA - 2000, false);
        salvar("sensor-temperatura", "temperatura", 28, AGORA - 1000, false);
        salvar("sensor-temperatura", "temperatura", 99, AGORA - 2 * H, false); // fora da janela de 60 min
        ResultadoConsulta r = repo.mediaDesvio("sensor-temperatura", "temperatura", 60, AGORA);
        assertEquals(26, valor(r, "media"), 1e-9);
        assertEquals(Math.sqrt(8.0 / 3), valor(r, "desvio_padrao"), 1e-9);
        assertEquals(3, valor(r, "amostras"));
    }

    @Test
    void phMinimoEAlertas() throws Exception {
        salvar("sensor-ph", "ph", 7.0, AGORA - 3000, false);
        salvar("sensor-ph", "ph", 6.3, AGORA - 2000, true);
        salvar("sensor-ph", "ph", 6.35, AGORA - 1000, true);
        ResultadoConsulta r = repo.phMinAlertas(60, AGORA);
        assertEquals(6.3, valor(r, "ph_minimo"), 1e-9);
        assertEquals(2, valor(r, "alertas"));
    }

    @Test
    void maiorVariacaoIgnoraLigadaEOrdenaPorCv() throws Exception {
        salvar("sensor-ph", "ph", 7.0, AGORA - 2000, false);
        salvar("sensor-ph", "ph", 7.0, AGORA - 1000, false);
        salvar("tomada-co2", "potencia", 0, AGORA - 2000, false);
        salvar("tomada-co2", "potencia", 8, AGORA - 1000, false);
        salvar("tomada-co2", "ligada", 0, AGORA - 2000, false);
        salvar("tomada-co2", "ligada", 1, AGORA - 1000, false);
        ResultadoConsulta r = repo.maiorVariacao(60, AGORA);
        assertEquals("tomada-co2/potencia", r.getLinhas(0).getChave());
        assertTrue(r.getLinhasList().stream().noneMatch(l -> l.getChave().endsWith("/ligada")));
    }

    @Test
    void historicoAmostradoMantemPrimeiroEUltimo() throws Exception {
        for (int i = 0; i < 100; i++) {
            salvar("sensor-ph", "ph", i, AGORA - 100_000 + i * 1000L, false);
        }
        var serie = repo.historico("sensor-ph", "ph", 60, 10, AGORA);
        assertEquals(10, serie.getPontosCount());
        assertEquals(0, serie.getPontos(0).getValor());
        assertEquals(99, serie.getPontos(9).getValor());
    }
}
