#!/usr/bin/env node
// Crée un café, invite son patron, crée N tables (jetons générés en base)
// et des catégories de départ. Admin plateforme uniquement (service_role).
//
// Usage :
//   node --env-file=.env scripts/create-cafe.mjs --name "Le Petit Café" --slug le-petit-cafe \
//        --owner-email patron@example.com --tables 12 [--owner-name "Marie"] [--currency EUR]
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values: args } = parseArgs({
  options: {
    name: { type: "string" },
    slug: { type: "string" },
    "owner-email": { type: "string" },
    "owner-name": { type: "string" },
    tables: { type: "string", default: "10" },
    currency: { type: "string", default: "EUR" },
  },
});

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

const name = args.name?.trim();
const slug = args.slug?.trim();
const ownerEmail = args["owner-email"]?.trim().toLowerCase();
const ownerName = args["owner-name"]?.trim() || "Patron";
const tableCount = Number(args.tables);
const currency = args.currency.trim().toUpperCase();

if (!name) fail("--name est obligatoire");
if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail("--slug obligatoire, minuscules/chiffres/tirets (ex. le-petit-cafe)");
if (!ownerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) fail("--owner-email invalide");
if (!Number.isInteger(tableCount) || tableCount < 1 || tableCount > 200) fail("--tables doit être un entier entre 1 et 200");
if (!/^[A-Z]{3}$/.test(currency)) fail("--currency doit être un code ISO à 3 lettres");

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (fichier .env)");

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEFAULT_CATEGORIES = ["Boissons chaudes", "Boissons fraîches", "Pâtisseries"];

let cafeId = null;
let ownerId = null;

async function rollback() {
  if (cafeId) await admin.from("cafes").delete().eq("id", cafeId);
  if (ownerId) await admin.auth.admin.deleteUser(ownerId);
}

try {
  // 1. Café
  const { data: cafe, error: cafeError } = await admin
    .from("cafes")
    .insert({ name, slug, currency })
    .select("id, slug")
    .single();
  if (cafeError) throw new Error(`création du café : ${cafeError.message}`);
  cafeId = cafe.id;

  // 2. Invitation du patron (signup_type = staff : aucune ligne customers créée)
  const redirectTo = SITE_URL ? `${SITE_URL.replace(/\/+$/, "")}/staff` : undefined;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(ownerEmail, {
    data: { signup_type: "staff", display_name: ownerName },
    redirectTo,
  });
  if (inviteError) throw new Error(`invitation du patron : ${inviteError.message}`);
  ownerId = invited.user.id;

  const { error: staffError } = await admin
    .from("staff_members")
    .insert({ id: ownerId, cafe_id: cafeId, role: "owner", display_name: ownerName });
  if (staffError) throw new Error(`création du patron : ${staffError.message}`);

  // 3. Tables (le jeton qr_token est généré par la base)
  const tables = Array.from({ length: tableCount }, (_, i) => ({ cafe_id: cafeId, label: String(i + 1) }));
  const { error: tablesError } = await admin.from("cafe_tables").insert(tables);
  if (tablesError) throw new Error(`création des tables : ${tablesError.message}`);

  // 4. Catégories de départ
  const categories = DEFAULT_CATEGORIES.map((n, i) => ({ cafe_id: cafeId, name: n, position: i + 1 }));
  const { error: catError } = await admin.from("categories").insert(categories);
  if (catError) throw new Error(`création des catégories : ${catError.message}`);

  console.log("✔ Café créé");
  console.log(`  id        : ${cafeId}`);
  console.log(`  slug      : ${slug}`);
  console.log(`  patron    : ${ownerEmail} (invitation envoyée)`);
  console.log(`  tables    : ${tableCount}`);
  console.log(`  catégories: ${DEFAULT_CATEGORIES.join(", ")}`);
  console.log(`\nÉtape suivante : node --env-file=.env scripts/generate-qr.mjs --slug ${slug}`);
} catch (err) {
  console.error(`✖ ${err.message}`);
  console.error("  Annulation des créations partielles…");
  await rollback().catch((e) => console.error("  rollback incomplet :", e.message));
  process.exit(1);
}
