import { useState } from "react";
import { today } from "../lib/storage";
import { MEAL_SLOTS, slotLabel, type MealPlan, type MealSlot } from "./types";
import { recentJournal, type NutritionState } from "./useNutrition";

type Scope = "day" | MealSlot;

export function PlannerPage({ journal, profile, plan, setPlan, addEntry }: NutritionState) {
  const [scope, setScope] = useState<Scope>("day");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slots: scope === "day" ? MEAL_SLOTS.map((s) => s.id) : [scope],
          profile,
          journal: recentJournal(journal),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPlan((await res.json()) as MealPlan);
    } catch (e) {
      setError(`La génération a échoué. Réessaie dans un instant. (${(e as Error).message})`);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (i: number) =>
    plan &&
    setPlan({
      ...plan,
      shopping: plan.shopping.map((s, j) => (j === i ? { ...s, checked: !s.checked } : s)),
    });

  const aisles = plan ? [...new Set(plan.shopping.map((s) => s.aisle))] : [];

  return (
    <section className="stack">
      <h1>Repas et courses</h1>
      <div className="card stack">
        <label htmlFor="scope">Je veux des idées pour</label>
        <select id="scope" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
          <option value="day">Toute la journée (5 repas)</option>
          {MEAL_SLOTS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <button className="primary" onClick={generate} disabled={loading}>
          {loading ? "Je réfléchis…" : "Générer"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>

      {plan?.meals.map((m, i) => (
        <article key={i} className="card stack">
          <span className="label">{slotLabel(m.slot)}</span>
          <h2>{m.name}</h2>
          <p className="muted">{m.why}</p>
          <ul>
            {m.ingredients.map((ing, k) => (
              <li key={k}>{ing.quantity} {ing.item}</li>
            ))}
          </ul>
          <ol>
            {m.steps.map((s, k) => <li key={k}>{s}</li>)}
          </ol>
          <button onClick={() => addEntry({ date: today(), slot: m.slot, description: m.name })}>
            Je l'ai mangé
          </button>
        </article>
      ))}

      {plan && plan.shopping.length > 0 && (
        <div className="card stack">
          <h2>Liste de courses</h2>
          {aisles.map((aisle) => (
            <div key={aisle}>
              <span className="label">{aisle}</span>
              {plan.shopping.map((s, i) =>
                s.aisle === aisle ? (
                  <label key={i} className={`row check ${s.checked ? "done" : ""}`}>
                    <input type="checkbox" checked={s.checked} onChange={() => toggle(i)} />
                    <span>{s.quantity} {s.item}</span>
                  </label>
                ) : null,
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
