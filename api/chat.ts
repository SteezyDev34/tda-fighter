import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildSystem, client, MODEL } from "./_lib/claude.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("POST uniquement");
  const { messages, profile, journal } = req.body;

  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: await buildSystem(profile, journal),
      messages,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        res.write(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      res.write("\n\nJe ne peux pas répondre à cette question. Essaie de la reformuler.");
    }
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).send("Le coach est indisponible.");
    else res.end();
  }
}
