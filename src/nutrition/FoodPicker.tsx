import { useEffect, useRef, useState } from "react";
import { findBarcode, normalize, scale, searchCiqual, searchOff, SOURCE_LABEL, type Food } from "./foods";
import type { JournalEntry, SavedMeal } from "./types";

type NewEntry = Pick<JournalEntry, "description" | "nutrients" | "food">;

interface Props {
  savedMeals: SavedMeal[];
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

export function FoodPicker({ savedMeals, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [ciqual, setCiqual] = useState<Food[]>([]);
  const [off, setOff] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState(100);
  const [scanning, setScanning] = useState(false);
  const [notFound, setNotFound] = useState("");

  useEffect(() => {
    if (!query.trim()) {
      setCiqual([]);
      setOff([]);
      return;
    }
    let stale = false;
    searchCiqual(query).then((r) => !stale && setCiqual(r));
    setSearching(true);
    const t = setTimeout(() => {
      searchOff(query).then((r) => {
        if (stale) return;
        setOff(r);
        setSearching(false);
      });
    }, 400);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [query]);

  const meals = query.trim()
    ? savedMeals.filter((m) => normalize(m.name).includes(normalize(query)))
    : [];

  const pick = (food: Food) => {
    setPicked(food);
    setGrams(food.portionG ?? 100);
  };

  const reset = () => {
    setPicked(null);
    setQuery("");
    setNotFound("");
  };

  const onCode = async (code: string) => {
    setScanning(false);
    const food = await findBarcode(code);
    if (food) pick(food);
    else setNotFound(`Aucun produit trouvé pour le code ${code}. Cherche-le par son nom.`);
  };

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
      {ciqual.length > 0 && (
        <ResultGroup title="Aliments (Ciqual)">
          {ciqual.map((f) => <FoodResult key={f.id} food={f} onPick={pick} />)}
        </ResultGroup>
      )}
      {off.length > 0 && (
        <ResultGroup title="Produits du commerce (Open Food Facts)">
          {off.map((f) => <FoodResult key={f.id} food={f} onPick={pick} />)}
        </ResultGroup>
      )}
      {query.trim() && searching && <p className="small muted">Recherche des produits du commerce…</p>}
      {query.trim() && !searching && !meals.length && !ciqual.length && !off.length && (
        <p className="small muted">Rien trouvé pour « {query} ». Essaie un mot plus simple, par exemple « riz » ou « yaourt ».</p>
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

function FoodResult({ food, onPick }: { food: Food; onPick: (f: Food) => void }) {
  return (
    <button className="result" onClick={() => onPick(food)}>
      <span>
        {food.name}
        {food.brand && <span className="muted"> · {food.brand}</span>}
      </span>
      <span className="small muted">{fmt(food.per100g.kcal)} kcal / 100 g</span>
    </button>
  );
}
