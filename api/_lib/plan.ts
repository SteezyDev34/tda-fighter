import { z } from "zod";
import { MEAL_SLOT_IDS } from "./shared.js";

export const MealSchema = z.object({
  slot: z.enum(MEAL_SLOT_IDS),
  /** Advised time, "HH:MM". */
  time: z.string(),
  name: z.string(),
  ingredients: z.array(z.object({ item: z.string(), quantity: z.string(), grams: z.number(), search: z.string() })),
  apports: z.string(),
  steps: z.array(z.string()),
  why: z.string(),
});

/** When the user wakes up and trains, "HH:MM" (training empty if no fixed time). */
export interface Schedule {
  wake?: string;
  training?: string;
}

const HHMM = /^\d{2}:\d{2}$/;
const hour = (t: string) => t.replace(/^0/, "").replace(":", " h ").replace(/ h 00$/, " h");

/** Tells the AI when to place the meals, following the resources' timing rules. */
export function scheduleText(schedule: Schedule | undefined, training: boolean) {
  const wake = schedule?.wake && HHMM.test(schedule.wake) ? schedule.wake : "";
  const session = training && schedule?.training && HHMM.test(schedule.training) ? schedule.training : "";
  return `Horaires : ${wake ? `je me lève à ${hour(wake)}` : "heure de lever non précisée (prends 7 h)"}${
    training ? (session ? `, ma séance est à ${hour(session)}` : ", heure de séance non précisée") : ""
  }.
Dans "time", donne l'heure conseillée du repas au format HH:MM, en suivant les ressources :
- premier repas dans l'heure qui suit le lever, puis 2 à 5 h d'écart entre deux prises (journée type : 7 h, 9 h, 12 h, 15 h, 19 h, à décaler selon mon lever) ;${
    session
      ? `
- pas de gros repas dans l'heure qui précède la séance ; une prise avec un apport TP (ex. whey) dans l'heure ou les 2 h qui suivent ;
- si la séance est tôt le matin, elle peut se faire à jeun (clé « Wake up sport ») et le petit-déjeuner vient juste après ;
- dans "why", dis en quelques mots comment le repas se place par rapport à la séance.`
      : ""
  }`;
}

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
