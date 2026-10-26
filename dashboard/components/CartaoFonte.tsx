"use client";

import { useState } from "react";
import { comandar, numero, NOMES, type InfoFonte } from "@/lib/tipos";

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

  const medidas = (fonte.ultimaLeitura?.medidas ?? []).filter((m) => m.nome !== "ligada");
  const principal = medidas[0];
  const selo = !fonte.online ? ["off", "OFFLINE"] : estado?.emFalha ? ["falha", "FALHA"] : ["on", "ONLINE"];

  return (
    <div className={`painel cartao ${fonte.online ? "" : "offline"}`}>
      <div className="titulo">
        <span>{NOMES[fonte.fonteId] ?? fonte.fonteId}</span>
        <span className={`selo ${selo[0]}`}>{selo[1]}</span>
      </div>
      <div className="leitura">
        {principal ? `${numero(principal.valor)} ${principal.unidade}` : "—"}
        {fonte.controlavel && <span className="sub"> · {estado?.ligada ? "ligada" : "desligada"}</span>}
      </div>
      <div className="detalhe">
        {medidas.slice(1).map((m) => `${m.nome} ${numero(m.valor)}${m.unidade}`).join(" · ") || fonte.tipo}
      </div>

      {fonte.controlavel && (
        <>
          <div className="acoes">
            <button disabled={ocupado} className={estado?.ligada ? "ativo" : ""} onClick={() => executar({ power: { ligada: true } })}>
              Ligar
            </button>
            <button disabled={ocupado} className={estado?.ligada ? "" : "ativo"} onClick={() => executar({ power: { ligada: false } })}>
              Desligar
            </button>
            <button disabled={ocupado} onClick={() => executar({ falha: { ativa: !estado?.emFalha } })}>
              {estado?.emFalha ? "Encerrar falha" : "Simular falha"}
            </button>
          </div>
          {intensidade !== undefined && (
            <div>
              <div className="detalhe">
                Intensidade: {brilho ?? intensidade}% · rampa{" "}
                <input type="number" min={0} max={3600} value={rampa} style={{ width: 60 }}
                  onChange={(e) => setRampa(e.target.value)}
                  onBlur={() => executar({ parametro: { nome: "rampa_s", valor: Number(rampa) } })} /> s
              </div>
              <input type="range" min={0} max={100} value={brilho ?? intensidade}
                onChange={(e) => setBrilho(Number(e.target.value))}
                onPointerUp={() => { // envia só ao soltar, não a cada pixel
                  if (brilho !== null) executar({ parametro: { nome: "intensidade", valor: brilho } }).then(() => setBrilho(null));
                }} />
            </div>
          )}
        </>
      )}
      <div className="detalhe">
        {fonte.ip}{fonte.portaGrpc ? `:${fonte.portaGrpc}` : ""} · envio a cada {estado?.intervaloEnvioS ?? "?"}s
      </div>
      {erro && <div className="erro">{erro}</div>}
    </div>
  );
}
