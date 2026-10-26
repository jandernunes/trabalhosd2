import { NextResponse } from "next/server";
import { pedir } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Corpo: { fonteId, power?: { ligada }, parametro?: { nome, valor }, falha?: { ativa } }
export async function POST(req: Request) {
  const corpo = await req.json().catch(() => null);
  if (!corpo || typeof corpo.fonteId !== "string" || !(corpo.power || corpo.parametro || corpo.falha)) {
    return NextResponse.json({ erro: "informe fonteId e uma ação (power, parametro ou falha)" }, { status: 400 });
  }
  const { fonteId, power, parametro, falha } = corpo;
  return pedir({ comando: { fonteId, power, parametro, falha } }, (r) => r.estado);
}
