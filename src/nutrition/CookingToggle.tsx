import { COOKING_LABEL, convertGrams, type CookInfo, type Cooking } from "./foods";

interface Props {
  info: CookInfo;
  grams: number;
  value: Cooking;
  onChange: (cooking: Cooking) => void;
}

/** Says whether the grams are weighed raw or cooked, and the same portion in the other state. */
export function CookingToggle({ info, grams, value, onChange }: Props) {
  const other: Cooking = value === "raw" ? "cooked" : "raw";
  return (
    <div className="row">
      <span className="small muted">Poids</span>
      {(["raw", "cooked"] as const).map((c) => (
        <button key={c} type="button" className="chip" aria-pressed={value === c} onClick={() => onChange(c)}>
          {COOKING_LABEL[c]}
        </button>
      ))}
      {grams > 0 && (
        <span className="small muted">
          ≈ {convertGrams(info, grams, value, other)} g {COOKING_LABEL[other]}
        </span>
      )}
    </div>
  );
}
