const PID_KEY = "sy-pid";

export function getPid() {
  if (typeof window === "undefined") return "";
  let pid;
  try {
    pid = window.localStorage.getItem(PID_KEY);
  } catch {
    return "";
  }
  if (!pid || !/^[0-9a-f]{8,32}$/.test(pid)) {
    const bytes = new Uint8Array(8);
    window.crypto.getRandomValues(bytes);
    pid = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    try {
      window.localStorage.setItem(PID_KEY, pid);
    } catch {}
  }
  return pid;
}

export function pidFetch(url, options = {}) {
  const pid = getPid();
  if (!pid) return fetch(url, options);
  const headers = new Headers(options.headers);
  headers.set("X-Sy-Id", pid);
  return fetch(url, { ...options, headers });
}

// giscus stores the OAuth state returned by its own sign-in flow under this key.
export const GISCUS_SESSION_KEY = "giscus-session";
