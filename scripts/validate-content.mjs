import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(root, "src/content/articles");
const allowedCategories = new Set(["personal-blog", "foreign-literature", "chinese-literature"]);
const slugPattern = /^[a-z0-9\p{Script=Han}]+(?:-[a-z0-9\p{Script=Han}]+)*$/u;
const errors = [];
const slugs = new Set();
const categories = new Map([...allowedCategories].map((category) => [category, 0]));

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const current = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(current);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      validateFile(current);
    }
  }
}

function validateFile(file) {
  const relative = path.relative(contentRoot, file);
  const [category, maybeSlug] = relative.split(path.sep);
  const slug = path.basename(maybeSlug ?? "", ".md");
  const source = fs.readFileSync(file, "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\n?/);

  if (!allowedCategories.has(category)) errors.push(`${relative}: unknown category directory`);
  if (!slugPattern.test(slug) || slug.length > 80) errors.push(`${relative}: invalid slug filename`);
  if (slugs.has(slug)) errors.push(`${relative}: duplicate slug ${slug}`);
  slugs.add(slug);
  if (!match) {
    errors.push(`${relative}: missing YAML frontmatter`);
    return;
  }

  let data;
  try {
    data = YAML.parse(match[1]);
  } catch (error) {
    errors.push(`${relative}: invalid YAML - ${error.message}`);
    return;
  }

  for (const field of ["title", "description"]) {
    if (typeof data[field] !== "string" || data[field].trim().length === 0) {
      errors.push(`${relative}: ${field} is required`);
    }
  }
  if (Number.isNaN(Date.parse(data.date))) errors.push(`${relative}: invalid date`);
  if (data.updated && Number.isNaN(Date.parse(data.updated))) errors.push(`${relative}: invalid updated date`);
  if (data.tags !== undefined && (!Array.isArray(data.tags) || data.tags.some((tag) => typeof tag !== "string" || !tag.trim()))) {
    errors.push(`${relative}: tags must be a string array`);
  }
  if (data.cover !== undefined && !URL.canParse(data.cover)) errors.push(`${relative}: cover must be an absolute URL`);

  const body = source.slice(match[0].length);
  if (body.trim().length === 0) errors.push(`${relative}: empty body`);
  if (/(!\[[^\]]*\]\()\.?\/?(images\/|\/)/.test(body) || /<img\b[^>]*\bsrc=["'](?:\.?\/?images\/|\/)/i.test(body)) {
    errors.push(`${relative}: local image reference remains`);
  }

  categories.set(category, (categories.get(category) ?? 0) + 1);
}

if (!fs.existsSync(contentRoot)) {
  errors.push("Content directory does not exist");
} else {
  walk(contentRoot);
}

for (const error of errors) console.error(`error: ${error}`);
for (const [category, count] of categories) console.log(`${category}: ${count} articles`);
console.log(`total: ${slugs.size} articles`);

if (errors.length > 0) process.exit(1);
