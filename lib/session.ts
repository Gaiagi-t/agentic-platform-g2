// Session step is stored in Vercel KV (shared across all serverless instances).
// Falls back to process-local memory when KV env vars are absent (local dev).

const KV_KEY = "workshop_step";

function redisEnv(): { url: string; token: string } | null {
  // Supports Upstash via Vercel Marketplace and legacy Vercel KV env var names
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function kvGet(): Promise<number | null> {
  const env = redisEnv();
  if (!env) return null;
  try {
    const res = await fetch(`${env.url}/get/${KV_KEY}`, {
      headers: { Authorization: `Bearer ${env.token}` },
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
  const env = redisEnv();
  if (!env) return;
  try {
    await fetch(`${env.url}/set/${KV_KEY}/${step}`, {
      headers: { Authorization: `Bearer ${env.token}` },
    });
  } catch {
    // Redis write failed — in-memory value still updated below
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
