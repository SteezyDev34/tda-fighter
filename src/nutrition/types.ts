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
  /** The generated meal this line was added from (id in LoggedMeal). */
  fromMeal?: string;
}

/** A generated meal added to the journal: keeps the AI's recipe, explanation and apports. */
export interface LoggedMeal {
  id: string;
  meal: SuggestedMeal;
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
  /** Sex, age, weight, height, activity, followed protocol: used to compute needs and apports. */
  body: string;
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
  /** Advised time "HH:MM", placed from the wake-up and training times. */
  time?: string;
  name: string;
  /** grams and search let the meal be logged with Open Food Facts nutrients. */
  ingredients: { item: string; quantity: string; grams?: number; search?: string }[];
  /** Set once the meal has been added to the journal. */
  logged?: boolean;
  /** Apports of the meal in the resources' method, e.g. "2 TP + 1 BH + 1 MM + BG". */
  apports?: string;
  steps: string[];
  why: string;
}

export interface ShoppingItem {
  item: string;
  quantity: string;
  aisle: string;
  checked: boolean;
}

/** A week built from a few typical days, like the resources' weekly meal plan sheet. */
export interface WeekPlan {
  types: { name: string; dayType: "training" | "rest"; meals: SuggestedMeal[] }[];
  /** Each date follows one typical day (index in types). */
  days: { date: string; type: number }[];
  /** "date|slot" of the meals already added to the journal. */
  logged: string[];
}

/** When the user wakes up and trains ("HH:MM"), to place the meals around them. */
export interface Schedule {
  wake: string;
  /** Empty when the session has no fixed time. */
  training: string;
}

export interface MealPlan {
  /** Set when the plan is saved in the history of generated plans. */
  id?: string;
  createdAt?: string;
  /** What was asked, e.g. "Toute la semaine", "Déjeuner". */
  label?: string;
  meals: SuggestedMeal[];
  shopping: ShoppingItem[];
  /** Training or rest day the meals were made for (single-day plans). */
  dayType?: "training" | "rest";
  week?: WeekPlan;
}

export const EMPTY_PROFILE: NutritionProfile = {
  body: "",
  goal: "",
  likes: "",
  dislikes: "",
  allergies: "",
  budget: "",
  cookingTime: "",
  targets: { kcal: 2200, protein: 130, carbs: 250, fat: 70 },
};
