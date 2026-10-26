import type { VercelRequest, VercelResponse } from "@vercel/node";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { MealSlot } from "../src/nutrition/types";
import { buildSystem, client, MODEL } from "./_lib/claude.js";
import { MealSchema, METHOD, ShoppingSchema } from "./_lib/plan.js";
import { slotLabel } from "./_lib/shared.js";

const PlanSchema = z.object({ meals: z.array(MealSchema), shopping: ShoppingSchema });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("POST uniquement");
  const { slots, dayType, profile, journal } = req.body as {
    slots: MealSlot[];
    dayType?: "training" | "rest";
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
Aujourd'hui est un ${dayType === "rest" ? "jour de repos (sans entraînement)" : "jour d'entraînement"} : utilise les apports prévus pour ce type de jour dans le protocole (jour training ou jour repos ; jour « on » ou « off » pour les diets cycliques).
${METHOD}
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
