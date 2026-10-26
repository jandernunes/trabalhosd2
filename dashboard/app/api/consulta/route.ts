import { numero, pedir } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /api/consulta?tipo=CONSUMO_WH&janela_min=60[&fonte_id=&medida=]
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return pedir(
    {
      consulta: {
        tipo: q.get("tipo") ?? "CONSULTA_DESCONHECIDA",
        janelaMin: numero(q.get("janela_min"), 60),
        fonteId: q.get("fonte_id") ?? "",
        medida: q.get("medida") ?? "",
      },
    },
    (r) => r.resultado,
  );
}
