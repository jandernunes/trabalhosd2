package br.ufc.sd.aquario.gateway;

import br.ufc.sd.aquario.proto.Leitura;
import br.ufc.sd.aquario.proto.LinhaResultado;
import br.ufc.sd.aquario.proto.Medida;
import br.ufc.sd.aquario.proto.Ponto;
import br.ufc.sd.aquario.proto.ResultadoConsulta;
import br.ufc.sd.aquario.proto.SerieHistorica;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.function.ToLongFunction;

/** Persistência em SQLite e as consultas agregadas. Cada Medida de uma Leitura vira uma linha. */
final class Repositorio implements AutoCloseable {

    record Amostra(long ts, double valor) {
    }

    private final Connection con;
    private final PreparedStatement insert;

    Repositorio(String url) throws SQLException {
        con = DriverManager.getConnection(url);
        try (Statement st = con.createStatement()) {
            st.execute("CREATE TABLE IF NOT EXISTS leitura (fonte_id TEXT, tipo INTEGER, ts_ms INTEGER, medida TEXT,"
                    + " valor REAL, unidade TEXT, evento INTEGER, motivo TEXT)");
            st.execute("CREATE INDEX IF NOT EXISTS ix_leitura ON leitura(fonte_id, medida, ts_ms)");
        }
        insert = con.prepareStatement("INSERT INTO leitura VALUES (?,?,?,?,?,?,?,?)");
    }

    synchronized void salvar(Leitura l, long tsMs) throws SQLException {
        for (Medida m : l.getMedidasList()) {
            insert.setString(1, l.getFonteId());
            insert.setInt(2, l.getTipoValue());
            insert.setLong(3, tsMs);
            insert.setString(4, m.getNome());
            insert.setDouble(5, m.getValor());
            insert.setString(6, m.getUnidade());
            insert.setInt(7, l.getEvento() ? 1 : 0);
            insert.setString(8, l.getMotivoEvento());
            insert.addBatch();
        }
        insert.executeBatch();
    }

    synchronized List<Amostra> serie(String fonte, String medida, long desde) throws SQLException {
        try (PreparedStatement ps = con.prepareStatement(
                "SELECT ts_ms, valor FROM leitura WHERE fonte_id=? AND medida=? AND ts_ms>=? ORDER BY ts_ms")) {
            ps.setString(1, fonte);
            ps.setString(2, medida);
            ps.setLong(3, desde);
            List<Amostra> r = new ArrayList<>();
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    r.add(new Amostra(rs.getLong(1), rs.getDouble(2)));
                }
            }
            return r;
        }
    }

    private synchronized List<String> fontesCom(String medida, long desde) throws SQLException {
        try (PreparedStatement ps = con.prepareStatement(
                "SELECT DISTINCT fonte_id FROM leitura WHERE medida=? AND ts_ms>=? ORDER BY fonte_id")) {
            ps.setString(1, medida);
            ps.setLong(2, desde);
            List<String> r = new ArrayList<>();
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    r.add(rs.getString(1));
                }
            }
            return r;
        }
    }

    private synchronized String unidade(String fonte, String medida) throws SQLException {
        try (PreparedStatement ps = con.prepareStatement(
                "SELECT unidade FROM leitura WHERE fonte_id=? AND medida=? LIMIT 1")) {
            ps.setString(1, fonte);
            ps.setString(2, medida);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString(1) : "";
            }
        }
    }

    // ---- consultas ------------------------------------------------------------------------------

    static long desde(long agora, int janelaMin) {
        return agora - (janelaMin > 0 ? janelaMin : 60) * 60_000L;
    }

    ResultadoConsulta mediaDesvio(String fonte, String medida, int janelaMin, long agora) throws SQLException {
        List<Amostra> s = serie(fonte, medida, desde(agora, janelaMin));
        ResultadoConsulta.Builder r = ResultadoConsulta.newBuilder();
        if (s.isEmpty()) {
            return r.setDescricao("Sem leituras de " + fonte + "/" + medida + " nos últimos " + janela(janelaMin)).build();
        }
        double media = s.stream().mapToDouble(Amostra::valor).average().orElse(0);
        double var = s.stream().mapToDouble(a -> (a.valor() - media) * (a.valor() - media)).average().orElse(0);
        String u = unidade(fonte, medida);
        return r.setDescricao(String.format(Locale.ROOT, "%s/%s nos últimos %s", fonte, medida, janela(janelaMin)))
                .addLinhas(linha("media", media, u))
                .addLinhas(linha("desvio_padrao", Math.sqrt(var), u))
                .addLinhas(linha("minimo", s.stream().mapToDouble(Amostra::valor).min().orElse(0), u))
                .addLinhas(linha("maximo", s.stream().mapToDouble(Amostra::valor).max().orElse(0), u))
                .addLinhas(linha("amostras", s.size(), ""))
                .build();
    }

    /** Energia em Wh: trapézio entre leituras consecutivas; lacunas maiores que maxLacunaMs (fonte offline) são ignoradas. */
    static double integrarWh(List<Amostra> s, long maxLacunaMs) {
        double wh = 0;
        for (int i = 1; i < s.size(); i++) {
            long dt = s.get(i).ts() - s.get(i - 1).ts();
            if (dt <= maxLacunaMs) {
                wh += (s.get(i).valor() + s.get(i - 1).valor()) / 2 * dt / 3_600_000.0;
            }
        }
        return wh;
    }

    static double horasLigada(List<Amostra> s, long maxLacunaMs) {
        double h = 0;
        for (int i = 1; i < s.size(); i++) {
            long dt = s.get(i).ts() - s.get(i - 1).ts();
            if (dt <= maxLacunaMs && s.get(i - 1).valor() >= 0.5) {
                h += dt / 3_600_000.0;
            }
        }
        return h;
    }

    ResultadoConsulta consumoWh(int janelaMin, long agora, ToLongFunction<String> maxLacunaMs) throws SQLException {
        long d = desde(agora, janelaMin);
        ResultadoConsulta.Builder r = ResultadoConsulta.newBuilder()
                .setDescricao("Consumo de energia por tomada nos últimos " + janela(janelaMin));
        double total = 0;
        for (String f : fontesCom("potencia", d)) {
            double wh = integrarWh(serie(f, "potencia", d), maxLacunaMs.applyAsLong(f));
            total += wh;
            r.addLinhas(linha(f, wh, "Wh"));
        }
        return r.addLinhas(linha("total", total, "Wh")).build();
    }

    ResultadoConsulta tempoLigado(int janelaMin, long agora, ToLongFunction<String> maxLacunaMs) throws SQLException {
        long d = desde(agora, janelaMin);
        ResultadoConsulta.Builder r = ResultadoConsulta.newBuilder()
                .setDescricao("Tempo ligado por fonte controlável nos últimos " + janela(janelaMin));
        for (String f : fontesCom("ligada", d)) {
            r.addLinhas(linha(f, horasLigada(serie(f, "ligada", d), maxLacunaMs.applyAsLong(f)), "h"));
        }
        return r.build();
    }

    synchronized ResultadoConsulta phMinAlertas(int janelaMin, long agora) throws SQLException {
        try (PreparedStatement ps = con.prepareStatement("SELECT MIN(valor), SUM(evento), COUNT(*) FROM leitura"
                + " WHERE fonte_id='sensor-ph' AND medida='ph' AND ts_ms>=?")) {
            ps.setLong(1, desde(agora, janelaMin));
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                ResultadoConsulta.Builder r = ResultadoConsulta.newBuilder()
                        .setDescricao("pH nos últimos " + janela(janelaMin) + " (alerta abaixo de 6,4)");
                if (rs.getInt(3) == 0) {
                    return r.setDescricao("Sem leituras de pH nos últimos " + janela(janelaMin)).build();
                }
                return r.addLinhas(linha("ph_minimo", rs.getDouble(1), "pH"))
                        .addLinhas(linha("alertas", rs.getInt(2), ""))
                        .addLinhas(linha("amostras", rs.getInt(3), ""))
                        .build();
            }
        }
    }

    /** Coeficiente de variação (desvio/média) por fonte e medida; devolve as 5 maiores, a primeira é a resposta. */
    synchronized ResultadoConsulta maiorVariacao(int janelaMin, long agora) throws SQLException {
        record Cv(String chave, double cv) {
        }
        List<Cv> cvs = new ArrayList<>();
        try (PreparedStatement ps = con.prepareStatement("SELECT fonte_id, medida, AVG(valor), AVG(valor*valor), COUNT(*)"
                + " FROM leitura WHERE ts_ms>=? AND medida<>'ligada' GROUP BY fonte_id, medida HAVING COUNT(*)>=2")) {
            ps.setLong(1, desde(agora, janelaMin));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    double m = rs.getDouble(3);
                    if (Math.abs(m) < 1e-9) {
                        continue;
                    }
                    double desvio = Math.sqrt(Math.max(0, rs.getDouble(4) - m * m));
                    cvs.add(new Cv(rs.getString(1) + "/" + rs.getString(2), desvio / Math.abs(m) * 100));
                }
            }
        }
        cvs.sort(Comparator.comparingDouble(Cv::cv).reversed());
        ResultadoConsulta.Builder r = ResultadoConsulta.newBuilder();
        if (cvs.isEmpty()) {
            return r.setDescricao("Sem dados suficientes nos últimos " + janela(janelaMin)).build();
        }
        r.setDescricao(String.format(Locale.ROOT, "Maior variação nos últimos %s: %s (coeficiente de variação %.1f%%)",
                janela(janelaMin), cvs.get(0).chave(), cvs.get(0).cv()));
        cvs.stream().limit(5).forEach(c -> r.addLinhas(linha(c.chave(), c.cv(), "%")));
        return r.build();
    }

    SerieHistorica historico(String fonte, String medida, int janelaMin, int maxPontos, long agora) throws SQLException {
        List<Amostra> s = serie(fonte, medida, desde(agora, janelaMin));
        SerieHistorica.Builder b = SerieHistorica.newBuilder().setFonteId(fonte).setMedida(medida);
        int n = s.size();
        int k = maxPontos > 0 && n > maxPontos ? maxPontos : n;
        for (int i = 0; i < k; i++) {  // amostragem uniforme, sempre incluindo o último ponto
            Amostra a = s.get(k == n ? i : (int) Math.round((double) i * (n - 1) / (k - 1)));
            b.addPontos(Ponto.newBuilder().setTimestampMs(a.ts()).setValor(a.valor()));
        }
        return b.build();
    }

    private static LinhaResultado linha(String chave, double valor, String unidade) {
        return LinhaResultado.newBuilder().setChave(chave).setValor(valor).setUnidade(unidade).build();
    }

    private static String janela(int janelaMin) {
        int m = janelaMin > 0 ? janelaMin : 60;
        return m % 60 == 0 ? (m / 60) + " h" : m + " min";
    }

    @Override
    public synchronized void close() throws SQLException {
        con.close();
    }
}
