import type { Nutrients } from "./types";

/** A food the user can pick in the journal. Values are per 100 g. */
export interface Food {
  id: string;
  name: string;
  /** "custom": created by the user from the label, when Open Food Facts doesn't have it. */
  source: "off" | "custom";
  brand?: string;
  barcode?: string;
  per100g: Nutrients;
  /** Typical portion in grams, when the source gives one. */
  portionG?: number;
}

export const SOURCE_LABEL: Record<Food["source"], string> = {
  off: "Open Food Facts",
  custom: "Mon aliment (valeurs de l'étiquette)",
};

/** Custom foods whose name contains every word of the query. */
export const matchFoods = (foods: Food[], query: string) => {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return words.length ? foods.filter((f) => words.every((w) => normalize(f.name).includes(w))) : [];
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

// --- Raw or cooked weight: rice, pasta, legumes and meats change weight when cooked ---

export type Cooking = "raw" | "cooked";

export const COOKING_LABEL: Record<Cooking, string> = { raw: "cru", cooked: "cuit" };

/** Cooked weight / raw weight, for the foods whose weight changes a lot when cooked. */
const COOK_FACTORS: { words: RegExp; factor: number; starch: boolean }[] = [
  { words: /\bquinoa\b/, factor: 2.7, starch: true },
  { words: /\briz\b/, factor: 2.5, starch: true },
  { words: /\b(pates|spaghettis?|tagliatelles?|penne|fusillis?|macaronis?|coquillettes|linguine|farfalle|torsades)\b/, factor: 2.3, starch: true },
  { words: /\b(semoule|couscous)\b/, factor: 2.4, starch: true },
  { words: /\b(lentilles|pois chiches|pois casses|flageolets|haricots (rouges|blancs|noirs|secs|lingots|mungo)|feves|boulgour|sarrasin|epeautre|orge|millet|amarante)\b/, factor: 2.5, starch: true },
  { words: /\b(poulet|dinde|boeuf|steak|veau|porc|agneau|canard|lapin|viande|escalope|filet mignon)\b/, factor: 0.75, starch: false },
  { words: /\b(saumon|cabillaud|colin|lieu|merlu|truite|daurade|sole|limande|fletan|panga|lotte|crevettes|gambas)\b/, factor: 0.8, starch: false },
];

/** Already cooked or not a plain food: galette de riz, lait de riz, thon en boîte… */
const NOT_COOKABLE = /\b(galettes?|lait|boisson|souffle|farine|creme|gateau|biscuits?|conserve|jambon|bouillon|chips|sauce)\b/;

export interface CookInfo {
  factor: number;
  /** Whether the food's values per 100 g are for the raw or the cooked food. */
  base: Cooking;
}

/** How the food's weight changes when cooked, or null when it doesn't matter. */
export function cookInfo(food: Food): CookInfo | null {
  const name = normalize(food.name);
  const rule = COOK_FACTORS.find((r) => r.words.test(name));
  if (!rule || NOT_COOKABLE.test(name)) return null;
  if (/\b(cuit|cuite|cuits|cuites|cuisine|grille|grillee|roti|rotie|poele|poelee|vapeur|express)\b/.test(name)) {
    return { factor: rule.factor, base: "cooked" };
  }
  if (/\b(cru|crue|crus|crues|sec|secs|seche|seches)\b/.test(name)) return { factor: rule.factor, base: "raw" };
  // Dry rice or pasta is around 350 kcal / 100 g, cooked around 130 to 160.
  return { factor: rule.factor, base: rule.starch && food.per100g.kcal < 250 ? "cooked" : "raw" };
}

/** The same portion weighed in another state, e.g. 200 g of cooked rice is 80 g raw. */
export const convertGrams = (info: CookInfo, grams: number, from: Cooking, to: Cooking) =>
  from === to ? grams : Math.round(to === "cooked" ? grams * info.factor : grams / info.factor);
