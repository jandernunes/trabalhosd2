import { pedir } from "@/lib/api";

export const runtime = "nodejs"; // o módulo `net` (TCP) não existe no runtime Edge
export const dynamic = "force-dynamic";

export async function GET() {
  return pedir({ listar: {} }, (r) => r.fontes?.fontes ?? []);
}
