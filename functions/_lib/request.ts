export function pidFromRequest(request: Request): string | null {
  const pid = request.headers.get("x-sy-id")?.trim();
  return pid && /^[0-9a-f]{8,32}$/.test(pid) ? pid : null;
}
