import Anthropic from "@anthropic-ai/sdk";
import type { JournalEntry, NutritionProfile } from "../../src/nutrition/types";
import { slotLabel } from "../../src/nutrition/types";
import { loadKnowledge } from "./knowledge";

export const client = new Anthropic();
export const MODEL = "claude-opus-5-5";

const ROLE = `Tu es le coach nutrition de TDA Fighter, une app pour les personnes TDAH.
Réponds en français, avec des phrases courtes et des actions concrètes. Pas de culpabilisation.
Appuie-toi d'abord sur les ressources nutritionnelles fournies (balises <document>), puis sur les critères et le journal de la personne.
Si les ressources ne couvrent pas la question, dis-le et donne un conseil prudent et général.
Tu ne poses pas de diagnostic médical ; en cas de doute de santé, oriente vers un professionnel.`;

function describeContext(profile: NutritionProfile, journal: JournalEntry[]) {
  const criteria = Object.entries(profile)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `- ${k} : ${v}`)
    .join("\n");
  const eaten = journal
    .map((e) => `- ${e.date} · ${slotLabel(e.slot)} : ${e.description}`)
    .join("\n");
  return `<criteres>\n${criteria || "Aucun critère renseigné."}\n</criteres>
<journal date_du_jour="${new Date().toISOString().slice(0, 10)}">\n${eaten || "Journal vide."}\n</journal>`;
}

/**
 * System prompt: the stable part (role + Drive knowledge) is cached,
 * the personal context (criteria + journal) changes on every request.
 */
export async function buildSystem(
  profile: NutritionProfile,
  journal: JournalEntry[],
): Promise<Anthropic.TextBlockParam[]> {
  const knowledge = await loadKnowledge();
  return [
    {
      type: "text",
      text: `${ROLE}\n\n<ressources>\n${knowledge || "Aucune ressource chargée."}\n</ressources>`,
      cache_control: { type: "ephemeral" },
    },
    { type: "text", text: describeContext(profile, journal) },
  ];
}
