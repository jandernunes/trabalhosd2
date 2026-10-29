"use client";

import useSWR from "swr";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { buscar, hora, numero, type Ponto } from "@/lib/tipos";

export type Serie = {
  fonteId: string;
  medida: string;
  nome: string;
  cor: string;
  unidade?: string;
  eixo?: "esq" | "dir";
  degrau?: boolean; // liga/desliga desenhado em degraus
};

function useSerie(s: Serie, janelaMin: number) {
  const url = `/api/historico?fonte_id=${s.fonteId}&medida=${s.medida}&janela_min=${janelaMin}&max_pontos=300`;
  return useSWR<Ponto[]>(url, buscar, { refreshInterval: 3000 });
}

function horaCurta(ms: number) {
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Até 2 casas, sem zeros à direita: com 1 casa, ticks como 7.05 e 7.1 viravam rótulos repetidos.
function marca(v: number) {
  return String(Math.round(v * 100) / 100);
}

function Dica({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dica">
      <div className="dica-hora">{hora(Number(label))}</div>
      {payload.map((p) => (
        <div key={p.name} className="dica-linha">
          <i style={{ background: p.color }} />
          <span>{p.name}</span>
          <strong>{numero(Number(p.value))}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Grafico({ titulo, series, janelaMin = 30, dominioDir }: {
  titulo: string; series: Serie[]; janelaMin?: number; dominioDir?: [number, number];
}) {
  // Um hook por série: a lista de séries de cada gráfico é fixa, então a ordem dos hooks não muda.
  const dados = series.map((s) => useSerie(s, janelaMin).data ?? []);
  const direita = series.find((s) => s.eixo === "dir");
  const ultimo = dados[0][dados[0].length - 1];

  return (
    <div className="painel grafico">
      <div className="painel-cabecalho">
        <div>
          <h3>{titulo}</h3>
          <div className="legenda">
            {series.map((s) => <span key={s.nome}><i style={{ background: s.cor }} />{s.nome}</span>)}
          </div>
        </div>
        {ultimo && series[0].unidade !== undefined && (
          <div className="grafico-atual">{numero(ultimo.valor)}<span>{series[0].unidade}</span></div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={horaCurta} tickLine={false}
            axisLine={false} fontSize={11} minTickGap={48} allowDuplicatedCategory={false} />
          <YAxis yAxisId="esq" tickLine={false} axisLine={false} fontSize={11} width={44} domain={["auto", "auto"]}
            tickFormatter={marca} />
          {direita && (
            <YAxis yAxisId="dir" orientation="right" tickLine={false} axisLine={false} fontSize={11} width={36}
              domain={dominioDir ?? ["auto", "auto"]} ticks={direita.degrau ? dominioDir : undefined}
              tickFormatter={direita.degrau ? (v) => (Number(v) ? "On" : "Off") : marca} />
          )}
          <Tooltip content={<Dica />} isAnimationActive={false} />
          {series.map((s, i) => (
            <Line key={s.nome} data={dados[i].map((p) => ({ t: p.timestampMs, [s.nome]: p.valor }))} dataKey={s.nome}
              name={s.nome} stroke={s.cor} dot={false} activeDot={{ r: 4 }} strokeWidth={2} yAxisId={s.eixo ?? "esq"}
              type={s.degrau ? "stepAfter" : "monotone"} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
