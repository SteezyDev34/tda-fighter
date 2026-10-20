import { useState } from "react";
import { today } from "../lib/storage";
import { DailyIntake } from "./DailyIntake";
import { MEAL_SLOTS, NUTRIENTS, type JournalEntry, type MealSlot, type Nutrients } from "./types";
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

const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/** Inline editor so an estimate can be corrected, or entered by hand. */
function NutrientEditor({ entry, onSave, onCancel }: {
  entry: JournalEntry;
  onSave: (n: Nutrients) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Nutrients>(entry.nutrients ?? ZERO);
  return (
    <div className="stack tight editor">
      <div className="nutrient-grid">
        {NUTRIENTS.map(({ key, label, unit }) => (
          <label key={key} className="stack tight">
            <span className="small muted">{label} ({unit})</span>
            <input
              id={`${entry.id}-${key}`}
              type="number"
              inputMode="numeric"
              min={0}
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <div className="row">
        <button className="primary" onClick={() => onSave(values)}>Enregistrer</button>
        <button onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

export function JournalPage({ journal, addEntry, updateEntry, removeEntry, estimating, profile }: NutritionState) {
  const [slot, setSlot] = useState<MealSlot>(currentSlot);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
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
    if (!e.nutrients) return "Apports non estimés";
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
                  <span className="row">
                    <button className="link" onClick={() => setEditing(e.id)}>
                      {e.nutrients ? "Corriger" : "Saisir"}
                    </button>
                    <button className="link" onClick={() => removeEntry(e.id)}>Retirer</button>
                  </span>
                </div>
                <span className="small muted">{macroLine(e)}</span>
                {editing === e.id && (
                  <NutrientEditor
                    entry={e}
                    onCancel={() => setEditing(null)}
                    onSave={(nutrients) => {
                      updateEntry(e.id, { nutrients });
                      setEditing(null);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}
