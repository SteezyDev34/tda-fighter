import type { Nutrients } from "./types";

/** A food the user can pick in the journal. Values are per 100 g. */
export interface Food {
  id: string;
  name: string;
  source: "ciqual" | "off";
  brand?: string;
  per100g: Nutrients;
  /** Typical portion in grams, when the source gives one. */
  portionG?: number;
}

export const SOURCE_LABEL: Record<Food["source"], string> = {
  ciqual: "Ciqual (ANSES)",
  off: "Open Food Facts",
};

/** Lowercase, no accents, so "pates" finds "Pâtes". */
export const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export const scale = (per100g: Nutrients, grams: number): Nutrients => ({
  kcal: Math.round((per100g.kcal * grams) / 100),
  protein: Math.round((per100g.protein * grams) / 10) / 10,
  carbs: Math.round((per100g.carbs * grams) / 10) / 10,
  fat: Math.round((per100g.fat * grams) / 10) / 10,
});

// --- Ciqual: official French food composition table, bundled as public/ciqual.json ---

type CiqualRow = [code: string, name: string, kcal: number, protein: number, carbs: number, fat: number];
let ciqual: Promise<Food[]> | null = null;

function loadCiqual(): Promise<Food[]> {
  ciqual ??= fetch(`${import.meta.env.BASE_URL}ciqual.json`)
    .then((r) => (r.ok ? (r.json() as Promise<CiqualRow[]>) : []))
    .then((rows) =>
      rows.map(([code, name, kcal, protein, carbs, fat]) => ({
        id: `ciqual:${code}`,
        name,
        source: "ciqual" as const,
        per100g: { kcal, protein, carbs, fat },
      })),
    )
    .catch(() => []);
  return ciqual;
}

export async function searchCiqual(query: string, limit = 15): Promise<Food[]> {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const foods = await loadCiqual();
  return foods
    .filter((f) => {
      const name = normalize(f.name);
      return words.every((w) => name.includes(w));
    })
    // Shorter names first: "Œuf, cru" before "Œuf, jaune, cuit, en poudre".
    .sort((a, b) => a.name.length - b.name.length)
    .slice(0, limit);
}

// --- Open Food Facts: packaged products, by name or barcode ---

interface OffProduct {
  code: string;
  product_name?: string;
  brands?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

const OFF = "https://world.openfoodfacts.org";
const OFF_FIELDS = "code,product_name,brands,serving_quantity,nutriments";

function fromOff(p: OffProduct): Food | null {
  const n = p.nutriments ?? {};
  const num = (k: string) => Number(n[k] ?? 0) || 0;
  const kcal = num("energy-kcal_100g") || num("energy_100g") / 4.184;
  if (!p.product_name || !kcal) return null;
  const portion = Number(p.serving_quantity);
  return {
    id: `off:${p.code}`,
    name: p.product_name,
    brand: p.brands?.split(",")[0]?.trim(),
    source: "off",
    per100g: {
      kcal: Math.round(kcal),
      protein: num("proteins_100g"),
      carbs: num("carbohydrates_100g"),
      fat: num("fat_100g"),
    },
    portionG: portion > 0 ? portion : undefined,
  };
}

export async function searchOff(query: string, limit = 10): Promise<Food[]> {
  if (normalize(query).length < 3) return [];
  try {
    const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=${limit}&fields=${OFF_FIELDS}&lc=fr&cc=fr`;
    const data = (await (await fetch(url)).json()) as { products?: OffProduct[] };
    return (data.products ?? []).map(fromOff).filter((f): f is Food => f !== null);
  } catch {
    return [];
  }
}

export async function findBarcode(code: string): Promise<Food | null> {
  try {
    const res = await fetch(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
    const data = (await res.json()) as { status?: number; product?: OffProduct };
    return data.status === 1 && data.product ? fromOff({ ...data.product, code }) : null;
  } catch {
    return null;
  }
}
