// Formato JSON das mensagens do aquario.proto como o protobufjs entrega (camelCase, enums como texto).

export type Medida = { nome: string; valor: number; unidade: string };

export type Leitura = {
  fonteId: string;
  timestampMs: number;
  medidas: Medida[];
  evento: boolean;
  motivoEvento: string;
};

export type Status = {
  ligada: boolean;
  intervaloEnvioS: number;
  parametros: Record<string, number>;
  emFalha: boolean;
  detalhe: string;
};

export type InfoFonte = {
  fonteId: string;
  tipo: string;
  ip: string;
  portaGrpc: number;
  controlavel: boolean;
  online: boolean;
  estado: Status | null;
  ultimaLeitura: Leitura | null;
  vistoEmMs: number;
};

export type Ponto = { timestampMs: number; valor: number };

export type ResultadoConsulta = {
  descricao: string;
  linhas: { chave: string; valor: number; unidade: string }[];
};

export async function buscar<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const j = await r.json();
  if (!r.ok) throw new Error(j.erro ?? `HTTP ${r.status}`);
  return j as T;
}

export function comandar(fonteId: string, acao: object) {
  return buscar<Status>("/api/comando", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fonteId, ...acao }),
  });
}

export const NOMES: Record<string, string> = {
  "luminaria-smartled": "Luminária Smartled",
  "tomada-co2": "CO₂",
  "tomada-luminaria": "Luminária secundária",
  "sensor-ph": "Sensor de pH",
  "sensor-temperatura": "Temperatura",
};

const ROTULOS: Record<string, string> = {
  ph: "pH",
  temperatura: "Temperatura",
  potencia: "Potência",
  corrente: "Corrente",
  tensao: "Tensão",
  intensidade: "Intensidade",
};

export function rotulo(medida: string): string {
  return ROTULOS[medida] ?? medida;
}

export function unidade(u: string): string {
  return u === "C" ? "°C" : u;
}

export function numero(v: number, casas = 2): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(casas);
}

export function hora(ms: number): string {
  return new Date(ms).toLocaleTimeString("pt-BR");
}
