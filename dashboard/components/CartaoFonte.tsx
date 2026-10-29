"use client";

import { useState, type CSSProperties } from "react";
import Icone, { type NomeIcone } from "./Icone";
import { comandar, numero, NOMES, rotulo, unidade, type InfoFonte } from "@/lib/tipos";

const TIPOS: Record<string, { icone: NomeIcone; cor: string; rotulo: string }> = {
  LUMINARIA: { icone: "lampada", cor: "#8b5cf6", rotulo: "Luminária RGB" },
  TOMADA_CO2: { icone: "vento", cor: "#f59e0b", rotulo: "Tomada inteligente" },
  TOMADA_LUMINARIA: { icone: "tomada", cor: "#10b981", rotulo: "Tomada inteligente" },
  SENSOR_PH: { icone: "gota", cor: "#3b82f6", rotulo: "Sensor simulado" },
  SENSOR_TEMPERATURA: { icone: "termometro", cor: "#ef4444", rotulo: "Sensor simulado" },
};

export default function CartaoFonte({ fonte, aoMudar }: { fonte: InfoFonte; aoMudar: () => void }) {
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const estado = fonte.estado;
  const intensidade = estado?.parametros?.intensidade;
  const [brilho, setBrilho] = useState<number | null>(null); // valor do slider enquanto o usuário arrasta
  const [rampa, setRampa] = useState(String(estado?.parametros?.rampa_s ?? 0));

  async function executar(acao: object) {
    setOcupado(true);
    setErro("");
    try {
      await comandar(fonte.fonteId, acao);
      aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  function enviarBrilho(valor: number) {
    executar({ parametro: { nome: "intensidade", valor } }).then(() => setBrilho(null));
  }

  const meta = TIPOS[fonte.tipo] ?? { icone: "atividade", cor: "#64748b", rotulo: fonte.tipo };
  const medidas = (fonte.ultimaLeitura?.medidas ?? []).filter((m) => m.nome !== "ligada");
  const principal = medidas[0];
  const ligada = !!estado?.ligada;

  // Sensores: pH alerta abaixo do limiar, temperatura acima (igual ao DetectorLimiar das fontes).
  const limiar = fonte.controlavel ? undefined : estado?.parametros?.limiar;
  const abaixo = fonte.tipo === "SENSOR_PH";
  const foraDoLimite = limiar !== undefined && principal !== undefined
    && (abaixo ? principal.valor < limiar : principal.valor > limiar);

  const selo = !fonte.online ? { classe: "perigo", texto: "Offline" }
    : estado?.emFalha ? { classe: "alerta", texto: "Em falha" }
    : foraDoLimite ? { classe: "alerta", texto: "Fora do limite" }
    : { classe: "ok", texto: "Online" };
  const iconeAtivo = fonte.online && (fonte.controlavel ? ligada : true);

  return (
    <article className={`cartao${fonte.online ? "" : " offline"}`} style={{ "--cor": meta.cor } as CSSProperties}>
      <div className="cartao-topo">
        <span className={`cartao-icone${iconeAtivo ? " ativo" : ""}`}><Icone nome={meta.icone} /></span>
        <span className={`selo ${selo.classe}`}>{selo.texto}</span>
      </div>
      <div className="cartao-titulos">
        <h3>{NOMES[fonte.fonteId] ?? fonte.fonteId}</h3>
        <span>{meta.rotulo}</span>
      </div>

      <div className="cartao-leitura">
        <span className="cartao-medida">{principal ? rotulo(principal.nome) : "Sem leitura"}</span>
        <div className="cartao-valor">
          <span className="valor">{principal ? numero(principal.valor) : "—"}</span>
          {principal && <span className="unidade">{unidade(principal.unidade)}</span>}
        </div>
      </div>

      {medidas.length > 1 && (
        <dl className="metricas">
          {medidas.slice(1).map((m) => (
            <div key={m.nome}>
              <dt>{rotulo(m.nome)}</dt>
              <dd>{numero(m.valor)} <span>{unidade(m.unidade)}</span></dd>
            </div>
          ))}
        </dl>
      )}

      {limiar !== undefined && (
        <div className="cartao-nota">
          Alerta {abaixo ? "abaixo" : "acima"} de <strong>{numero(limiar)} {unidade(principal?.unidade ?? "")}</strong>
        </div>
      )}

      {fonte.controlavel && (
        <div className="controles">
          <div className="controle-linha">
            <span className="controle-rotulo">{ligada ? "Ligada" : "Desligada"}</span>
            <button className="switch" role="switch" aria-checked={ligada} aria-label={`Ligar ${NOMES[fonte.fonteId] ?? fonte.fonteId}`}
              disabled={ocupado} onClick={() => executar({ power: { ligada: !ligada } })} />
          </div>

          {intensidade !== undefined && (
            <>
              <div className="controle-linha">
                <span className="controle-rotulo">Intensidade</span>
                <span className="controle-valor">{brilho ?? intensidade}%</span>
              </div>
              {/* envia só ao soltar (ou ao usar o teclado), não a cada pixel; lê o valor do elemento, não do estado */}
              <input type="range" min={0} max={100} value={brilho ?? intensidade} aria-label="Intensidade da luminária"
                style={{ "--progresso": `${brilho ?? intensidade}%` } as CSSProperties}
                onChange={(e) => setBrilho(Number(e.target.value))}
                onPointerUp={(e) => enviarBrilho(Number(e.currentTarget.value))}
                onKeyUp={(e) => { if (e.key.startsWith("Arrow") || ["Home", "End", "PageUp", "PageDown"].includes(e.key)) enviarBrilho(Number(e.currentTarget.value)); }} />
              <div className="controle-linha">
                <label className="controle-rotulo" htmlFor={`rampa-${fonte.fonteId}`}>Rampa de transição</label>
                <span className="campo-unidade">
                  <input id={`rampa-${fonte.fonteId}`} type="number" min={0} max={3600} value={rampa}
                    onChange={(e) => setRampa(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    onBlur={() => executar({ parametro: { nome: "rampa_s", valor: Number(rampa) } })} />
                  s
                </span>
              </div>
            </>
          )}

          <button className={`botao botao-sutil${estado?.emFalha ? " botao-alerta" : ""}`} disabled={ocupado}
            onClick={() => executar({ falha: { ativa: !estado?.emFalha } })}>
            <Icone nome="alerta" tamanho={15} />
            {estado?.emFalha ? "Encerrar falha" : "Simular falha"}
          </button>
        </div>
      )}

      {erro && <div className="erro">{erro}</div>}

      <footer className="cartao-rodape">
        <span className="mono">{fonte.ip}{fonte.portaGrpc ? `:${fonte.portaGrpc}` : ""}</span>
        <span>envio a cada {estado?.intervaloEnvioS ?? "?"} s</span>
      </footer>
    </article>
  );
}
