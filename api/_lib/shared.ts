// Server-side copies of small helpers from src/nutrition.
// Vercel runs api/ as plain ES modules: value imports from src/ are not bundled,
// so only type imports may point there. Keep these in sync with src/nutrition.
import type { MealSlot } from "../../src/nutrition/types";

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Petit-déjeuner",
  morning_snack: "Collation du matin",
  lunch: "Déjeuner",
  afternoon_snack: "Collation de l'après-midi",
  dinner: "Dîner",
};

export const MEAL_SLOT_IDS = Object.keys(MEAL_SLOT_LABELS) as [MealSlot, ...MealSlot[]];

export const slotLabel = (slot: MealSlot) => MEAL_SLOT_LABELS[slot] ?? slot;

/** Lowercase, no accents, "œ" as "oe" (same as src/nutrition/foods.ts). */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
