import type { VercelRequest, VercelResponse } from "@vercel/node";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { buildSystem, client, MODEL } from "./_lib/claude.js";
import { MealSchema, METHOD, scheduleText, ShoppingSchema, type Schedule } from "./_lib/plan.js";

const WeekSchema = z.object({
  types: z.array(
    z.object({
      name: z.string(),
      dayType: z.enum(["training", "rest"]),
      meals: z.array(MealSchema),
    }),
  ),
  days: z.array(z.object({ date: z.string(), type: z.number() })),
  shopping: ShoppingSchema,
});

interface Day {
  date: string;
  weekday: string;
  training: boolean;
}

/**
 * Plans a week the way the resources do it ("Mon plan de repas de la semaine"):
 * a few typical days of 5 meals, each calendar day follows one of them.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("POST uniquement");
  const { days, schedule, profile, journal } = req.body as {
    days: Day[];
    schedule?: Schedule;
    profile: Parameters<typeof buildSystem>[0];
    journal: Parameters<typeof buildSystem>[1];
  };

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 20000,
      output_config: { effort: "medium", format: zodOutputFormat(WeekSchema) },
      system: await buildSystem(profile, journal),
      messages: [
        {
          role: "user",
          content: `Prépare mes repas de la semaine, comme la fiche « Mon plan de repas de la semaine » des ressources.
Les jours :
${days.map((d) => `- ${d.date} (${d.weekday}) : ${d.training ? "jour d'entraînement" : "jour de repos"}`).join("\n")}

Crée 3 journées types différentes (2 si tous les jours sont du même type), chacune avec ses 5 repas :
petit-déjeuner (breakfast), collation du matin (morning_snack), déjeuner (lunch), collation de l'après-midi (afternoon_snack), dîner (dinner).
Chaque journée type est pour un jour d'entraînement ou un jour de repos ("dayType"), avec les apports prévus pour ce type de jour dans le protocole.
Donne-leur un nom court (ex. « Jour type 1 – entraînement »).
Dans "days", associe chaque date à l'index (à partir de 0) d'une journée type du bon type, en alternant pour varier.
${scheduleText(schedule, days.some((d) => d.training))}
Ces horaires de séance ne valent que pour les journées types d'entraînement ; les jours de repos, place les repas selon le lever seulement.
${METHOD}
Recettes simples, 3 étapes max. Dans "why", une phrase courte.
Puis fais la liste de courses de toute la semaine : additionne les quantités selon le nombre de jours où chaque journée type revient, regroupées par rayon.`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return res.status(502).send("Aucun plan généré.");
    }
    const week = response.parsed_output;
    res.json({
      meals: [],
      shopping: week.shopping.map((s) => ({ ...s, checked: false })),
      week: { types: week.types, days: week.days, logged: [] },
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Le générateur est indisponible.");
  }
}
