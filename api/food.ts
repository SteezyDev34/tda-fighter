import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Food } from "../src/nutrition/foods";

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

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${res.status} on ${url}`);
  return (await res.json()) as T;
}

async function search(q: string): Promise<Food[]> {
  const enc = encodeURIComponent(q);
  try {
    // Search-a-licious: Open Food Facts' fast search engine.
    const data = await getJson<{ hits?: OffProduct[] }>(
      `https://search.openfoodfacts.org/search?q=${enc}&langs=fr&page_size=24&fields=${FIELDS}`,
    );
    const foods = (data.hits ?? []).map(toFood).filter((f): f is Food => f !== null);
    if (foods.length) return foods;
  } catch (err) {
    console.error("search-a-licious failed", err);
  }
  // Fallback: the classic search endpoint (slower).
  const data = await getJson<{ products?: OffProduct[] }>(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${enc}&search_simple=1&json=1&page_size=24&lc=fr&cc=fr&fields=${FIELDS}`,
  );
  return (data.products ?? []).map(toFood).filter((f): f is Food => f !== null);
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
