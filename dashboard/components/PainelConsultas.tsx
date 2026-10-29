"use client";

import { useState } from "react";
import Icone from "./Icone";
import { buscar, numero, type ResultadoConsulta } from "@/lib/tipos";

const CONSULTAS = [
  { rotulo: "Temperatura (média/desvio)", tipo: "MEDIA_DESVIO", extra: "&fonte_id=sensor-temperatura&medida=temperatura" },
  { rotulo: "Consumo (Wh)", tipo: "CONSUMO_WH", extra: "" },
  { rotulo: "Tempo ligado", tipo: "TEMPO_LIGADO", extra: "" },
  { rotulo: "pH mínimo e alertas", tipo: "PH_MIN_ALERTAS", extra: "" },
  { rotulo: "Maior variação", tipo: "MAIOR_VARIACAO", extra: "" },
];

const JANELAS = [15, 60, 360, 1440];

export default function PainelConsultas() {
  const [janela, setJanela] = useState(60);
  const [ativa, setAtiva] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [erro, setErro] = useState("");

  async function consultar(tipo: string, extra: string, minutos = janela) {
    setAtiva(tipo);
    setCarregando(true);
    setErro("");
    try {
      setResultado(await buscar<ResultadoConsulta>(`/api/consulta?tipo=${tipo}&janela_min=${minutos}${extra}`));
    } catch (e) {
      setResultado(null);
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  function mudarJanela(minutos: number) {
    setJanela(minutos);
    const c = CONSULTAS.find((c) => c.tipo === ativa);
    if (c) consultar(c.tipo, c.extra, minutos); // refaz a consulta aberta com a nova janela
  }

  return (
    <div className="painel">
      <div className="painel-cabecalho">
        <div className="painel-titulo"><Icone nome="grafico" tamanho={16} /><h3>Consultas agregadas</h3></div>
        <div className="segmentado" role="group" aria-label="Janela de tempo">
          {JANELAS.map((m) => (
            <button key={m} className={janela === m ? "ativo" : ""} aria-pressed={janela === m} onClick={() => mudarJanela(m)}>
              {m < 60 ? `${m} min` : `${m / 60} h`}
            </button>
          ))}
        </div>
      </div>

      <div className="chips">
        {CONSULTAS.map((c) => (
          <button key={c.tipo} className={`chip${ativa === c.tipo ? " ativo" : ""}`} aria-pressed={ativa === c.tipo}
            onClick={() => consultar(c.tipo, c.extra)}>
            {c.rotulo}
          </button>
        ))}
      </div>

      <div className={`consulta-resultado${carregando ? " carregando" : ""}`}>
        {erro ? <div className="erro">{erro}</div>
          : resultado ? (
            <>
              <p className="consulta-descricao">{resultado.descricao}</p>
              {resultado.linhas.length === 0 ? <div className="vazio-texto">Sem dados nesta janela.</div> : (
                <table>
                  <tbody>
                    {resultado.linhas.map((l) => (
                      <tr key={l.chave}>
                        <td>{l.chave}</td>
                        <td className="num">{numero(l.valor, 3)}</td>
                        <td className="unid">{l.unidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : <div className="vazio-texto">{carregando ? "Consultando…" : "Escolha uma consulta para ver o resultado."}</div>}
      </div>
    </div>
  );
}
