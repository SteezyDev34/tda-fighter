import type { Nutrients } from "./types";

/** A food the user can pick in the journal. Values are per 100 g. */
export interface Food {
  id: string;
  name: string;
  source: "off";
  brand?: string;
  per100g: Nutrients;
  /** Typical portion in grams, when the source gives one. */
  portionG?: number;
}

export const SOURCE_LABEL: Record<Food["source"], string> = {
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

export async function searchOff(query: string, limit = 20): Promise<Food[]> {
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
