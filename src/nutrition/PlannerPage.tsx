import { useState } from "react";
import { MealToJournal } from "./MealToJournal";
import { MEAL_SLOTS, slotLabel, type MealPlan, type MealSlot } from "./types";
import { recentJournal, type NutritionState } from "./useNutrition";

type Scope = "day" | MealSlot;
type DayType = "training" | "rest";

const DAY_TYPES: { id: DayType; label: string }[] = [
  { id: "training", label: "Jour d'entraînement" },
  { id: "rest", label: "Jour de repos" },
];

export function PlannerPage({ journal, profile, plan, setPlan, addEntries, rememberFood, customFoods }: NutritionState) {
  const [scope, setScope] = useState<Scope>("day");
  const [logging, setLogging] = useState<number | null>(null);
  const [dayType, setDayType] = useState<DayType>("training");
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
          dayType,
          profile,
          journal: recentJournal(journal),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPlan((await res.json()) as MealPlan);
      setLogging(null);
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
        <span className="label">Aujourd'hui, c'est un</span>
        <div className="row">
          {DAY_TYPES.map((d) => (
            <button key={d.id} type="button" className="chip" aria-pressed={dayType === d.id} onClick={() => setDayType(d.id)}>
              {d.label}
            </button>
          ))}
        </div>
        <button className="primary" onClick={generate} disabled={loading}>
          {loading ? "Je réfléchis…" : "Générer"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>

      {plan?.meals.map((m, i) => (
        <article key={i} className="card stack">
          <span className="label">{slotLabel(m.slot)}</span>
          <h2>{m.name}</h2>
          {m.apports && <span className="pill ok start">{m.apports}</span>}
          <p className="muted">{m.why}</p>
          <ul>
            {m.ingredients.map((ing, k) => (
              <li key={k}>{ing.quantity} {ing.item}</li>
            ))}
          </ul>
          <ol>
            {m.steps.map((s, k) => <li key={k}>{s}</li>)}
          </ol>
          {logging === i ? (
            <MealToJournal
              meal={m}
              customFoods={customFoods}
              onAdd={addEntries}
              onUseFood={rememberFood}
              onCancel={() => setLogging(null)}
              onDone={() => {
                setLogging(null);
                setPlan({ ...plan, meals: plan.meals.map((x, j) => (j === i ? { ...x, logged: true } : x)) });
              }}
            />
          ) : m.logged ? (
            <div className="row">
              <span className="pill ok">Ajouté au journal ✓</span>
              <button className="link" onClick={() => setLogging(i)}>L'ajouter à nouveau</button>
            </div>
          ) : (
            <button className="primary" onClick={() => setLogging(i)}>Ajouter au journal</button>
          )}
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
