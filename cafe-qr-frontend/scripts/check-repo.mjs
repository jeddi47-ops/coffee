#!/usr/bin/env node
// Contrôle avant livraison (critères 20 et thème n°6) : npm run check:secrets
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SKIP = new Set(["node_modules", "dist", ".git"]);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs|json|html|css|md|toml|env|example)$/.test(name) || name.startsWith(".env")) files.push(p);
  }
})(ROOT);

const self = relative(ROOT, new URL(import.meta.url).pathname);
const rules = [
  { name: "clé service_role", re: new RegExp("service" + "_role", "i") },
  { name: "JWT en clair", re: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\./ },
  { name: "console.log", re: /console\.(log|debug|info)\(/, only: /^src\// },
  { name: "dangerouslySetInnerHTML", re: /dangerouslySetInnerHTML/, only: /^src\// },
  {
    name: "couleur en dur (zone client)",
    re: /#[0-9a-fA-F]{3,8}\b|rgba?\(|\b(bg|text|border|ring|fill|stroke|outline|divide|shadow)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/,
    only: /^src\/(pages\/customer|components)\//,
  },
];

let failures = 0;
for (const file of files) {
  const rel = relative(ROOT, file);
  if (rel === self) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  for (const rule of rules) {
    if (rule.only && !rule.only.test(rel)) continue;
    lines.forEach((line, i) => {
      if (rule.re.test(line)) {
        failures++;
        process.stdout.write(`✖ ${rule.name} : ${rel}:${i + 1}\n`);
      }
    });
  }
}
process.stdout.write(failures ? `\n${failures} problème(s).\n` : "✔ Dépôt propre : aucune clé, aucun console.log, aucun HTML injecté, aucune couleur en dur côté client.\n");
process.exit(failures ? 1 : 0);
