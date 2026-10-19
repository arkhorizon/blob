import { json, jsonError } from "../../_lib/response";

type GiscusTokenResponse = {
  token?: string;
  error?: string;
};

type GitHubUser = {
  login?: string;
  html_url?: string;
  avatar_url?: string;
};

async function readJsonBody(request: Request): Promise<{ session?: unknown }> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export const onRequestPost: PagesFunction<unknown> = async ({ request }) => {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim();
  if (contentType !== "application/json") return jsonError(415, "Unsupported content type");

  const body = await readJsonBody(request);
  const session = typeof body.session === "string" ? body.session.trim() : "";
  if (!session || session.length > 8192) return jsonError(400, "Invalid session");

  const tokenResponse = await fetch("https://giscus.app/api/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session })
  });
  const tokenData = await tokenResponse.json<GiscusTokenResponse>();
  if (!tokenResponse.ok || !tokenData.token) return jsonError(401, "Invalid session");

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${tokenData.token}`,
      accept: "application/vnd.github+json",
      "user-agent": "shiye-giscus-viewer"
    }
  });
  if (userResponse.status === 401 || userResponse.status === 403) {
    return jsonError(401, "Invalid session");
  }
  if (!userResponse.ok) return jsonError(502, "Unable to load GitHub account");

  const user = await userResponse.json<GitHubUser>();
  if (!user.login) return jsonError(502, "Unable to load GitHub account");

  return json({
    login: user.login,
    avatarUrl: user.avatar_url || "",
    url: user.html_url || `https://github.com/${user.login}`
  });
};
