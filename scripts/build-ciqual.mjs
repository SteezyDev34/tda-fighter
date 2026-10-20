// Converts the Ciqual table (ANSES) into public/ciqual.json for the food search.
// Usage: node scripts/build-ciqual.mjs "Table Ciqual 2020_FR_2020 07 07.xls"
// Download the table from https://ciqual.anses.fr/ (Téléchargement).
import { writeFileSync } from "node:fs";
import XLSX from "xlsx";

const file = process.argv[2];
if (!file) {
  console.error("Indique le fichier Ciqual (.xls, .xlsx ou .csv).");
  process.exit(1);
}

const sheet = XLSX.readFile(file, { raw: false }).Sheets;
const rows = XLSX.utils.sheet_to_json(Object.values(sheet)[0], { defval: "" });

// Column names change slightly between Ciqual releases: match on their start.
const col = (row, prefix) => Object.keys(row).find((k) => k.toLowerCase().startsWith(prefix));

// "12,5" -> 12.5 ; "traces", "-" -> 0 ; "< 0,5" -> 0.5 (upper bound, close enough for a daily chart).
const num = (v) => {
  const s = String(v).replace(",", ".").replace(/[<>\s]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
};

const first = rows[0];
const keys = {
  code: col(first, "alim_code"),
  name: col(first, "alim_nom_fr"),
  kcal: col(first, "energie, règlement ue n° 1169/2011 (kcal") ?? col(first, "energie, règlement"),
  protein: col(first, "protéines, n x facteur de jones") ?? col(first, "protéines"),
  carbs: col(first, "glucides"),
  fat: col(first, "lipides"),
};
const missing = Object.entries(keys).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error("Colonnes introuvables :", missing.join(", "));
  console.error("Colonnes du fichier :", Object.keys(first).join(" | "));
  process.exit(1);
}

const foods = rows
  .filter((r) => r[keys.name])
  .map((r) => [String(r[keys.code]), String(r[keys.name]).trim(), num(r[keys.kcal]), num(r[keys.protein]), num(r[keys.carbs]), num(r[keys.fat])]);

writeFileSync(new URL("../public/ciqual.json", import.meta.url), JSON.stringify(foods));
console.log(`${foods.length} aliments écrits dans public/ciqual.json`);
