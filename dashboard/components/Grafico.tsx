"use client";

import useSWR from "swr";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buscar, hora, numero, type Ponto } from "@/lib/tipos";

export type Serie = {
  fonteId: string;
  medida: string;
  nome: string;
  cor: string;
  eixo?: "esq" | "dir";
  degrau?: boolean; // liga/desliga desenhado em degraus
};

function useSerie(s: Serie, janelaMin: number) {
  const url = `/api/historico?fonte_id=${s.fonteId}&medida=${s.medida}&janela_min=${janelaMin}&max_pontos=300`;
  return useSWR<Ponto[]>(url, buscar, { refreshInterval: 3000 });
}

function Linha({ s, janelaMin }: { s: Serie; janelaMin: number }) {
  const { data } = useSerie(s, janelaMin);
  return (
    <Line data={(data ?? []).map((p) => ({ t: p.timestampMs, [s.nome]: p.valor }))} dataKey={s.nome} name={s.nome}
      stroke={s.cor} dot={false} strokeWidth={2} yAxisId={s.eixo ?? "esq"} type={s.degrau ? "stepAfter" : "monotone"}
      isAnimationActive={false} />
  );
}

export default function Grafico({ titulo, series, janelaMin = 30, dominioDir }: {
  titulo: string; series: Serie[]; janelaMin?: number; dominioDir?: [number, number];
}) {
  const temDireita = series.some((s) => s.eixo === "dir");
  return (
    <div className="painel">
      <h2>{titulo}</h2>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#24404a" strokeDasharray="3 3" />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={hora} stroke="#8fa9b0"
            fontSize={11} allowDuplicatedCategory={false} />
          <YAxis yAxisId="esq" stroke="#8fa9b0" fontSize={11} domain={["auto", "auto"]} />
          {temDireita && <YAxis yAxisId="dir" orientation="right" stroke="#8fa9b0" fontSize={11} domain={dominioDir ?? ["auto", "auto"]} />}
          <Tooltip labelFormatter={(t) => hora(Number(t))} formatter={(v) => numero(Number(v))}
            contentStyle={{ background: "#15262d", border: "1px solid #24404a" }} />
          <Legend />
          {series.map((s) => Linha({ s, janelaMin }))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
