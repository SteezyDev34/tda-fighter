import { useState } from "react";
import { today } from "../lib/storage";
import { DailyIntake } from "./DailyIntake";
import { MEAL_SLOTS, type JournalEntry, type MealSlot } from "./types";
import type { NutritionState } from "./useNutrition";

/** Guess the meal slot from the current hour so logging is one step. */
function currentSlot(): MealSlot {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 12) return "morning_snack";
  if (h < 15) return "lunch";
  if (h < 18) return "afternoon_snack";
  return "dinner";
}

export function JournalPage({ journal, addEntry, retryEstimate, removeEntry, estimating, profile }: NutritionState) {
  const [slot, setSlot] = useState<MealSlot>(currentSlot);
  const [text, setText] = useState("");
  const date = today();
  const todays = journal.filter((e) => e.date === date);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addEntry({ date, slot, description: text.trim() });
    setText("");
  };

  const macroLine = (e: JournalEntry) => {
    if (estimating.includes(e.id)) return "Estimation en cours…";
    if (!e.nutrients) return null;
    const n = e.nutrients;
    return `${n.kcal} kcal · P ${n.protein} g · G ${n.carbs} g · L ${n.fat} g`;
  };

  return (
    <section className="stack">
      <h1>Journal du jour</h1>
      <DailyIntake entries={todays} targets={profile.targets} />
      <form className="card stack" onSubmit={submit}>
        <label htmlFor="slot">Repas</label>
        <select id="slot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
          {MEAL_SLOTS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <label htmlFor="what">Qu'est-ce que tu as mangé ?</label>
        <input
          id="what"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex. : 2 œufs, pain complet, café"
          autoComplete="off"
        />
        <button className="primary">Noter</button>
      </form>

      {MEAL_SLOTS.map((s) => {
        const entries = todays.filter((e) => e.slot === s.id);
        return (
          <div key={s.id} className="card">
            <div className="row between">
              <strong>{s.label}</strong>
              <span className={entries.length ? "pill ok" : "pill"}>
                {entries.length ? "Noté" : "À noter"}
              </span>
            </div>
            {entries.map((e) => (
              <div key={e.id} className="entry stack tight">
                <div className="row between">
                  <span>{e.description}</span>
                  <button className="link" onClick={() => removeEntry(e.id)}>Retirer</button>
                </div>
                {macroLine(e) ? (
                  <span className="small muted">{macroLine(e)}</span>
                ) : (
                  <span className="row small muted">
                    Apports pas encore reconnus.
                    <button className="link" onClick={() => retryEstimate(e)}>Réessayer</button>
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}
