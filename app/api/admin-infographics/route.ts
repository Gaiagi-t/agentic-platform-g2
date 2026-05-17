import { kvLrange, kvBatchGetJson, kvGetJson } from "@/lib/kv";

export const dynamic = "force-dynamic";

type InfographicMeta = { id: string; processName: string; timestamp: number };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pin = searchParams.get("pin");
  const id = searchParams.get("id");
  const adminPin = process.env.ADMIN_PIN ?? "IFAB2026";

  if (pin !== adminPin) {
    return Response.json({ error: "PIN non valido" }, { status: 401 });
  }

  // Fetch a single image on demand
  if (id) {
    const pngDataUrl = await kvGetJson<string>(`infographic_img:${id}`);
    return Response.json({ pngDataUrl });
  }

  // Fetch all metadata (no images — lazy loaded)
  const ids = await kvLrange("infographic_index");
  const uniqueIds = [...new Set(ids)].reverse(); // dedup, newest first
  const metas = await kvBatchGetJson<InfographicMeta>(
    uniqueIds.map((i) => `infographic_meta:${i}`)
  );

  return Response.json({
    infographics: metas.filter((m): m is InfographicMeta => m !== null),
  });
}
