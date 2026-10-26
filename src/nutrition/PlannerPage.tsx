import { useState } from "react";
import { shiftDate, today } from "../lib/storage";
import type { Food } from "./foods";
import { MealToJournal } from "./MealToJournal";
import { MEAL_SLOTS, slotLabel, type JournalEntry, type MealPlan, type MealSlot, type SuggestedMeal } from "./types";
import { recentJournal, usePersisted, type NutritionState } from "./useNutrition";

type Scope = "week" | "day" | MealSlot;
type DayType = "training" | "rest";

const DAY_TYPES: { id: DayType; label: string }[] = [
  { id: "training", label: "Jour d'entraînement" },
  { id: "rest", label: "Jour de repos" },
];

const weekday = (date: string, style: "long" | "short" = "long") =>
  new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: style });
const dayTitle = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

interface MealCardProps {
  meal: SuggestedMeal;
  date?: string;
  logged: boolean;
  onLogged: () => void;
  customFoods: Food[];
  addEntries: (entries: Omit<JournalEntry, "id" | "createdAt">[]) => void;
  rememberFood: (food: Food, grams: number) => void;
}

function MealCard({ meal: m, date, logged, onLogged, customFoods, addEntries, rememberFood }: MealCardProps) {
  const [logging, setLogging] = useState(false);
  return (
    <article className="card stack">
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
      {logging ? (
        <MealToJournal
          meal={m}
          date={date}
          customFoods={customFoods}
          onAdd={addEntries}
          onUseFood={rememberFood}
          onCancel={() => setLogging(false)}
          onDone={() => {
            setLogging(false);
            onLogged();
          }}
        />
      ) : logged ? (
        <div className="row">
          <span className="pill ok">Ajouté au journal ✓</span>
          <button className="link" onClick={() => setLogging(true)}>L'ajouter à nouveau</button>
        </div>
      ) : (
        <button className="primary" onClick={() => setLogging(true)}>Ajouter au journal</button>
      )}
    </article>
  );
}

/** Generated plans kept on the device, newest first. */
const MAX_PLANS = 30;

const planWhen = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export function PlannerPage({ journal, profile, plan, setPlan: setCurrent, addEntries, rememberFood, customFoods }: NutritionState) {
  const [history, setHistory] = usePersisted<MealPlan[]>("plan-history", plan ? [{ ...plan, id: plan.id ?? "ancien", label: plan.label ?? "Plan précédent" }] : []);
  const [showHistory, setShowHistory] = useState(false);
  /** Changes to the open plan (ticked shopping, logged meals) are kept in the history too. */
  const setPlan = (p: MealPlan) => {
    setCurrent(p);
    if (p.id) setHistory((h) => h.map((x) => (x.id === p.id ? p : x)));
  };
  const [scope, setScope] = useState<Scope>("day");
  const [dayType, setDayType] = useState<DayType>("training");
  // The week starts today; training days are picked by weekday.
  const weekDates = Array.from({ length: 7 }, (_, i) => shiftDate(today(), i));
  const [trainingDays, setTrainingDays] = usePersisted<string[]>("training-days", []);
  const [selectedDay, setSelectedDay] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res =
        scope === "week"
          ? await fetch("/api/week-plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                days: weekDates.map((d) => ({ date: d, weekday: weekday(d), training: trainingDays.includes(weekday(d)) })),
                profile,
                journal: recentJournal(journal),
              }),
            })
          : await fetch("/api/meal-plan", {
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
      const label =
        scope === "week" ? "Toute la semaine" : scope === "day" ? "Toute la journée" : slotLabel(scope);
      const created: MealPlan = {
        ...((await res.json()) as MealPlan),
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        label,
      };
      setHistory((h) => [created, ...h].slice(0, MAX_PLANS));
      setCurrent(created);
      setSelectedDay(0);
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
  const week = plan?.week;
  const day = week?.days[selectedDay];
  const dayPlan = day ? week.types[day.type] : undefined;
  const cardProps = { customFoods, addEntries, rememberFood };

  return (
    <section className="stack">
      <h1>Repas et courses</h1>
      <div className="card stack">
        <label htmlFor="scope">Je veux des idées pour</label>
        <select id="scope" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
          <option value="week">Toute la semaine (journées types)</option>
          <option value="day">Toute la journée (5 repas)</option>
          {MEAL_SLOTS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        {scope === "week" ? (
          <>
            <span className="label">Mes jours d'entraînement</span>
            <div className="agenda-week">
              {weekDates.map((d) => {
                const name = weekday(d);
                const on = trainingDays.includes(name);
                return (
                  <button
                    key={d}
                    type="button"
                    className="agenda-day"
                    aria-pressed={on}
                    aria-label={`${name} : ${on ? "entraînement" : "repos"}`}
                    onClick={() => setTrainingDays(on ? trainingDays.filter((x) => x !== name) : [...trainingDays, name])}
                  >
                    <strong>{weekday(d, "short").replace(".", "")}</strong>
                    <span className="small muted">{on ? "Sport" : "Repos"}</span>
                  </button>
                );
              })}
            </div>
            <p className="small muted">La génération d'une semaine peut prendre une à deux minutes.</p>
          </>
        ) : (
          <>
            <span className="label">Aujourd'hui, c'est un</span>
            <div className="row">
              {DAY_TYPES.map((d) => (
                <button key={d.id} type="button" className="chip" aria-pressed={dayType === d.id} onClick={() => setDayType(d.id)}>
                  {d.label}
                </button>
              ))}
            </div>
          </>
        )}
        <button className="primary" onClick={generate} disabled={loading}>
          {loading ? "Je réfléchis…" : "Générer"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>

      {history.length > 0 && (
        <div className="card stack tight">
          <button className="link start" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
            {showHistory ? "Masquer" : "Voir"} mes plans précédents ({history.length})
          </button>
          {showHistory &&
            history.map((h) => (
              <div key={h.id} className="row">
                <button
                  className="result"
                  aria-current={h.id === plan?.id}
                  onClick={() => {
                    setCurrent(h);
                    setSelectedDay(0);
                    setShowHistory(false);
                  }}
                >
                  <span>
                    {h.label ?? "Plan"}
                    {h.id === plan?.id ? " (ouvert)" : ""}
                  </span>
                  <span className="small muted">
                    {planWhen(h.createdAt)}
                    {h.createdAt ? " · " : ""}
                    {(h.week ? h.week.types.flatMap((t) => t.meals) : h.meals)
                      .map((m) => m.name)
                      .slice(0, 3)
                      .join(", ")}
                  </span>
                </button>
                <button
                  className="link"
                  aria-label={`Supprimer le plan ${h.label ?? ""}`}
                  onClick={() => setHistory((all) => all.filter((x) => x.id !== h.id))}
                >
                  Supprimer
                </button>
              </div>
            ))}
        </div>
      )}

      {week && (
        <div className="card stack tight">
          <span className="label">Ma semaine</span>
          <div className="agenda-week">
            {week.days.map((d, i) => (
              <button key={d.date} className="agenda-day" aria-pressed={i === selectedDay} onClick={() => setSelectedDay(i)}>
                <span className="small muted">{weekday(d.date, "short").replace(".", "")}</span>
                <strong>{Number(d.date.slice(8))}</strong>
                <span className="small muted">J{d.type + 1}</span>
              </button>
            ))}
          </div>
          {day && dayPlan && (
            <p className="small muted">
              <span className="agenda-title">{dayTitle(day.date)}</span> · {dayPlan.name}
            </p>
          )}
        </div>
      )}

      {day && dayPlan &&
        dayPlan.meals.map((m) => {
          const key = `${day.date}|${m.slot}`;
          return (
            <MealCard
              key={key}
              meal={m}
              date={day.date}
              logged={week!.logged.includes(key)}
              onLogged={() => setPlan({ ...plan!, week: { ...week!, logged: [...week!.logged, key] } })}
              {...cardProps}
            />
          );
        })}

      {!week &&
        plan?.meals.map((m, i) => (
          <MealCard
            key={`${plan.id}-${i}`}
            meal={m}
            logged={!!m.logged}
            onLogged={() => setPlan({ ...plan, meals: plan.meals.map((x, j) => (j === i ? { ...x, logged: true } : x)) })}
            {...cardProps}
          />
        ))}

      {plan && plan.shopping.length > 0 && (
        <div className="card stack">
          <h2>Liste de courses{week ? " de la semaine" : ""}</h2>
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
