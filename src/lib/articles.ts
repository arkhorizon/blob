import { getCollection, type CollectionEntry } from "astro:content";
import { isCategorySlug, type CategorySlug } from "./site";

export type Article = CollectionEntry<"articles">;

export function articleSlug(article: Article): string {
  const id = article.id.replace(/\.md$/, "");
  return id.split("/").at(-1) ?? id;
}

export function articleCategory(article: Article): CategorySlug | null {
  const id = article.id.replace(/\.md$/, "");
  const value = id.split("/")[0] ?? "";
  return isCategorySlug(value) ? value : null;
}

export async function getPublishedArticles(): Promise<Article[]> {
  const articles = await getCollection("articles", ({ data }) => !data.draft);
  return articles.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getArticlesByCategory(category: CategorySlug) {
  const articles = await getPublishedArticles();
  return articles.filter((article) => articleCategory(article) === category);
}

export async function getArticlesByTag(tag: string) {
  const articles = await getPublishedArticles();
  return articles.filter((article) => article.data.tags.includes(tag));
}

export async function getAllTags() {
  const articles = await getPublishedArticles();
  const counts = new Map<string, number>();
  for (const article of articles) {
    for (const tag of article.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"));
}

export function readingMinutes(article: Article): number {
  const body = article.body ?? "";
  const cjkCharacters = body.match(/[\u3400-\u9fff]/gu)?.length ?? 0;
  const words = body.match(/[a-zA-Z0-9]+/gu)?.length ?? 0;
  return Math.max(1, Math.round((cjkCharacters + words * 1.6) / 450));
}
