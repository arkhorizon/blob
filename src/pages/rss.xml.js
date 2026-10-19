import { articleSlug, getPublishedArticles } from "../lib/articles";
import { SITE } from "../lib/site";

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET({ site }) {
  const articles = await getPublishedArticles();
  const items = articles.map((article) => {
    const url = new URL(`/articles/${articleSlug(article)}`, site);
    return `    <item>
      <title>${escapeXml(article.data.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${article.data.date.toUTCString()}</pubDate>
      <description>${escapeXml(article.data.description)}</description>
    </item>`;
  });

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE.name)}</title>
    <link>${site}</link>
    <description>${escapeXml(SITE.description)}</description>
    <language>zh-CN</language>
${items.join("\n")}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
}
