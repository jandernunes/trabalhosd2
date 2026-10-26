import { NextResponse } from "next/server";
import { gateway, type Objeto } from "./gateway";

/** Envia a requisição ao Gateway e devolve só o pedaço da Resposta que interessa à página. */
export async function pedir(req: Objeto, corpo: (r: Objeto) => unknown) {
  try {
    const r = await gateway.enviar(req);
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 400 });
    return NextResponse.json(corpo(r));
  } catch (e) {
    return NextResponse.json({ erro: `Gateway indisponível (${(e as Error).message})` }, { status: 503 });
  }
}

export function numero(v: string | null, padrao: number): number {
  const n = Number(v);
  return v === null || Number.isNaN(n) ? padrao : n;
}
