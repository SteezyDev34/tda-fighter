import { z } from "zod";
import { MEAL_SLOT_IDS } from "./shared.js";

export const MealSchema = z.object({
  slot: z.enum(MEAL_SLOT_IDS),
  name: z.string(),
  ingredients: z.array(z.object({ item: z.string(), quantity: z.string(), grams: z.number(), search: z.string() })),
  apports: z.string(),
  steps: z.array(z.string()),
  why: z.string(),
});

export const ShoppingSchema = z.array(z.object({ item: z.string(), quantity: z.string(), aisle: z.string() }));

/** How meals are built from the resources: shared by the meal and the week generators. */
export const METHOD = `Suis la méthode des ressources :
- calcule mes besoins et mon profil (métabolisme basal × facteur d'activité) avec mes critères « moi » ; s'ils manquent, prends mes objectifs journaliers en kcal ;
- applique le protocole que je suis (perte de poids par défaut) pour savoir combien d'apports TP, BH, MM et E je dois avoir sur la journée, et répartis-les entre les repas demandés ;
- choisis les aliments dans les listes de courses des ressources et donne les quantités exactes de « 1 apport » (version homme ou femme selon mon sexe) ;
- ajoute les aliments brûle graisses imposés au déjeuner et au dîner, et les fruits ou crudités du mois en cours pour les apports E.
Pour chaque ingrédient : "quantity" est la quantité lisible (ex. « 1 poignée »), "grams" son poids en grammes (ex. 30),
"search" un nom simple et générique pour le trouver dans Open Food Facts (ex. « amandes », « blanc de poulet », « riz basmati »).
Dans "apports", écris les apports du repas, par exemple « 2 TP + 1 BH + 1 MM + BG ».
Varie par rapport à ce que j'ai mangé ces derniers jours et respecte mes goûts, allergies, budget et temps.`;
