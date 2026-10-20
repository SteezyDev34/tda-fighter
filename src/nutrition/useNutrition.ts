import { useEffect, useState } from "react";
import { load, save } from "../lib/storage";
import {
  EMPTY_PROFILE,
  type JournalEntry,
  type MealPlan,
  type NutritionProfile,
} from "./types";

function usePersisted<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  useEffect(() => save(key, value), [key, value]);
  return [value, setValue] as const;
}

export function useNutrition() {
  const [journal, setJournal] = usePersisted<JournalEntry[]>("journal", []);
  const [profile, setProfile] = usePersisted<NutritionProfile>("profile", EMPTY_PROFILE);
  const [plan, setPlan] = usePersisted<MealPlan | null>("plan", null);

  const addEntry = (entry: Omit<JournalEntry, "id" | "createdAt">) =>
    setJournal((j) => [
      { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ...j,
    ]);

  const removeEntry = (id: string) => setJournal((j) => j.filter((e) => e.id !== id));

  return { journal, addEntry, removeEntry, profile, setProfile, plan, setPlan };
}

export type NutritionState = ReturnType<typeof useNutrition>;

/** The last 14 days of the journal, sent to the AI as context. */
export function recentJournal(journal: JournalEntry[], days = 14) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return journal.filter((e) => e.date >= since);
}
