import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Food } from "../src/nutrition/foods";
import { normalize } from "./_lib/shared.js";

/**
 * Food search and barcode lookup in Open Food Facts.
 * Runs server side: no CORS issue, and OFF asks clients to send a User-Agent naming the app.
 */
const UA = "TDAFighter/0.1 (https://github.com/SteezyDev34/tda-fighter)";
const FIELDS = "code,product_name,product_name_fr,brands,serving_quantity,nutriments";

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  brands?: string | string[];
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

function toFood(p: OffProduct): Food | null {
  const n = p.nutriments ?? {};
  const num = (k: string) => Number(n[k] ?? 0) || 0;
  const kcal = num("energy-kcal_100g") || num("energy_100g") / 4.184;
  const name = p.product_name_fr || p.product_name;
  if (!p.code || !name || !kcal) return null;
  const brand = Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(",")[0];
  const portion = Number(p.serving_quantity);
  return {
    id: `off:${p.code}`,
    name,
    brand: brand?.trim() || undefined,
    source: "off",
    per100g: {
      kcal: Math.round(kcal),
      protein: Math.round(num("proteins_100g") * 10) / 10,
      carbs: Math.round(num("carbohydrates_100g") * 10) / 10,
      fat: Math.round(num("fat_100g") * 10) / 10,
    },
    portionG: portion > 0 ? portion : undefined,
  };
}

// Vercel's free plan stops a function after 10 s: stay well under it.
async function getJson<T>(url: string, timeoutMs = 7000): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} on ${url}`);
  return (await res.json()) as T;
}

/**
 * Open Food Facts matches words anywhere (ingredients included), so "oeuf" returns brioches.
 * Keep the products whose name contains the searched words, best matches first.
 */
function rank(foods: Food[], q: string): Food[] {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  const score = (f: Food) => {
    const name = normalize(f.name);
    const tokens = name.split(/[^a-z0-9]+/);
    if (!words.every((w) => name.includes(w))) return 9;
    let s = 0;
    if (!name.startsWith(words[0])) s += 2;
    // "oeuf" should match "oeufs" as a word, not "boeuf".
    if (!words.every((w) => tokens.some((t) => t === w || t === `${w}s` || t === `${w}x`))) s += 3;
    return s;
  };
  const seen = new Set<string>();
  const ranked = foods
    .filter((f) => !seen.has(f.id) && seen.add(f.id))
    .map((f) => ({ f, s: score(f) }))
    .sort((a, b) => a.s - b.s || a.f.name.length - b.f.name.length);
  const matching = ranked.filter((r) => r.s < 9);
  return (matching.length ? matching : ranked).slice(0, 30).map((r) => r.f);
}

async function searchalicious(q: string): Promise<Food[]> {
  const data = await getJson<{ hits?: OffProduct[] }>(
    `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&langs=fr&page_size=50&fields=${FIELDS}`,
  );
  return (data.hits ?? []).map(toFood).filter((f): f is Food => f !== null);
}

async function search(q: string): Promise<Food[]> {
  // Products are written "Œufs" as often as "Oeufs": search both spellings, in parallel.
  const variants = [...new Set([q, q.replace(/oe/gi, "œ")])];
  const results = await Promise.allSettled(variants.map(searchalicious));
  const failed = results.filter((r) => r.status === "rejected");
  failed.forEach((r) => console.error("search-a-licious failed", (r as PromiseRejectedResult).reason));
  if (failed.length === results.length) throw new Error("search-a-licious unavailable");
  return rank(results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])), q);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const code = typeof req.query.code === "string" ? req.query.code.replace(/\D/g, "") : "";

  try {
    if (code) {
      const data = await getJson<{ status?: number; product?: OffProduct }>(
        `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`,
      );
      const food = data.status === 1 && data.product ? toFood({ ...data.product, code }) : null;
      return food ? res.json(food) : res.status(404).send("Produit introuvable");
    }
    if (q.length < 2) return res.json([]);
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    res.json(await search(q));
  } catch (err) {
    console.error(err);
    res.status(502).send("Open Food Facts ne répond pas");
  }
}
