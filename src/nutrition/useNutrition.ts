import { useEffect, useState } from "react";
import { load, save } from "../lib/storage";
import {
  EMPTY_PROFILE,
  type JournalEntry,
  type MealPlan,
  type NutritionProfile,
  type SavedMeal,
} from "./types";

function usePersisted<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  useEffect(() => save(key, value), [key, value]);
  return [value, setValue] as const;
}

export function useNutrition() {
  const [storedJournal, setJournal] = usePersisted<JournalEntry[]>("journal", []);
  const [storedProfile, setProfile] = usePersisted<NutritionProfile>("profile", EMPTY_PROFILE);
  const [plan, setPlan] = usePersisted<MealPlan | null>("plan", null);
  const [savedMeals, setSavedMeals] = usePersisted<SavedMeal[]>("saved-meals", []);

  // Profiles saved before targets existed get the default targets.
  const profile = { ...EMPTY_PROFILE, ...storedProfile };
  // Lines logged before the food database have no values: count them as zero.
  const journal = storedJournal.map((e) => ({
    ...e,
    nutrients: e.nutrients ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  }));

  const addEntries = (entries: Omit<JournalEntry, "id" | "createdAt">[]) =>
    setJournal((j) => [
      ...entries.map((e) => ({ ...e, id: crypto.randomUUID(), createdAt: new Date().toISOString() })),
      ...j,
    ]);

  const removeEntry = (id: string) => setJournal((j) => j.filter((e) => e.id !== id));

  const saveMeal = (name: string, entries: JournalEntry[]) =>
    setSavedMeals((m) => [
      {
        id: crypto.randomUUID(),
        name,
        items: entries.map(({ description, nutrients, food }) => ({ description, nutrients, food })),
      },
      ...m,
    ]);

  const deleteMeal = (id: string) => setSavedMeals((m) => m.filter((x) => x.id !== id));

  return {
    journal,
    addEntries,
    removeEntry,
    savedMeals,
    saveMeal,
    deleteMeal,
    profile,
    setProfile,
    plan,
    setPlan,
  };
}

export type NutritionState = ReturnType<typeof useNutrition>;

/** The last 14 days of the journal, sent to the AI as context. */
export function recentJournal(journal: JournalEntry[], days = 14) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return journal.filter((e) => e.date >= since);
}
