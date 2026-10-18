import { pidFetch } from "./identity";

const viewsCache = new Map();

export async function postView(slug) {
  try {
    const response = await fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const count = typeof data.count === "number" ? data.count : null;
    if (count != null) viewsCache.set(slug, count);
    return count;
  } catch {
    return null;
  }
}

export async function getViews(slugs) {
  if (!slugs?.length) return {};
  const missing = slugs.filter((slug) => !viewsCache.has(slug));
  if (!missing.length) return readCachedViews(slugs);

  const chunks = [];
  for (let index = 0; index < missing.length; index += 100) {
    chunks.push(missing.slice(index, index + 100));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const response = await fetch(
          `/api/views?slugs=${encodeURIComponent(chunk.join(","))}`
        );
        if (!response.ok) return;
        const data = await response.json();
        for (const [slug, count] of Object.entries(data.views ?? {})) {
          viewsCache.set(slug, count);
        }
      } catch {}
    })
  );
  return readCachedViews(slugs);
}

export function readCachedViews(slugs) {
  const views = {};
  for (const slug of slugs ?? []) {
    if (viewsCache.has(slug)) views[slug] = viewsCache.get(slug);
  }
  return views;
}

export async function getProgress(slug) {
  if (!slug) return null;
  try {
    const response = await pidFetch(`/api/progress?slug=${encodeURIComponent(slug)}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data && Object.keys(data).length ? data : null;
  } catch {
    return null;
  }
}

export async function saveProgress(slug, chapter, progress) {
  if (!slug) return;
  try {
    await pidFetch(`/api/progress?slug=${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapter, p: progress })
    });
  } catch {}
}

export function formatCount(value) {
  if (value >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, "")}万`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(value);
}
