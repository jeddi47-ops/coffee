#!/usr/bin/env node
// Génère un QR code SVG par table active d'un café, pointant vers
// ${SITE_URL}/m/${qr_token}, avec le libellé de la table écrit sous le QR.
//
// Usage :
//   node --env-file=.env scripts/generate-qr.mjs --slug le-petit-cafe [--out ./qr/le-petit-cafe]
//
// ⚠ Les jetons sont secrets : ne versionnez pas le dossier de sortie.
import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";

const { values: args } = parseArgs({
  options: {
    slug: { type: "string" },
    out: { type: "string" },
  },
});

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL } = process.env;
if (!args.slug) fail("--slug est obligatoire");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis");
if (!SITE_URL) fail("SITE_URL requis (ex. https://menu.example.com)");

const siteUrl = SITE_URL.replace(/\/+$/, "");
const outDir = args.out ?? path.join("qr", args.slug);

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: cafe, error: cafeError } = await admin
  .from("cafes").select("id, name").eq("slug", args.slug).maybeSingle();
if (cafeError) fail(cafeError.message);
if (!cafe) fail(`café introuvable : ${args.slug}`);

const { data: tables, error: tablesError } = await admin
  .from("cafe_tables")
  .select("label, qr_token")
  .eq("cafe_id", cafe.id)
  .eq("is_active", true)
  .order("label");
if (tablesError) fail(tablesError.message);
if (!tables.length) fail("aucune table active pour ce café");

const escapeXml = (s) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
const safeFile = (s) => s.normalize("NFKD").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "table";

function renderSvg(url, label, cafeName) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const margin = 4;
  const scale = 10;
  const qrPx = (size + margin * 2) * scale;
  const textArea = 90;

  let d = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (qr.modules.get(row, col)) d += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${qrPx}" height="${qrPx + textArea}" viewBox="0 0 ${qrPx} ${qrPx + textArea}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g transform="scale(${scale})"><path d="${d}" fill="#000000" shape-rendering="crispEdges"/></g>
  <text x="${qrPx / 2}" y="${qrPx + 38}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="#000000">Table ${escapeXml(label)}</text>
  <text x="${qrPx / 2}" y="${qrPx + 72}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#555555">${escapeXml(cafeName)}</text>
</svg>
`;
}

await mkdir(outDir, { recursive: true });
const used = new Set();
for (const t of tables) {
  const url = `${siteUrl}/m/${t.qr_token}`;
  let file = `table-${safeFile(t.label)}`;
  while (used.has(file)) file += "_";
  used.add(file);
  await writeFile(path.join(outDir, `${file}.svg`), renderSvg(url, t.label, cafe.name), "utf8");
}

console.log(`✔ ${tables.length} QR code(s) générés dans ${outDir}`);
console.log("  ⚠ Ces fichiers contiennent les jetons secrets des tables : ne pas les versionner.");
