"use client";

import { useState } from "react";
import { buscar, numero, type ResultadoConsulta } from "@/lib/tipos";

const CONSULTAS = [
  { rotulo: "Temperatura (média/desvio)", tipo: "MEDIA_DESVIO", extra: "&fonte_id=sensor-temperatura&medida=temperatura" },
  { rotulo: "Consumo (Wh)", tipo: "CONSUMO_WH", extra: "" },
  { rotulo: "Tempo ligado", tipo: "TEMPO_LIGADO", extra: "" },
  { rotulo: "pH mínimo e alertas", tipo: "PH_MIN_ALERTAS", extra: "" },
  { rotulo: "Maior variação", tipo: "MAIOR_VARIACAO", extra: "" },
];

export default function PainelConsultas() {
  const [janela, setJanela] = useState(60);
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [erro, setErro] = useState("");

  async function consultar(tipo: string, extra: string) {
    setErro("");
    try {
      setResultado(await buscar<ResultadoConsulta>(`/api/consulta?tipo=${tipo}&janela_min=${janela}${extra}`));
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="painel">
      <h2>Consultas agregadas</h2>
      <div className="acoes" style={{ marginBottom: 10 }}>
        <span className="sub">Janela</span>
        <select value={janela} onChange={(e) => setJanela(Number(e.target.value))}>
          {[15, 60, 360, 1440].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
        </select>
        {CONSULTAS.map((c) => <button key={c.tipo} onClick={() => consultar(c.tipo, c.extra)}>{c.rotulo}</button>)}
      </div>
      {erro && <div className="erro">{erro}</div>}
      {resultado && (
        <>
          <div className="sub" style={{ marginBottom: 6 }}>{resultado.descricao}</div>
          <table>
            <tbody>
              {resultado.linhas.map((l) => (
                <tr key={l.chave}><td>{l.chave}</td><td className="num">{numero(l.valor, 3)}</td><td>{l.unidade}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
