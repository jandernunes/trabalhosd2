"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import AlternarTema from "@/components/AlternarTema";
import CartaoFonte from "@/components/CartaoFonte";
import Grafico from "@/components/Grafico";
import Icone from "@/components/Icone";
import PainelConsultas from "@/components/PainelConsultas";
import { buscar, hora, NOMES, numero, rotulo, unidade, type InfoFonte, type Leitura } from "@/lib/tipos";

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
  const ultimaLeitura = fontes?.length ? Math.max(...fontes.map((f) => f.vistoEmMs)) : 0;
  const conexao = error ? { classe: "perigo", texto: "Gateway indisponível" }
    : fontes ? { classe: "ok", texto: "Gateway conectado" }
    : { classe: "neutro", texto: "Conectando…" };

  return (
    <>
      <header className="topo">
        <div className="topo-conteudo">
          <div className="marca">
            <span className="marca-icone"><Icone nome="folha" tamanho={20} /></span>
            <div>
              <div className="marca-nome">Aquário Plantado Inteligente</div>
              <div className="marca-sub">Monitoramento e controle em tempo real</div>
            </div>
          </div>
          <div className="topo-acoes">
            <span className={`status ${conexao.classe}`}><i />{conexao.texto}</span>
            {fontes && <span className="topo-info"><strong>{online}/{fontes.length}</strong> fontes online</span>}
            <AlternarTema />
          </div>
        </div>
      </header>

      <main>
        {error && (
          <div className="aviso">
            <Icone nome="alerta" />
            <div><strong>{error.message}.</strong> Tentando novamente…</div>
          </div>
        )}

        <section className="secao">
          <div className="secao-cabecalho">
            <h2>Dispositivos e sensores</h2>
            {ultimaLeitura > 0 && <span className="secao-meta">Última leitura às {hora(ultimaLeitura)}</span>}
          </div>
          {fontes && fontes.length === 0 ? (
            <div className="painel vazio">
              <Icone nome="atividade" tamanho={22} />
              <div>
                <strong>Nenhuma fonte descoberta ainda</strong>
                <p>O Gateway envia o pedido de descoberta a cada 30 s.</p>
              </div>
            </div>
          ) : (
            <div className="grade">
              {fontes
                ? fontes.map((f) => <CartaoFonte key={f.fonteId} fonte={f} aoMudar={() => mutate()} />)
                : Array.from({ length: 5 }, (_, i) => <div key={i} className="cartao esqueleto" aria-hidden="true" />)}
            </div>
          )}
        </section>

        <section className="secao">
          <div className="secao-cabecalho">
            <h2>Telemetria</h2>
            <span className="secao-meta">Últimos 30 minutos</span>
          </div>
          <div className="graficos">
            <Grafico titulo="pH × CO₂" dominioDir={[0, 1]} series={[
              { fonteId: "sensor-ph", medida: "ph", nome: "pH", cor: "#3b82f6", unidade: "pH" },
              { fonteId: "tomada-co2", medida: "ligada", nome: "CO₂ ligado", cor: "#f59e0b", eixo: "dir", degrau: true },
            ]} />
            <Grafico titulo="Temperatura" series={[
              { fonteId: "sensor-temperatura", medida: "temperatura", nome: "Temperatura", cor: "#ef4444", unidade: "°C" },
            ]} />
            <Grafico titulo="Potência das tomadas" series={[
              { fonteId: "tomada-co2", medida: "potencia", nome: "CO₂", cor: "#f59e0b", unidade: "W" },
              { fonteId: "tomada-luminaria", medida: "potencia", nome: "Luminária secundária", cor: "#10b981" },
            ]} />
            <Grafico titulo="Intensidade da luminária" series={[
              { fonteId: "luminaria-smartled", medida: "intensidade", nome: "Intensidade", cor: "#8b5cf6", unidade: "%" },
            ]} />
          </div>
        </section>

        <section className="secao">
          <div className="secao-cabecalho">
            <h2>Análises</h2>
          </div>
          <div className="inferior">
            <PainelConsultas />
            <div className="painel">
              <div className="painel-cabecalho">
                <div className="painel-titulo"><Icone nome="sino" tamanho={16} /><h3>Alertas</h3></div>
                {alertas.length > 0 && <span className="contador">{alertas.length}</span>}
              </div>
              {alertas.length === 0 ? (
                <div className="vazio-texto">Nenhum alerta desde que a página foi aberta.</div>
              ) : (
                <ul className="alertas">
                  {alertas.map((a) => (
                    <li key={`${a.fonteId}-${a.timestampMs}`}>
                      <span className="alerta-icone"><Icone nome="alerta" tamanho={15} /></span>
                      <div className="alerta-corpo">
                        <div className="alerta-titulo">
                          {NOMES[a.fonteId] ?? a.fonteId}
                          {a.motivoEvento && <span className="alerta-motivo">{a.motivoEvento}</span>}
                        </div>
                        <div className="alerta-detalhe">
                          {a.medidas.filter((m) => m.nome !== "ligada")
                            .map((m) => `${rotulo(m.nome)} ${numero(m.valor)} ${unidade(m.unidade)}`.trim()).join(" · ")}
                        </div>
                      </div>
                      <time>{hora(a.timestampMs)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="rodape">
        Sistemas Distribuídos · UFC — Navegador → Route Handlers (Next.js) → TCP + Protobuf → Gateway
      </footer>
    </>
  );
}
