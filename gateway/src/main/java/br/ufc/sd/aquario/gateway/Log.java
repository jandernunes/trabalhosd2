package br.ufc.sd.aquario.gateway;

import br.ufc.sd.aquario.proto.Medida;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

final class Log {
    static volatile boolean mostrarDados = true;
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm:ss");

    private Log() {
    }

    static synchronized void info(String tag, String msg) {
        System.out.printf("%s [%s] %s%n", LocalTime.now().format(HORA), tag, msg);
    }

    static String medidas(List<Medida> medidas) {
        return medidas.stream()
                .map(m -> String.format(Locale.ROOT, "%s=%s%s", m.getNome(), numero(m.getValor()), m.getUnidade()))
                .collect(Collectors.joining(" "));
    }

    static String numero(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.format(Locale.ROOT, "%.2f", v);
    }
}
