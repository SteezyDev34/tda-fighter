import { useEffect, useRef, useState } from "react";
import { CreateFood } from "./CreateFood";
import { findBarcode, matchFoods, normalize, scale, searchOff, SOURCE_LABEL, type Food } from "./foods";
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

// BarcodeDetector is not in the TS DOM lib yet (Chrome / Android only).
type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
const BarcodeDetectorCtor = (globalThis as unknown as {
  BarcodeDetector?: new (o: { formats: string[] }) => Detector;
}).BarcodeDetector;

/** Camera scan when the browser supports it, otherwise the code is typed. */
function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [typed, setTyped] = useState("");
  const [cameraError, setCameraError] = useState(!BarcodeDetectorCtor);

  useEffect(() => {
    if (!BarcodeDetectorCtor) return;
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    const detector = new BarcodeDetectorCtor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (!video.current) return;
        video.current.srcObject = s;
        void video.current.play();
        timer = window.setInterval(async () => {
          if (!video.current) return;
          const [hit] = await detector.detect(video.current).catch(() => []);
          if (hit) onCode(hit.rawValue);
        }, 400);
      })
      .catch(() => setCameraError(true));
    return () => {
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="stack scanner">
      {!cameraError && <video ref={video} className="scanner-video" muted playsInline />}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) onCode(typed.trim());
        }}
      >
        <input
          id="barcode"
          inputMode="numeric"
          placeholder={cameraError ? "Tape le code-barres" : "Ou tape le code-barres"}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button className="primary">Chercher</button>
      </form>
      <button onClick={onClose}>Fermer le scanner</button>
    </div>
  );
}

export function FoodPicker({ savedMeals, recentFoods, customFoods, onCreateFood, onUseFood, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [off, setOff] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState(100);
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
    const n = scale(picked.per100g, grams);
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
        <p className="small muted">
          {fmt(n.kcal)} kcal · P {fmt(n.protein)} g · G {fmt(n.carbs)} g · L {fmt(n.fat)} g
        </p>
        <div className="row">
          <button
            className="primary"
            disabled={!grams}
            onClick={() => {
              onAdd([{ description: `${picked.name} (${grams} g)`, nutrients: n, food: { id: picked.id, grams } }]);
              onUseFood(picked, grams);
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
        {fmt(food.per100g.kcal)} kcal / 100 g{grams ? ` · dernière fois ${grams} g` : ""}
      </span>
    </button>
  );
}
