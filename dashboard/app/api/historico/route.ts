import { numero, pedir } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /api/historico?fonte_id=sensor-ph&medida=ph&janela_min=30&max_pontos=200
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return pedir(
    {
      historico: {
        fonteId: q.get("fonte_id") ?? "",
        medida: q.get("medida") ?? "",
        janelaMin: numero(q.get("janela_min"), 30),
        maxPontos: numero(q.get("max_pontos"), 200),
      },
    },
    (r) => r.serie?.pontos ?? [],
  );
}
