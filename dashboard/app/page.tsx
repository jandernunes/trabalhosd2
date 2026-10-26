"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import CartaoFonte from "@/components/CartaoFonte";
import Grafico from "@/components/Grafico";
import PainelConsultas from "@/components/PainelConsultas";
import { buscar, hora, NOMES, numero, type InfoFonte, type Leitura } from "@/lib/tipos";

export default function Painel() {
  const { data: fontes, error, mutate } = useSWR<InfoFonte[]>("/api/fontes", buscar, { refreshInterval: 2000 });
  const [alertas, setAlertas] = useState<Leitura[]>([]);
  const vistos = useRef(new Set<string>());

  // O proto não tem lista de eventos: a página coleta as leituras com evento=true enquanto está aberta.
  useEffect(() => {
    for (const f of fontes ?? []) {
      const l = f.ultimaLeitura;
      const chave = `${l?.fonteId}-${l?.timestampMs}`;
      if (l?.evento && !vistos.current.has(chave)) {
        vistos.current.add(chave);
        setAlertas((a) => [l, ...a].slice(0, 50));
      }
    }
  }, [fontes]);

  const online = fontes?.filter((f) => f.online).length ?? 0;

  return (
    <main>
      <header>
        <div>
          <h1>Aquário Plantado Inteligente</h1>
          <div className="sub">Dashboard → Route Handlers (Next) → TCP + Protobuf → Gateway</div>
        </div>
        <div className="sub">{fontes ? `${online}/${fontes.length} fontes online` : "conectando..."}</div>
      </header>

      {error && <div className="aviso">{error.message}. Tentando novamente…</div>}
      {fontes && fontes.length === 0 && <div className="aviso">Nenhuma fonte descoberta ainda (o Gateway pergunta a cada 30 s).</div>}

      <section className="grade">
        {fontes?.map((f) => <CartaoFonte key={f.fonteId} fonte={f} aoMudar={() => mutate()} />)}
      </section>

      <section className="graficos">
        <Grafico titulo="pH × CO2" dominioDir={[0, 1]} series={[
          { fonteId: "sensor-ph", medida: "ph", nome: "pH", cor: "#4aa3df" },
          { fonteId: "tomada-co2", medida: "ligada", nome: "CO2 ligado", cor: "#e3b341", eixo: "dir", degrau: true },
        ]} />
        <Grafico titulo="Temperatura (°C)" series={[
          { fonteId: "sensor-temperatura", medida: "temperatura", nome: "Temperatura", cor: "#e5534b" },
        ]} />
        <Grafico titulo="Potência das tomadas (W)" series={[
          { fonteId: "tomada-co2", medida: "potencia", nome: "CO2", cor: "#e3b341" },
          { fonteId: "tomada-luminaria", medida: "potencia", nome: "Luminária secundária", cor: "#3fb68b" },
        ]} />
        <Grafico titulo="Intensidade da luminária (%)" series={[
          { fonteId: "luminaria-smartled", medida: "intensidade", nome: "Intensidade", cor: "#c792ea" },
        ]} />
      </section>

      <section className="inferior">
        <PainelConsultas />
        <div className="painel">
          <h2>Alertas (eventos imediatos)</h2>
          {alertas.length === 0 ? <div className="sub">Nenhum alerta desde que a página foi aberta.</div> : (
            <ul className="alertas">
              {alertas.map((a) => (
                <li key={`${a.fonteId}-${a.timestampMs}`}>
                  {hora(a.timestampMs)} · {NOMES[a.fonteId] ?? a.fonteId} · <span className="motivo">{a.motivoEvento}</span>{" "}
                  {a.medidas.filter((m) => m.nome !== "ligada").map((m) => `${m.nome}=${numero(m.valor)}${m.unidade}`).join(" ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
