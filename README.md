# TDA Fighter

Assistant quotidien pour les personnes TDAH : tâches, sport et nutrition.
Application web installable (PWA) : React + Vite côté interface, fonctions serverless (Vercel) pour l'IA.

## Module Nutrition (MVP)

- **Journal** : 5 repas par jour (petit-déjeuner, collation du matin, déjeuner, collation de l'après-midi, dîner), saisie en une ligne.
- **Repas et courses** : l'IA propose un repas ou une journée complète à partir du journal, des critères et des ressources, puis génère la liste de courses par rayon.
- **Coach** : chat nutrition (ex. « j'ai une fringale, qu'est-ce que je peux manger ? »).
- **Critères** : objectif, goûts, allergies, budget, temps de cuisine.

## Base de connaissances

L'IA lit tous les fichiers `.md` du dossier Google Drive « TDA Fighter - Nutrition ».
Le dossier doit être partagé (lecteur) avec l'adresse e-mail du compte de service Google.
Les fichiers sont relus toutes les 10 minutes.

## Lancer en local

```bash
npm install
cp .env.example .env   # puis remplir les valeurs
npx vercel dev         # interface + API sur http://localhost:3000
```

`npm run dev` lance seulement l'interface (sans l'IA).

## Structure

- `src/nutrition/` : écrans et état du module nutrition
- `api/chat.ts` : coach nutrition (réponse en streaming)
- `api/meal-plan.ts` : génération de repas et de la liste de courses
- `api/_lib/knowledge.ts` : lecture des `.md` depuis Google Drive
