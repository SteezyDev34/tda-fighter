import { useEffect, useState } from "react";
import { today } from "../lib/storage";
import { CookingToggle } from "./CookingToggle";
import { convertGrams, cookInfo, COOKING_LABEL, matchFoods, scale, searchOff, type Cooking, type Food } from "./foods";
import { MEAL_SLOTS, type JournalEntry, type LoggedMeal, type MealSlot, type SuggestedMeal } from "./types";

interface Row {
  item: string;
  quantity: string;
  options: Food[];
  foodId: string;
  grams: number;
  /** Whether the grams are weighed raw or cooked (the resources give cooked weights). */
  cooking: Cooking;
  include: boolean;
}

interface Props {
  meal: SuggestedMeal;
  /** Day of the journal the meal goes to (today by default). */
  date?: string;
  customFoods: Food[];
  onAdd: (entries: Omit<JournalEntry, "id" | "createdAt">[]) => void;
  /** Keeps the recipe and explanation with the journal lines. */
  onKeepMeal: (meal: LoggedMeal) => void;
  onUseFood: (food: Food, grams: number) => void;
  onDone: () => void;
  onCancel: () => void;
}

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });

/**
 * Logs a suggested meal: each ingredient is matched to an Open Food Facts product,
 * so the nutrients come from the database, never from the AI. The user checks the
 * product and the grams before adding.
 */
export function MealToJournal({ meal, date: suggestedDate, customFoods, onKeepMeal, onAdd, onUseFood, onDone, onCancel }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [date, setDate] = useState(suggestedDate ?? today());
  const [slot, setSlot] = useState<MealSlot>(meal.slot);

  useEffect(() => {
    let stale = false;
    Promise.all(
      meal.ingredients.map(async (ing) => {
        const query = ing.search ?? ing.item;
        const options = [
          ...matchFoods(customFoods, query),
          ...(await searchOff(query).catch(() => [])),
        ].slice(0, 6);
        return {
          item: ing.item,
          quantity: ing.quantity,
          options,
          foodId: options[0]?.id ?? "",
          grams: Math.round(ing.grams ?? 100),
          cooking: "cooked" as Cooking,
          include: options.length > 0,
        };
      }),
    ).then((r) => !stale && setRows(r));
    return () => {
      stale = true;
    };
    // customFoods only matter when the matching starts, not on later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meal]);

  if (!rows) return <p className="small muted">Je cherche les aliments dans Open Food Facts…</p>;

  const update = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const chosen = rows
    .filter((r) => r.include && r.grams > 0)
    .map((r) => ({ row: r, food: r.options.find((f) => f.id === r.foodId)! }))
    .filter((c) => c.food)
    .map((c) => {
      // The product's values are for the food raw or cooked: convert the weighed grams to that state.
      const info = cookInfo(c.food);
      const baseGrams = info ? convertGrams(info, c.row.grams, c.row.cooking, info.base) : c.row.grams;
      const weight = info ? `${c.row.grams} g ${COOKING_LABEL[c.row.cooking]}` : `${c.row.grams} g`;
      return { ...c, baseGrams, weight, nutrients: scale(c.food.per100g, baseGrams) };
    });
  const kcal = chosen.reduce((s, c) => s + c.nutrients.kcal, 0);

  const add = () => {
    const fromMeal = crypto.randomUUID();
    onKeepMeal({ id: fromMeal, meal });
    onAdd(
      chosen.map(({ food, baseGrams, weight, nutrients }) => ({
        date,
        slot,
        fromMeal,
        description: `${food.name} (${weight})`,
        nutrients,
        food: { id: food.id, grams: baseGrams },
      })),
    );
    chosen.forEach(({ food, baseGrams }) => onUseFood(food, baseGrams));
    onDone();
  };

  return (
    <div className="stack">
      <p className="small muted">Vérifie le produit et la quantité de chaque aliment, puis ajoute.</p>
      <div className="row">
        <input
          type="date"
          aria-label="Jour du journal"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
        <select aria-label="Repas du journal" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
          {MEAL_SLOTS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>
      {rows.map((r, i) => {
        const food = r.options.find((f) => f.id === r.foodId);
        const info = food ? cookInfo(food) : null;
        return (
        <div key={i} className="entry stack tight">
          <label className="row">
            <input
              type="checkbox"
              checked={r.include}
              disabled={!r.options.length}
              onChange={(e) => update(i, { include: e.target.checked })}
            />
            <strong>{r.item}</strong>
            <span className="small muted">{r.quantity}</span>
          </label>
          {r.options.length ? (
            <div className="row">
              <select
                aria-label={`Produit pour ${r.item}`}
                value={r.foodId}
                onChange={(e) => update(i, { foodId: e.target.value })}
              >
                {r.options.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}{f.brand ? ` · ${f.brand}` : ""} ({fmt(f.per100g.kcal)} kcal/100 g
                    {cookInfo(f) ? ` ${COOKING_LABEL[cookInfo(f)!.base]}` : ""})
                  </option>
                ))}
              </select>
              <input
                className="grams"
                type="number"
                inputMode="numeric"
                min={0}
                aria-label={`Grammes de ${r.item}`}
                value={r.grams}
                onChange={(e) => update(i, { grams: Math.max(0, Number(e.target.value)) })}
              />
              <span className="small muted">g</span>
            </div>
          ) : (
            <span className="small muted">Pas trouvé dans Open Food Facts : ajoute-le depuis le Journal.</span>
          )}
          {info && (
            <CookingToggle
              info={info}
              grams={r.grams}
              value={r.cooking}
              // Same portion in the other state: 200 g cooked rice becomes 80 g raw.
              onChange={(c) => update(i, { cooking: c, grams: convertGrams(info, r.grams, r.cooking, c) })}
            />
          )}
        </div>
        );
      })}
      <div className="row">
        <button className="primary" disabled={!chosen.length} onClick={add}>
          Ajouter {chosen.length} aliment{chosen.length > 1 ? "s" : ""} ({fmt(kcal)} kcal)
        </button>
        <button onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}
