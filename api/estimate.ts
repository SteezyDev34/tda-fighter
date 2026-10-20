import type { VercelRequest, VercelResponse } from "@vercel/node";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { buildSystem, client, MODEL } from "./_lib/claude";

const NutrientsSchema = z.object({
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});

/** Estimates the calories and macros of one journal line. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("POST uniquement");
  const { description, profile } = req.body as {
    description: string;
    profile: Parameters<typeof buildSystem>[0];
  };

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(NutrientsSchema) },
      system: await buildSystem(profile, []),
      messages: [
        {
          role: "user",
          content: `Estime les apports de ce que j'ai mangé : « ${description} ».
Si les quantités manquent, prends une portion adulte standard.
Réponds avec des nombres entiers : kcal, protéines (g), glucides (g), lipides (g).`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return res.status(502).send("Estimation impossible.");
    }
    const n = response.parsed_output;
    res.json({
      kcal: Math.round(n.kcal),
      protein: Math.round(n.protein),
      carbs: Math.round(n.carbs),
      fat: Math.round(n.fat),
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Estimation indisponible.");
  }
}
