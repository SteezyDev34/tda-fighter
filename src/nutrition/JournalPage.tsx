import { useState } from "react";
import { today } from "../lib/storage";
import { DailyIntake } from "./DailyIntake";
import { FoodPicker } from "./FoodPicker";
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

const macroLine = ({ nutrients: n }: JournalEntry) =>
  `${Math.round(n.kcal)} kcal · P ${Math.round(n.protein)} g · G ${Math.round(n.carbs)} g · L ${Math.round(n.fat)} g`;

/** Saves the foods of one meal under a name, to log them again in one tap. */
function SaveMeal({ entries, onSave }: { entries: JournalEntry[]; onSave: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  if (entries.length < 2) return null;
  if (!open) {
    return <button className="link" onClick={() => setOpen(true)}>Enregistrer ce repas</button>;
  }
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave(name.trim());
        setOpen(false);
        setName("");
      }}
    >
      <input
        id={`meal-name-${entries[0].id}`}
        placeholder="Nom du repas, ex. : Petit-déj du matin"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <button className="primary">OK</button>
    </form>
  );
}

export function JournalPage({ journal, addEntries, removeEntry, savedMeals, saveMeal, profile }: NutritionState) {
  const [slot, setSlot] = useState<MealSlot>(currentSlot);
  const date = today();
  const todays = journal.filter((e) => e.date === date);

  return (
    <section className="stack">
      <h1>Journal du jour</h1>
      <DailyIntake entries={todays} targets={profile.targets} />

      <div className="card stack">
        <label htmlFor="slot">Repas</label>
        <select id="slot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
          {MEAL_SLOTS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <FoodPicker
          savedMeals={savedMeals}
          onAdd={(items) => addEntries(items.map((i) => ({ ...i, date, slot })))}
        />
      </div>

      {MEAL_SLOTS.map((s) => {
        const entries = todays.filter((e) => e.slot === s.id);
        return (
          <div key={s.id} className="card stack tight">
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
                <span className="small muted">{macroLine(e)}</span>
              </div>
            ))}
            <SaveMeal entries={entries} onSave={(name) => saveMeal(name, entries)} />
          </div>
        );
      })}
    </section>
  );
}
