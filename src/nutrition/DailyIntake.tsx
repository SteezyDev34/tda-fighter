import { useState } from "react";
import { NUTRIENTS, slotLabel, type JournalEntry, type Nutrients } from "./types";

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

/**
 * One meter per nutrient: eaten today vs the daily target.
 * Hover or tap a meter to see how each meal contributed.
 */
export function DailyIntake({ entries, targets }: { entries: JournalEntry[]; targets: Nutrients }) {
  const [open, setOpen] = useState<keyof Nutrients | null>(null);
  const counted = entries;
  const total = (key: keyof Nutrients) =>
    counted.reduce((sum, e) => sum + e.nutrients[key], 0);

  return (
    <div className="card stack" aria-label="Apports du jour">
      <div className="row between">
        <h2>Apports du jour</h2>
        <span className="muted small">{counted.length} aliment{counted.length > 1 ? "s" : ""} compté{counted.length > 1 ? "s" : ""}</span>
      </div>
      {NUTRIENTS.map(({ key, label, unit }) => {
        const eaten = total(key);
        const target = targets[key] || 1;
        const pct = Math.min(eaten / target, 1) * 100;
        const over = eaten > target;
        const left = Math.max(target - eaten, 0);
        return (
          <button
            key={key}
            className="meter"
            aria-expanded={open === key}
            onClick={() => setOpen(open === key ? null : key)}
            onMouseEnter={() => setOpen(key)}
            onMouseLeave={() => setOpen(null)}
          >
            <span className="row between">
              <span className="meter-label">{label}</span>
              <span className="meter-value">
                <strong>{fmt(eaten)}</strong> / {fmt(target)} {unit}
              </span>
            </span>
            <span className="meter-track" role="meter" aria-valuemin={0} aria-valuemax={target} aria-valuenow={eaten} aria-label={label}>
              <span className="meter-fill" style={{ width: `${pct}%` }} />
            </span>
            <span className={`meter-note ${over ? "over" : ""}`}>
              {over ? `Objectif dépassé de ${fmt(eaten - target)} ${unit}` : `Encore ${fmt(left)} ${unit}`}
            </span>
            {open === key && counted.length > 0 && (
              <span className="meter-detail">
                {counted.map((e) => (
                  <span key={e.id} className="row between">
                    <span>{slotLabel(e.slot)} · {e.description}</span>
                    <span>{fmt(e.nutrients[key])} {unit}</span>
                  </span>
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
