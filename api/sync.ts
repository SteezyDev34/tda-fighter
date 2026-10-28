import type { VercelRequest, VercelResponse } from "@vercel/node";

/** One stored value: `t` is when it was edited on the device, `s` when the server received it. */
interface Entry {
  v: unknown;
  t: number;
  s: number;
}

const HASH = "tdaf:data";

/** Upstash Redis over its REST API (variables set by the Vercel integration, or by Upstash directly). */
function redisEnv() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url?.trim() && token?.trim() ? { url: url.trim(), token: token.trim() } : null;
}

async function redis<T>(command: (string | number)[]): Promise<T> {
  const { url, token } = redisEnv()!;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = (await res.json()) as { result?: T; error?: string };
  if (!res.ok || data.error) throw new Error(data.error ?? `Redis ${res.status}`);
  return data.result as T;
}

async function readAll() {
  const flat = await redis<string[]>(["HGETALL", HASH]);
  const all: Record<string, Entry> = {};
  for (let i = 0; i < flat.length; i += 2) all[flat[i]] = JSON.parse(flat[i + 1]) as Entry;
  return all;
}

/**
 * Keeps the app's data on the server so every device sees the same thing.
 * The app sends the values it changed and gets back those changed since its last visit.
 * For each value, the latest edit wins.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("POST uniquement");
  const missing = [
    !redisEnv() && "la base Upstash Redis (KV_REST_API_URL et KV_REST_API_TOKEN)",
    !process.env.TDAF_ACCESS_CODE?.trim() && "TDAF_ACCESS_CODE",
  ].filter(Boolean);
  if (missing.length) {
    return res
      .status(503)
      .send(`Ce déploiement ne voit pas ${missing.join(" ni ")} (env : ${process.env.VERCEL_ENV ?? "?"}).`);
  }
  if (String(req.headers["x-tdaf-code"] ?? "").trim() !== process.env.TDAF_ACCESS_CODE!.trim()) {
    return res.status(401).send("Code d'accès incorrect.");
  }

  const { since = 0, changes = {} } = req.body as {
    since?: number;
    changes?: Record<string, { v: unknown; t: number }>;
  };

  try {
    // A little margin: a value written while this request reads comes back next time.
    const cursor = Date.now() - 5_000;
    const all = await readAll();
    const now = Date.now();
    const accepted = new Set<string>();
    const writes: string[] = [];
    for (const [key, change] of Object.entries(changes)) {
      const current = all[key];
      if (current && current.t > change.t) continue; // a newer edit from another device wins
      all[key] = { v: change.v, t: change.t, s: now };
      accepted.add(key);
      writes.push(key, JSON.stringify(all[key]));
    }
    if (writes.length) await redis(["HSET", HASH, ...writes]);

    // Sent back: everything newer than the device's last visit, and the edits it lost.
    const out: Record<string, { v: unknown; t: number }> = {};
    for (const [key, e] of Object.entries(all)) {
      if (!accepted.has(key) && (e.s > since || key in changes)) out[key] = { v: e.v, t: e.t };
    }
    return res.json({ cursor, values: out });
  } catch (err) {
    console.error(err);
    return res.status(502).send("Le stockage en ligne ne répond pas.");
  }
}
