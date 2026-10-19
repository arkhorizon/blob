import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mappingFile = path.join(root, "scripts/article-slug-map.csv");
const command = process.argv[2];

if (command !== "sql" && command !== "kv") {
  console.error("Usage: node scripts/migrate-article-identifiers.mjs sql|kv");
  process.exit(1);
}

const mappings = fs
  .readFileSync(mappingFile, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [oldSlug, newSlug] = line.split(",");
    if (!oldSlug || !newSlug) throw new Error(`Invalid mapping: ${line}`);
    return { oldSlug, newSlug };
  });

if (command === "sql") {
  const statements = mappings.map(({ oldSlug, newSlug }) =>
    `UPDATE article_views SET slug = '${newSlug.replace(/'/g, "''")}' WHERE slug = '${oldSlug.replace(/'/g, "''")}';`
  );
  console.log(statements.join("\n"));
} else {
  console.log([
    "Run these commands with Wrangler and the Pages KV namespace ID:",
    ...mappings.flatMap(({ oldSlug, newSlug }) => [
      `get progress:<pid>:${oldSlug}`,
      `put progress:<pid>:${newSlug} <value-from-get>`,
      `delete progress:<pid>:${oldSlug}`
    ])
  ].join("\n"));
}
