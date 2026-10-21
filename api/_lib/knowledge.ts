import { google } from "googleapis";

/**
 * Reads every .md file of the Google Drive nutrition folder.
 * The folder is shared with a service account; its key is in GOOGLE_SERVICE_ACCOUNT_JSON.
 * Results are cached in memory so a burst of requests does not re-download everything.
 */
const CACHE_MS = 10 * 60 * 1000;
let cache: { at: number; text: string } | null = null;

export async function loadKnowledge(): Promise<string> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.text;

  const folderId = process.env.DRIVE_FOLDER_ID;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!folderId || !key) return "";

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(key),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const drive = google.drive({ version: "v3", auth });

  const list = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and name contains '.md'`,
    fields: "files(id, name)",
    orderBy: "name",
    pageSize: 200,
  });

  const docs = await Promise.all(
    (list.data.files ?? []).map(async (f) => {
      const res = await drive.files.get(
        { fileId: f.id!, alt: "media" },
        { responseType: "text" },
      );
      return `<document name="${f.name}">\n${res.data as string}\n</document>`;
    }),
  );

  const text = docs.join("\n\n");
  // An empty folder usually means it is not shared with the service account yet:
  // don't cache that, so the resources show up as soon as the folder is shared.
  if (text) cache = { at: Date.now(), text };
  else console.warn("Drive : aucun fichier .md visible. Le dossier est-il partagé avec le compte de service ?");
  return text;
}
