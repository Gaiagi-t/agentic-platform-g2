// Generic Redis helpers via Upstash REST pipeline — supports large values (images, JSON).
// Uses pipeline endpoint to avoid URL-length limits for large payloads.

function redisEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function redisPipeline(commands: unknown[][]): Promise<Array<{ result: unknown }> | null> {
  const env = redisEnv();
  if (!env) return null;
  const res = await fetch(`${env.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<Array<{ result: unknown }>>;
}

export async function kvSetJson(key: string, value: unknown, exSeconds?: number) {
  const cmd: unknown[] = exSeconds
    ? ["SET", key, JSON.stringify(value), "EX", exSeconds]
    : ["SET", key, JSON.stringify(value)];
  await redisPipeline([cmd]);
}

export async function kvGetJson<T>(key: string): Promise<T | null> {
  const results = await redisPipeline([["GET", key]]);
  const raw = results?.[0]?.result;
  if (!raw || typeof raw !== "string") return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export async function kvRpush(key: string, value: string) {
  await redisPipeline([["RPUSH", key, value]]);
}

export async function kvLrange(key: string, start = 0, end = -1): Promise<string[]> {
  const results = await redisPipeline([["LRANGE", key, String(start), String(end)]]);
  return (results?.[0]?.result as string[]) ?? [];
}

export async function kvBatchGetJson<T>(keys: string[]): Promise<(T | null)[]> {
  if (!keys.length) return [];
  const results = await redisPipeline(keys.map((k) => ["GET", k]));
  if (!results) return keys.map(() => null);
  return results.map(({ result }) => {
    if (!result || typeof result !== "string") return null;
    try { return JSON.parse(result) as T; } catch { return null; }
  });
}
