import type { Food } from "./foods";

export const MEAL_SLOTS = [
  { id: "breakfast", label: "Petit-déjeuner" },
  { id: "morning_snack", label: "Collation du matin" },
  { id: "lunch", label: "Déjeuner" },
  { id: "afternoon_snack", label: "Collation de l'après-midi" },
  { id: "dinner", label: "Dîner" },
] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number]["id"];

export const slotLabel = (slot: MealSlot) =>
  MEAL_SLOTS.find((s) => s.id === slot)?.label ?? slot;

export interface Nutrients {
  kcal: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
}

export const NUTRIENTS: { key: keyof Nutrients; label: string; unit: string }[] = [
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protéines", unit: "g" },
  { key: "carbs", label: "Glucides", unit: "g" },
  { key: "fat", label: "Lipides", unit: "g" },
];

/** One line of the food journal: what was actually eaten. */
export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  slot: MealSlot;
  description: string;
  createdAt: string;
  /** Computed from the food database for the chosen quantity. */
  nutrients: Nutrients;
  /** The database food this line comes from. */
  food?: { id: string; grams: number };
}

/** A food the user already logged, kept to find it again first. */
export interface RecentFood {
  food: Food;
  lastGrams: number;
  usedAt: string;
}

/** A meal the user saved to log it again in one tap. */
export interface SavedMeal {
  id: string;
  name: string;
  items: { description: string; nutrients: Nutrients; food?: { id: string; grams: number } }[];
}

/** The criteria the AI must respect when it suggests meals. */
export interface NutritionProfile {
  goal: string;
  likes: string;
  dislikes: string;
  allergies: string;
  budget: string;
  cookingTime: string;
  /** Daily intake goals shown on the journal chart. */
  targets: Nutrients;
}

export interface SuggestedMeal {
  slot: MealSlot;
  name: string;
  ingredients: { item: string; quantity: string }[];
  steps: string[];
  why: string;
}

export interface ShoppingItem {
  item: string;
  quantity: string;
  aisle: string;
  checked: boolean;
}

export interface MealPlan {
  meals: SuggestedMeal[];
  shopping: ShoppingItem[];
}

export const EMPTY_PROFILE: NutritionProfile = {
  goal: "",
  likes: "",
  dislikes: "",
  allergies: "",
  budget: "",
  cookingTime: "",
  targets: { kcal: 2200, protein: 130, carbs: 250, fat: 70 },
};
