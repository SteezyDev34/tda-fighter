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

/** One line of the food journal: what was actually eaten. */
export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  slot: MealSlot;
  description: string;
  createdAt: string;
}

/** The criteria the AI must respect when it suggests meals. */
export interface NutritionProfile {
  goal: string;
  likes: string;
  dislikes: string;
  allergies: string;
  budget: string;
  cookingTime: string;
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
};
