import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { pinyin } from "pinyin-pro";
import YAML from "yaml";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.resolve(
  process.env.SHIYE_SOURCE_DIR ?? "/Volumes/SSD/Work/code/self/shiye-books/data"
);
const outputRoot = path.join(repositoryRoot, "src/content/articles");
const manifestPath = path.join(repositoryRoot, "content/r2-upload-manifest.json");
const r2Base = (
  process.env.R2_PUBLIC_BASE_URL ?? "https://img.arkblob.ccwu.cc"
).replace(/\/+$/, "");

const CATEGORY_MAP = new Map([
  ["文学", "foreign-literature"],
  ["毛姆短篇小说集", "foreign-literature"],
  ["鲁迅短篇小说集", "chinese-literature"]
]);

const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
const usedSlugs = new Map();
const manifest = {
  generatedAt: new Date().toISOString(),
  r2Base,
  articles: [],
  assets: []
};

function fail(message) {
  throw new Error(message);
}

function normalizeSlug(value) {
  const converted = pinyin(value, {
    toneType: "none",
    type: "array",
    nonZh: "consecutive",
    v: true
  })
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  return converted.slice(0, 90).replace(/-$/g, "");
}

function uniqueSlug(title, sourcePath) {
  const base = normalizeSlug(title) || "article";
  const count = usedSlugs.get(base) ?? 0;
  usedSlugs.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function parseMeta(file) {
  const meta = YAML.parse(readText(file));
  if (!meta || typeof meta !== "object") fail(`Invalid metadata: ${file}`);
  return meta;
}

function normalizeDate(value, sourcePath) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return fail(`Missing or invalid date: ${sourcePath}`);
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((tag) => typeof tag === "string" && tag.trim()))].map((tag) => tag.trim());
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function chapterTitle(dirName) {
  return dirName.match(/^\d+[-_\s]+(.+)$/)?.[1] ?? dirName;
}

function stripLeadingH1(markdown) {
  return markdown.replace(/^#\s+[^\n]+\n*/, "").trim();
}

function addAsset(sourceFile, r2Key) {
  const url = `${r2Base}/${r2Key}`;
  manifest.assets.push({
    source: path.relative(sourceRoot, sourceFile),
    r2Key,
    url
  });
  return encodeURI(url);
}

function rootAsset(articleDir, slug, reference, sourcePath) {
  if (!reference?.startsWith("images/")) {
    return fail(`Unexpected image reference in ${sourcePath}: ${reference}`);
  }
  const sourceFile = path.join(articleDir, reference);
  if (!fs.existsSync(sourceFile)) fail(`Missing image: ${sourceFile}`);
  const filename = path.basename(reference);
  return addAsset(sourceFile, path.posix.join("articles", slug, filename));
}

function rewriteImages(markdown, resolver) {
  const rewritten = markdown
    .replace(
      /(!\[[^\]]*\]\()\.?\/?(images\/[^)\s]+)(?:\s+["'][^"']*["'])?\)/g,
      (_, prefix, reference) => `${prefix}${resolver(reference)})`
    )
    .replace(
      /(<img\b[^>]*\bsrc=["'])(\.?\/?images\/[^"']+)(["'])/gi,
      (_, prefix, reference, suffix) => `${prefix}${resolver(reference)}${suffix}`
    );

  return rewritten;
}

function collectArticle(articleDir, sourceCategory, sourceSlug) {
  const metaFile = path.join(articleDir, "meta.yaml");
  if (!fs.existsSync(metaFile)) return null;
  const meta = parseMeta(metaFile);
  const sourcePath = path.join(sourceCategory, sourceSlug);
  const title = String(meta.title ?? sourceSlug).trim();
  const slug = uniqueSlug(title, sourcePath);
  const date = normalizeDate(meta.date, sourcePath);
  const tags = normalizeTags(meta.tags);
  const bodyParts = [];

  const rootContentFile = path.join(articleDir, "content.md");
  if (fs.existsSync(rootContentFile)) {
    bodyParts.push(
      rewriteImages(stripLeadingH1(readText(rootContentFile)), (reference) =>
        rootAsset(articleDir, slug, reference, sourcePath)
      )
    );
  }

  const chaptersDir = path.join(articleDir, "chapters");
  if (fs.existsSync(chaptersDir)) {
    const chapterDirs = fs
      .readdirSync(chaptersDir)
      .filter((name) => fs.statSync(path.join(chaptersDir, name)).isDirectory())
      .sort(collator.compare);

    for (const chapterDirName of chapterDirs) {
      const chapterDir = path.join(chaptersDir, chapterDirName);
      const contentFile = path.join(chapterDir, "content.md");
      if (!fs.existsSync(contentFile)) continue;

      const content = rewriteImages(stripLeadingH1(readText(contentFile)), (reference) => {
        if (!reference.startsWith("images/")) {
          fail(`Unexpected chapter image in ${sourcePath}/${chapterDirName}: ${reference}`);
        }
        const sourceFile = path.join(chapterDir, reference);
        if (!fs.existsSync(sourceFile)) fail(`Missing image: ${sourceFile}`);
        return addAsset(
          sourceFile,
          path.posix.join(
            "articles",
            slug,
            "chapters",
            chapterDirName,
            path.basename(reference)
          )
        );
      });

      bodyParts.push(`## ${chapterTitle(chapterDirName)}\n\n${content}`);
    }
  }

  const body = bodyParts.join("\n\n").trim();
  if (!body) fail(`Article has no content: ${sourcePath}`);

  const frontmatter = {
    title,
    description: String(meta.summary ?? title).trim(),
    date,
    ...(meta.author ? { author: String(meta.author).trim() } : {}),
    ...(meta.translator ? { translator: String(meta.translator).trim() } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(meta.cover ? { cover: rootAsset(articleDir, slug, meta.cover, sourcePath) } : {})
  };

  manifest.articles.push({
    sourcePath,
    title,
    slug,
    category: CATEGORY_MAP.get(sourceCategory),
    chapters: fs.existsSync(chaptersDir)
      ? fs
          .readdirSync(chaptersDir)
          .filter((name) => fs.statSync(path.join(chaptersDir, name)).isDirectory())
          .sort(collator.compare)
          .map(chapterTitle)
      : []
  });

  return { frontmatter, body, slug, targetCategory: CATEGORY_MAP.get(sourceCategory) };
}

fs.mkdirSync(outputRoot, { recursive: true });
for (const file of fs.readdirSync(outputRoot)) {
  fs.rmSync(path.join(outputRoot, file), { recursive: true, force: true });
}

let imported = 0;
const categoryCounts = new Map();
for (const [sourceCategory, targetCategory] of CATEGORY_MAP) {
  const categoryDir = path.join(sourceRoot, sourceCategory);
  if (!fs.existsSync(categoryDir)) fail(`Missing source category: ${categoryDir}`);

  fs.mkdirSync(path.join(outputRoot, targetCategory), { recursive: true });
  for (const sourceSlug of fs.readdirSync(categoryDir).sort(collator.compare)) {
    const articleDir = path.join(categoryDir, sourceSlug);
    if (!fs.statSync(articleDir).isDirectory()) continue;

    const article = collectArticle(articleDir, sourceCategory, sourceSlug);
    if (!article) fail(`Missing metadata: ${articleDir}`);

    const markdown = `---\n${YAML.stringify(article.frontmatter, { lineWidth: 0 })}---\n\n${article.body}\n`;
    fs.writeFileSync(path.join(outputRoot, article.targetCategory, `${article.slug}.md`), markdown);
    imported += 1;
    categoryCounts.set(article.targetCategory, (categoryCounts.get(article.targetCategory) ?? 0) + 1);
  }
}

fs.mkdirSync(path.join(outputRoot, "personal-blog"), { recursive: true });
fs.writeFileSync(path.join(outputRoot, "personal-blog", ".gitkeep"), "");
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Imported ${imported} articles.`);
for (const [category, count] of categoryCounts) console.log(`  ${category}: ${count}`);
console.log(`R2 assets: ${manifest.assets.length}`);
console.log(`Manifest: ${path.relative(process.cwd(), manifestPath)}`);
