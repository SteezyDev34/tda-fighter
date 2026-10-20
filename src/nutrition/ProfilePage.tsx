import type { NutritionProfile } from "./types";
import type { NutritionState } from "./useNutrition";

const FIELDS: { key: keyof NutritionProfile; label: string; placeholder: string }[] = [
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
    </section>
  );
}
