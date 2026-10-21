import type { VercelRequest, VercelResponse } from "@vercel/node";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { MealSlot } from "../src/nutrition/types";
import { buildSystem, client, MODEL } from "./_lib/claude.js";
import { MEAL_SLOT_IDS, slotLabel } from "./_lib/shared.js";

const PlanSchema = z.object({
  meals: z.array(
    z.object({
      slot: z.enum(MEAL_SLOT_IDS),
      name: z.string(),
      ingredients: z.array(
        z.object({ item: z.string(), quantity: z.string(), grams: z.number(), search: z.string() }),
      ),
      apports: z.string(),
      steps: z.array(z.string()),
      why: z.string(),
    }),
  ),
  shopping: z.array(z.object({ item: z.string(), quantity: z.string(), aisle: z.string() })),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("POST uniquement");
  const { slots, profile, journal } = req.body as {
    slots: MealSlot[];
    profile: Parameters<typeof buildSystem>[0];
    journal: Parameters<typeof buildSystem>[1];
  };

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(PlanSchema) },
      system: await buildSystem(profile, journal),
      messages: [
        {
          role: "user",
          content: `Propose un repas pour : ${slots.map(slotLabel).join(", ")}.
Suis la méthode des ressources :
- calcule mes besoins et mon profil (métabolisme basal × facteur d'activité) avec mes critères « moi » ; s'ils manquent, prends mes objectifs journaliers en kcal ;
- applique le protocole que je suis (perte de poids par défaut) pour savoir combien d'apports TP, BH, MM et E je dois avoir sur la journée, et répartis-les entre les repas demandés ;
- choisis les aliments dans les listes de courses des ressources et donne les quantités exactes de « 1 apport » (version homme ou femme selon mon sexe) ;
- ajoute les aliments brûle graisses imposés au déjeuner et au dîner, et les fruits ou crudités du mois en cours pour les apports E.
Pour chaque ingrédient : "quantity" est la quantité lisible (ex. « 1 poignée »), "grams" son poids en grammes (ex. 30),
"search" un nom simple et générique pour le trouver dans Open Food Facts (ex. « amandes », « blanc de poulet », « riz basmati »).
Dans "apports", écris les apports du repas, par exemple « 2 TP + 1 BH + 1 MM + BG ».
Varie par rapport à ce que j'ai mangé ces derniers jours et respecte mes goûts, allergies, budget et temps.
Recettes simples, 5 étapes max. Dans "why", explique en une phrase pourquoi ce repas me convient.
Puis fais la liste de courses de tous ces repas : quantités additionnées, regroupées par rayon.`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return res.status(502).send("Aucun plan généré.");
    }
    const plan = response.parsed_output;
    res.json({ meals: plan.meals, shopping: plan.shopping.map((s) => ({ ...s, checked: false })) });
  } catch (err) {
    console.error(err);
    res.status(500).send("Le générateur est indisponible.");
  }
}
