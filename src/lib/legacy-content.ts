import { Marked } from "marked";
import {
  articleCategory,
  articleSlug,
  getPublishedArticles,
  readingMinutes,
  type Article
} from "./articles";
import { CATEGORIES } from "./site";

export type RenderedChapter = {
  title: string;
  content: string;
};

export type RenderedArticle = {
  content: string;
  chapters: RenderedChapter[];
};

export type LegacyEssay = {
  id: string;
  title: string;
  category: string;
  author: string;
  translator: string;
  date: string;
  tags: string[];
  time: string;
  summary: string;
  cover: string;
  chapters: { title: string }[];
};

const marked = new Marked();
marked.use({
  renderer: {
    hr() {
      return '<div class="divider"></div>';
    },
    image({ href, title, text }) {
      const alt = text || "";
      const hasCaption = alt.startsWith("图：") || alt.startsWith("图:");
      const img = `<img src="${href}" alt="${alt}" decoding="async" loading="eager">`;
      if (hasCaption) {
        return `<figure class="illust">${img}<figcaption>${alt}</figcaption></figure>`;
      }
      return img;
    }
  }
});

function renderMarkdown(markdown: string, headingOffset: number) {
  const html = marked.parse(markdown, { async: false }) as string;
  let headingIndex = headingOffset;
  return html.replace(/<(h[23])>/g, (_, tag: string) => {
    return `<${tag} id="toc-h-${headingIndex++}">`;
  });
}

export function renderArticle(article: Article): RenderedArticle {
  const body = article.body ?? "";
  const chapterMatches = [...body.matchAll(/^##\s+(.+?)\s*$/gm)];

  if (chapterMatches.length === 0) {
    return { content: renderMarkdown(body, 0), chapters: [] };
  }

  const chapters: RenderedChapter[] = [];
  const preamble = body.slice(0, chapterMatches[0].index ?? 0).trim();
  if (preamble) chapters.push({ title: "开篇", content: renderMarkdown(preamble, 0) });

  chapterMatches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < chapterMatches.length ? chapterMatches[index + 1].index : body.length;
    const content = body.slice(start, end).trim();
    if (content) {
      chapters.push({
        title: match[1],
        content: renderMarkdown(content, (index + 1) * 100)
      });
    }
  });

  return { content: "", chapters };
}

function formatDate(value: Date) {
  return `${value.getFullYear()}年${value.getMonth() + 1}月${value.getDate()}日`;
}

function chapterTitles(body: string) {
  return [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1]);
}

export function toLegacyEssay(article: Article): LegacyEssay {
  const category = articleCategory(article);
  return {
    id: articleSlug(article),
    title: article.data.title,
    category: category ? CATEGORIES[category].title : "未分类",
    author: article.data.author ?? "",
    translator: article.data.translator ?? "",
    date: formatDate(article.data.date),
    tags: article.data.tags,
    time: `${readingMinutes(article)} 分钟`,
    summary: article.data.description,
    cover: article.data.cover ?? "",
    chapters: chapterTitles(article.body ?? "").map((title) => ({ title }))
  };
}

export async function getLegacyIndex() {
  const articles = await getPublishedArticles();
  const essays: Record<string, LegacyEssay> = {};
  const essayOrder: string[] = [];
  const tags = new Set<string>();

  for (const article of articles) {
    const essay = toLegacyEssay(article);
    essays[essay.id] = essay;
    essayOrder.push(essay.id);
    essay.tags.forEach((tag) => tags.add(tag));
  }

  return {
    essays,
    essayOrder,
    allTags: [...tags].sort((a, b) => a.localeCompare(b, "zh-CN")),
    categories: Object.values(CATEGORIES).map((category) => category.title)
  };
}
