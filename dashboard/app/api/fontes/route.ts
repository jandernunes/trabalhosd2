import { pedir } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return pedir({ listar: {} }, (r) => r.fontes?.fontes ?? []);
}
