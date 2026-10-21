import { useEffect, useState } from "react";
import { today } from "../lib/storage";
import { scale, searchOff, type Food } from "./foods";
import { slotLabel, type JournalEntry, type SuggestedMeal } from "./types";

interface Row {
  item: string;
  quantity: string;
  options: Food[];
  foodId: string;
  grams: number;
  include: boolean;
}

interface Props {
  meal: SuggestedMeal;
  onAdd: (entries: Omit<JournalEntry, "id" | "createdAt">[]) => void;
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
export function MealToJournal({ meal, onAdd, onUseFood, onDone, onCancel }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let stale = false;
    Promise.all(
      meal.ingredients.map(async (ing) => {
        const options = (await searchOff(ing.search ?? ing.item).catch(() => [])).slice(0, 6);
        return {
          item: ing.item,
          quantity: ing.quantity,
          options,
          foodId: options[0]?.id ?? "",
          grams: Math.round(ing.grams ?? 100),
          include: options.length > 0,
        };
      }),
    ).then((r) => !stale && setRows(r));
    return () => {
      stale = true;
    };
  }, [meal]);

  if (!rows) return <p className="small muted">Je cherche les aliments dans Open Food Facts…</p>;

  const update = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const chosen = rows
    .filter((r) => r.include && r.grams > 0)
    .map((r) => ({ row: r, food: r.options.find((f) => f.id === r.foodId)! }))
    .filter((c) => c.food);
  const kcal = chosen.reduce((s, c) => s + scale(c.food.per100g, c.row.grams).kcal, 0);

  const add = () => {
    onAdd(
      chosen.map(({ row, food }) => ({
        date: today(),
        slot: meal.slot,
        description: `${food.name} (${row.grams} g)`,
        nutrients: scale(food.per100g, row.grams),
        food: { id: food.id, grams: row.grams },
      })),
    );
    chosen.forEach(({ row, food }) => onUseFood(food, row.grams));
    onDone();
  };

  return (
    <div className="stack">
      <p className="small muted">Vérifie le produit et la quantité de chaque aliment, puis ajoute.</p>
      {rows.map((r, i) => (
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
                    {f.name}{f.brand ? ` · ${f.brand}` : ""} ({fmt(f.per100g.kcal)} kcal/100 g)
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
        </div>
      ))}
      <div className="row">
        <button className="primary" disabled={!chosen.length} onClick={add}>
          Ajouter {chosen.length} aliment{chosen.length > 1 ? "s" : ""} ({fmt(kcal)} kcal) · {slotLabel(meal.slot)}
        </button>
        <button onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}
