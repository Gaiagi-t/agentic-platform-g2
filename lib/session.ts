// Session step is stored in Vercel KV (shared across all serverless instances).
// Falls back to process-local memory when KV env vars are absent (local dev).

const KV_KEY = "workshop_step";

async function kvGet(): Promise<number | null> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${KV_KEY}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const { result } = (await res.json()) as { result: string | null };
    return result !== null ? Number(result) : 0;
  } catch {
    return null;
  }
}

async function kvSet(step: number): Promise<void> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;
  try {
    await fetch(`${url}/set/${KV_KEY}/${step}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // KV write failed — in-memory value still updated below
  }
}

declare global {
  // eslint-disable-next-line no-var
  var _sessionStep: number | undefined;
}

export async function getSessionStep(): Promise<number> {
  const kv = await kvGet();
  if (kv !== null) return kv;
  return globalThis._sessionStep ?? 0;
}

export async function setSessionStep(step: number): Promise<void> {
  await kvSet(step);
  globalThis._sessionStep = step; // keep in-memory in sync as local fallback
}
