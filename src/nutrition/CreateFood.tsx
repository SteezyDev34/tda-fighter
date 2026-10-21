import { useState } from "react";
import { BarcodeScanner } from "./BarcodeScanner";
import type { Food } from "./foods";
import { NUTRIENTS, type Nutrients } from "./types";

interface Props {
  name?: string;
  barcode?: string;
  onCreate: (food: Omit<Food, "id" | "source">) => void;
  onCancel: () => void;
}

/** Creates a food from the values printed on its label, per 100 g. */
export function CreateFood({ name: initialName = "", barcode: initialBarcode = "", onCreate, onCancel }: Props) {
  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState(initialBarcode);
  const [scanning, setScanning] = useState(false);
  const [values, setValues] = useState<Record<keyof Nutrients, string>>({ kcal: "", protein: "", carbs: "", fat: "" });

  const num = (v: string) => Number(v.replace(",", "."));
  const numbers: Nutrients = {
    kcal: num(values.kcal),
    protein: num(values.protein),
    carbs: num(values.carbs),
    fat: num(values.fat),
  };
  const valid = name.trim() && Object.values(values).every((v) => v.trim() !== "") && Object.values(numbers).every((n) => Number.isFinite(n) && n >= 0);

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onCreate({
          name: name.trim(),
          ...(brand.trim() && { brand: brand.trim() }),
          ...(barcode.trim() && { barcode: barcode.trim() }),
          per100g: numbers,
        });
      }}
    >
      <strong>Créer un aliment</strong>
      <p className="small muted">Recopie les valeurs « pour 100 g » de l'étiquette.</p>
      <label htmlFor="new-food-name">Nom</label>
      <input id="new-food-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Skyr nature" autoFocus />
      <label htmlFor="new-food-brand">Marque (facultatif)</label>
      <input id="new-food-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
      <label htmlFor="new-food-barcode">Code-barres du produit</label>
      <div className="row">
        <input
          id="new-food-barcode"
          inputMode="numeric"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Scanne le produit"
        />
        <button type="button" onClick={() => setScanning((v) => !v)} aria-pressed={scanning}>Scanner</button>
      </div>
      {scanning && (
        <BarcodeScanner
          typing={false}
          onCode={(code) => {
            setBarcode(code);
            setScanning(false);
          }}
          onClose={() => setScanning(false)}
        />
      )}
      <div className="nutrient-grid">
        {NUTRIENTS.map(({ key, label, unit }) => (
          <label key={key} className="stack tight">
            <span className="small muted">{label} ({unit} / 100 g)</span>
            <input
              inputMode="decimal"
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="row">
        <button className="primary" disabled={!valid}>Enregistrer l'aliment</button>
        <button type="button" onClick={onCancel}>Annuler</button>
      </div>
      <p className="small muted">
        Tu peux aussi l'ajouter à{" "}
        <a href="https://fr.openfoodfacts.org/contribuer" target="_blank" rel="noreferrer">Open Food Facts</a>{" "}
        avec leur app (scan et photo de l'étiquette) : il sera disponible pour tout le monde.
      </p>
    </form>
  );
}
