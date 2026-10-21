import { NUTRIENTS, type NutritionProfile } from "./types";
import type { NutritionState } from "./useNutrition";

type TextField = Exclude<keyof NutritionProfile, "targets">;

const FIELDS: { key: TextField; label: string; placeholder: string }[] = [
  {
    key: "body",
    label: "Moi",
    placeholder: "Ex. : homme, 34 ans, 85 kg, 182 cm, sport 3 fois par semaine, protocole perte de poids",
  },
  { key: "goal", label: "Mon objectif", placeholder: "Ex. : plus d'énergie, perdre 3 kg, prendre du muscle" },
  { key: "likes", label: "J'aime", placeholder: "Ex. : poulet, riz, avocat, chocolat noir" },
  { key: "dislikes", label: "Je n'aime pas", placeholder: "Ex. : poisson, champignons" },
  { key: "allergies", label: "Allergies ou intolérances", placeholder: "Ex. : lactose" },
  { key: "budget", label: "Budget courses", placeholder: "Ex. : 60 € par semaine" },
  { key: "cookingTime", label: "Temps pour cuisiner", placeholder: "Ex. : 15 min max en semaine" },
];

export function ProfilePage({ profile, setProfile }: NutritionState) {
  return (
    <section className="stack">
      <h1>Mes critères</h1>
      <p className="muted">L'IA s'en sert pour chaque repas, chaque liste de courses et chaque réponse.</p>
      <div className="card stack">
        {FIELDS.map((f) => (
          <div key={f.key} className="stack tight">
            <label htmlFor={f.key}>{f.label}</label>
            <input
              id={f.key}
              value={profile[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setProfile({ ...profile, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="card stack">
        <h2>Objectifs journaliers</h2>
        <p className="muted small">Ils servent de repère au graphique du journal.</p>
        <div className="nutrient-grid">
          {NUTRIENTS.map(({ key, label, unit }) => (
            <label key={key} className="stack tight">
              <span className="small muted">{label} ({unit})</span>
              <input
                id={`target-${key}`}
                type="number"
                inputMode="numeric"
                min={0}
                value={profile.targets[key]}
                onChange={(e) =>
                  setProfile({ ...profile, targets: { ...profile.targets, [key]: Number(e.target.value) } })
                }
              />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
