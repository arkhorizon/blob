import { json, jsonError } from "../../_lib/response";
import { pidFromRequest } from "../../_lib/request";
import type { Env } from "../../_lib/types";

const kvKey = (pid: string, slug: string) => `progress:${pid}:${slug}`;

function requestSlug(request: Request): string {
  const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? "";
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 200 ? slug : "";
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const pid = pidFromRequest(request);
  if (!pid) return json({});

  const slug = requestSlug(request);
  if (!slug) return jsonError(400, "缺少 slug");

  const raw = await env.KV.get(kvKey(pid, slug));
  if (!raw) return json({});
  try {
    return json(JSON.parse(raw));
  } catch {
    return json({});
  }
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const pid = pidFromRequest(request);
  if (!pid) return jsonError(401, "缺少身份");

  const slug = requestSlug(request);
  if (!slug) return jsonError(400, "缺少 slug");

  let body: { chapter?: unknown; p?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "无效请求体");
  }

  const chapterNumber = Number(body.chapter);
  const progressNumber = Number(body.p);
  const chapter = Number.isFinite(chapterNumber)
    ? Math.max(0, Math.min(999, Math.floor(chapterNumber)))
    : 0;
  const progress = Number.isFinite(progressNumber)
    ? Math.max(0, Math.min(100, Math.round(progressNumber * 100) / 100))
    : 0;

  await env.KV.put(kvKey(pid, slug), JSON.stringify({
    chapter,
    p: progress,
    updated_at: new Date().toISOString()
  }));
  return json({ ok: true });
};
