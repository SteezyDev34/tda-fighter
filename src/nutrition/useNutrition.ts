import { useEffect, useState } from "react";
import { load, save } from "../lib/storage";
import {
  EMPTY_PROFILE,
  type JournalEntry,
  type MealPlan,
  type Nutrients,
  type NutritionProfile,
} from "./types";

function usePersisted<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  useEffect(() => save(key, value), [key, value]);
  return [value, setValue] as const;
}

async function estimate(description: string, profile: NutritionProfile): Promise<Nutrients | null> {
  try {
    const res = await fetch("/api/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, profile }),
    });
    return res.ok ? ((await res.json()) as Nutrients) : null;
  } catch {
    return null;
  }
}

export function useNutrition() {
  const [journal, setJournal] = usePersisted<JournalEntry[]>("journal", []);
  const [storedProfile, setProfile] = usePersisted<NutritionProfile>("profile", EMPTY_PROFILE);
  const [plan, setPlan] = usePersisted<MealPlan | null>("plan", null);
  const [estimating, setEstimating] = useState<string[]>([]);

  // Profiles saved before targets existed get the default targets.
  const profile = { ...EMPTY_PROFILE, ...storedProfile };

  const updateEntry = (id: string, patch: Partial<JournalEntry>) =>
    setJournal((j) => j.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  /** The AI reads the description and fills in the nutrients: no manual input. */
  const runEstimate = (id: string, description: string) => {
    setEstimating((ids) => [...ids, id]);
    estimate(description, profile).then((nutrients) => {
      if (nutrients) updateEntry(id, { nutrients });
      setEstimating((ids) => ids.filter((x) => x !== id));
    });
  };

  const addEntry = (entry: Omit<JournalEntry, "id" | "createdAt">) => {
    const id = crypto.randomUUID();
    setJournal((j) => [{ ...entry, id, createdAt: new Date().toISOString() }, ...j]);
    runEstimate(id, entry.description);
  };

  const removeEntry = (id: string) => setJournal((j) => j.filter((e) => e.id !== id));

  return {
    journal,
    addEntry,
    retryEstimate: (e: JournalEntry) => runEstimate(e.id, e.description),
    removeEntry,
    estimating,
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
