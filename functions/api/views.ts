type Env = {
  DB: D1Database;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim();
  if (contentType !== "application/json") {
    return json({ error: "Unsupported content type" }, 415);
  }

  let body: { slug?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!SLUG_PATTERN.test(slug) || slug.length > 120) {
    return json({ error: "Invalid slug" }, 400);
  }

  const row = await env.DB.prepare(
    `INSERT INTO article_views (slug, count)
     VALUES (?, 1)
     ON CONFLICT (slug) DO UPDATE SET count = count + 1
     RETURNING count`
  )
    .bind(slug)
    .first<{ count: number }>();

  return json({ count: row?.count ?? 1 });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const slugs = (new URL(request.url).searchParams.get("slugs") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => SLUG_PATTERN.test(value) && value.length <= 120)
    .slice(0, 100);

  if (slugs.length === 0) return json({});

  const placeholders = slugs.map(() => "?").join(",");
  const result = await env.DB.prepare(
    `SELECT slug, count FROM article_views WHERE slug IN (${placeholders})`
  )
    .bind(...slugs)
    .all<{ slug: string; count: number }>();

  const views: Record<string, number> = {};
  for (const row of result.results ?? []) views[row.slug] = row.count;
  return json({ views });
};
