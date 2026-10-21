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

/** Lowercase, no accents, "œ" as "oe", so "oeuf" finds "Œufs" and "pates" finds "Pâtes". */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const scale = (per100g: Nutrients, grams: number): Nutrients => ({
  kcal: Math.round((per100g.kcal * grams) / 100),
  protein: Math.round((per100g.protein * grams) / 10) / 10,
  carbs: Math.round((per100g.carbs * grams) / 10) / 10,
  fat: Math.round((per100g.fat * grams) / 10) / 10,
});

// --- Open Food Facts, through the app's own /api/food route (no CORS, proper User-Agent) ---

export async function searchOff(query: string): Promise<Food[]> {
  if (normalize(query).length < 2) return [];
  const res = await fetch(`/api/food?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Food[];
}

export async function findBarcode(code: string): Promise<Food | null> {
  const res = await fetch(`/api/food?code=${encodeURIComponent(code)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Food;
}
