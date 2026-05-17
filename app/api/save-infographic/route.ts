import { kvSetJson, kvRpush } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { processName, pngDataUrl } = await request.json() as {
      processName: string;
      pngDataUrl: string;
    };

    const id = Date.now().toString();
    const EX = 7 * 24 * 3600; // 7 days

    await Promise.all([
      kvSetJson(`infographic_meta:${id}`, { id, processName, timestamp: Number(id) }, EX),
      kvSetJson(`infographic_img:${id}`, pngDataUrl, EX),
      kvRpush("infographic_index", id),
    ]);

    return Response.json({ ok: true, id });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : "Errore" }, { status: 500 });
  }
}
