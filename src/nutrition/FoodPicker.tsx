import { useEffect, useState } from "react";
import { BarcodeScanner } from "./BarcodeScanner";
import { CookingToggle } from "./CookingToggle";
import { CreateFood } from "./CreateFood";
import {
  convertGrams,
  cookInfo,
  COOKING_LABEL,
  findBarcode,
  matchFoods,
  normalize,
  scale,
  searchOff,
  SOURCE_LABEL,
  type Cooking,
  type Food,
} from "./foods";
import type { JournalEntry, RecentFood, SavedMeal } from "./types";

type NewEntry = Pick<JournalEntry, "description" | "nutrients" | "food">;

interface Props {
  savedMeals: SavedMeal[];
  recentFoods: RecentFood[];
  customFoods: Food[];
  onCreateFood: (food: Omit<Food, "id" | "source">) => Food;
  onUseFood: (food: Food, grams: number) => void;
  onAdd: (entries: NewEntry[]) => void;
}

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export function FoodPicker({ savedMeals, recentFoods, customFoods, onCreateFood, onUseFood, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [off, setOff] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState(100);
  const [cooking, setCooking] = useState<Cooking>("raw");
  const [scanning, setScanning] = useState(false);
  const [notFound, setNotFound] = useState("");
  const [searchError, setSearchError] = useState(false);
  const [missingCode, setMissingCode] = useState("");
  const [creating, setCreating] = useState<{ name?: string; barcode?: string } | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setOff([]);
      return;
    }
    let stale = false;
    setSearching(true);
    setSearchError(false);
    const t = setTimeout(() => {
      searchOff(query)
        .then((r) => !stale && setOff(r))
        .catch(() => {
          if (stale) return;
          setOff([]);
          setSearchError(true);
        })
        .finally(() => !stale && setSearching(false));
    }, 400);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [query]);

  const meals = query.trim()
    ? savedMeals.filter((m) => normalize(m.name).includes(normalize(query)))
    : [];

  // Without a search: the last foods used. With one: the matching ones, before Open Food Facts.
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const recent = recentFoods
    .filter((r) => words.every((w) => normalize(r.food.name).includes(w)))
    .slice(0, query.trim() ? 5 : 8);
  const recentIds = new Set(recent.map((r) => r.food.id));
  const mine = matchFoods(customFoods, query).filter((f) => !recentIds.has(f.id));
  const offResults = off.filter((f) => !recentIds.has(f.id));

  const pick = (food: Food, lastGrams?: number) => {
    setPicked(food);
    setGrams(lastGrams ?? food.portionG ?? 100);
    setCooking(cookInfo(food)?.base ?? "raw");
  };

  const reset = () => {
    setPicked(null);
    setQuery("");
    setNotFound("");
    setMissingCode("");
  };

  const onCode = async (code: string) => {
    setScanning(false);
    const own = customFoods.find((f) => f.barcode === code);
    if (own) return pick(own);
    try {
      const food = await findBarcode(code);
      if (food) pick(food);
      else {
        setNotFound(`Aucun produit trouvé pour le code ${code}.`);
        setMissingCode(code);
      }
    } catch {
      setNotFound("Open Food Facts ne répond pas. Réessaie dans un instant.");
    }
  };

  if (creating) {
    return (
      <CreateFood
        name={creating.name}
        barcode={creating.barcode}
        onCancel={() => setCreating(null)}
        onCreate={(food) => {
          setCreating(null);
          setNotFound("");
          setMissingCode("");
          pick(onCreateFood(food));
        }}
      />
    );
  }

  if (picked) {
    // The values are for the food raw or cooked: convert the weighed grams to that state.
    const info = cookInfo(picked);
    const baseGrams = info ? convertGrams(info, grams, cooking, info.base) : grams;
    const n = scale(picked.per100g, baseGrams);
    const weight = info ? `${grams} g ${COOKING_LABEL[cooking]}` : `${grams} g`;
    return (
      <div className="stack">
        <div>
          <strong>{picked.name}</strong>
          {picked.brand && <span className="muted"> · {picked.brand}</span>}
          <div className="small muted">{SOURCE_LABEL[picked.source]}</div>
        </div>
        <label htmlFor="grams">Quantité (g)</label>
        <div className="row">
          <input
            id="grams"
            type="number"
            inputMode="numeric"
            min={1}
            value={grams}
            onChange={(e) => setGrams(Math.max(0, Number(e.target.value)))}
          />
          {[50, 100, 150, 200].map((g) => (
            <button key={g} type="button" className="chip" aria-pressed={grams === g} onClick={() => setGrams(g)}>
              {g}
            </button>
          ))}
        </div>
        {info && <CookingToggle info={info} grams={grams} value={cooking} onChange={setCooking} />}
        <p className="small muted">
          {fmt(n.kcal)} kcal · P {fmt(n.protein)} g · G {fmt(n.carbs)} g · L {fmt(n.fat)} g
        </p>
        <div className="row">
          <button
            className="primary"
            disabled={!grams}
            onClick={() => {
              onAdd([{ description: `${picked.name} (${weight})`, nutrients: n, food: { id: picked.id, grams: baseGrams } }]);
              onUseFood(picked, baseGrams);
              reset();
            }}
          >
            Ajouter
          </button>
          <button onClick={() => setPicked(null)}>Changer d'aliment</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row">
        <input
          id="food-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setNotFound("");
          }}
          placeholder="Cherche un aliment ou un repas"
          autoComplete="off"
        />
        <button type="button" onClick={() => setScanning((s) => !s)} aria-pressed={scanning}>
          Scanner
        </button>
      </div>
      {scanning && <BarcodeScanner onCode={onCode} onClose={() => setScanning(false)} />}
      {notFound && <p className="error small">{notFound}</p>}
      {missingCode && (
        <button onClick={() => setCreating({ barcode: missingCode })}>Créer cet aliment avec son code-barres</button>
      )}

      {recent.length > 0 && (
        <ResultGroup title={query.trim() ? "Déjà utilisés" : "Derniers aliments utilisés"}>
          {recent.map((r) => (
            <FoodResult key={r.food.id} food={r.food} grams={r.lastGrams} onPick={(f) => pick(f, r.lastGrams)} />
          ))}
        </ResultGroup>
      )}
      {mine.length > 0 && (
        <ResultGroup title="Mes aliments">
          {mine.map((f) => <FoodResult key={f.id} food={f} onPick={(x) => pick(x)} />)}
        </ResultGroup>
      )}
      {meals.length > 0 && (
        <ResultGroup title="Mes repas">
          {meals.map((m) => (
            <button key={m.id} className="result" onClick={() => { onAdd(m.items); reset(); }}>
              <span>{m.name}</span>
              <span className="small muted">
                {m.items.length} aliment{m.items.length > 1 ? "s" : ""} ·{" "}
                {fmt(m.items.reduce((s, i) => s + i.nutrients.kcal, 0))} kcal
              </span>
            </button>
          ))}
        </ResultGroup>
      )}
      {offResults.length > 0 && (
        <ResultGroup title="Aliments et produits (Open Food Facts)">
          {offResults.map((f) => <FoodResult key={f.id} food={f} onPick={(x) => pick(x)} />)}
        </ResultGroup>
      )}
      {query.trim() && searching && <p className="small muted">Recherche dans Open Food Facts…</p>}
      {query.trim() && !searching && searchError && (
        <p className="error small">Open Food Facts ne répond pas. Réessaie dans un instant.</p>
      )}
      {query.trim() && !searching && !searchError && !meals.length && !recent.length && !mine.length && !offResults.length && (
        <p className="small muted">Rien trouvé pour « {query} ». Essaie un autre mot ou scanne le code-barres.</p>
      )}
      {query.trim() && !searching && (
        <button className="link start" onClick={() => setCreating({ name: query.trim() })}>
          Pas le bon aliment ? Créer « {query.trim()} »
        </button>
      )}
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="stack tight">
      <span className="label">{title}</span>
      {children}
    </div>
  );
}

function FoodResult({ food, grams, onPick }: { food: Food; grams?: number; onPick: (f: Food) => void }) {
  return (
    <button className="result" onClick={() => onPick(food)}>
      <span>
        {food.name}
        {food.brand && <span className="muted"> · {food.brand}</span>}
      </span>
      <span className="small muted">
        {fmt(food.per100g.kcal)} kcal / 100 g{cookLabel(food)}{grams ? ` · dernière fois ${grams} g` : ""}
      </span>
    </button>
  );
}

/** " cru" or " cuit" after "100 g", for the foods whose weight changes when cooked. */
function cookLabel(food: Food) {
  const info = cookInfo(food);
  return info ? ` ${COOKING_LABEL[info.base]}` : "";
}
