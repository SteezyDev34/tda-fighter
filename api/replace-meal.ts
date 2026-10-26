import type { VercelRequest, VercelResponse } from "@vercel/node";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { SuggestedMeal } from "../src/nutrition/types";
import { buildSystem, client, MODEL } from "./_lib/claude.js";
import { MealSchema, METHOD, ShoppingSchema } from "./_lib/plan.js";
import { slotLabel } from "./_lib/shared.js";

const ReplaceSchema = z.object({ meal: MealSchema, shopping: ShoppingSchema });

const describe = (m: SuggestedMeal) =>
  `${slotLabel(m.slot)} : ${m.name}${m.apports ? ` (${m.apports})` : ""} — ${m.ingredients
    .map((i) => `${i.quantity} ${i.item}`)
    .join(", ")}`;

/**
 * Replaces one meal the user doesn't like. The other meals of the day stay,
 * and the new one completes their apports. The shopping list is redone for all meals.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("POST uniquement");
  const { target, others, dayType, shoppingMeals, profile, journal } = req.body as {
    target: SuggestedMeal;
    others: SuggestedMeal[];
    dayType?: "training" | "rest";
    /** Every other meal of the plan with how many times it is eaten (a week repeats typical days). */
    shoppingMeals: { meal: SuggestedMeal; times: number }[];
    targetTimes: number;
    profile: Parameters<typeof buildSystem>[0];
    journal: Parameters<typeof buildSystem>[1];
  };
  const targetTimes = Math.max(1, Number(req.body.targetTimes) || 1);

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(ReplaceSchema) },
      system: await buildSystem(profile, journal),
      messages: [
        {
          role: "user",
          content: `Je n'aime pas ce repas, propose-m'en un autre pour le même moment (${slotLabel(target.slot)}, slot "${target.slot}") :
${describe(target)}

C'est un ${dayType === "rest" ? "jour de repos" : "jour d'entraînement"}. Les autres repas de la journée sont gardés tels quels :
${others.length ? others.map((m) => `- ${describe(m)}`).join("\n") : "- aucun"}

Le nouveau repas doit être vraiment différent de celui que je n'aime pas, et ses apports doivent compléter ceux des autres repas
pour que la journée respecte le total d'apports TP, BH, MM et E du protocole (en général, les mêmes apports que le repas remplacé).
${METHOD}
Recettes simples, 5 étapes max. Dans "why", une phrase.

Puis refais la liste de courses complète de tout le plan, regroupée par rayon, avec ces repas et ce nombre de fois :
- le nouveau repas : ${targetTimes} fois
${shoppingMeals.map(({ meal, times }) => `- ${describe(meal)} : ${times} fois`).join("\n")}`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return res.status(502).send("Aucun repas généré.");
    }
    const { meal, shopping } = response.parsed_output;
    res.json({ meal, shopping: shopping.map((s) => ({ ...s, checked: false })) });
  } catch (err) {
    console.error(err);
    res.status(500).send("Le générateur est indisponible.");
  }
}
