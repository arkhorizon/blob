import { useEffect, useRef, useState } from "react";
import { GISCUS_SESSION_KEY } from "../lib/identity";

function themeUrl(filename) {
    const base = import.meta.env.BASE_URL.endsWith("/")
        ? import.meta.env.BASE_URL
        : `${import.meta.env.BASE_URL}/`;
    return new URL(
        `${base}giscus/${filename}?v=comment-style-v11`,
        window.location.origin
    ).toString();
}

function discussionTerm(pathname) {
  const match = pathname.match(/^\/e\/([^/?#]+)/);
  return match ? `/e/${decodeURIComponent(match[1])}` : pathname;
}

const GISCUS_THEMES = {
  oriental: "shiye-oriental.css",
  magazine: "shiye-magazine.css",
  night: "shiye-night.css"
};

export default function GiscusComments({ config, theme }) {
    const containerRef = useRef(null);
    const [account, setAccount] = useState(null);

    useEffect(() => {
        if (!config.enabled) return;
        const container = containerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            observer.disconnect();

            const script = document.createElement("script");
            script.src = "https://giscus.app/client.js";
            script.async = true;
            script.crossOrigin = "anonymous";
            script.setAttribute("data-repo", config.repo);
            script.setAttribute("data-repo-id", config.repoId);
            script.setAttribute("data-category", config.category);
            script.setAttribute("data-category-id", config.categoryId);
            script.setAttribute("data-mapping", "path");
        script.setAttribute("data-strict", "false");
        script.setAttribute("data-term", discussionTerm(window.location.pathname));
            script.setAttribute("data-reactions-enabled", "1");
            script.setAttribute("data-emit-metadata", "1");
            script.setAttribute("data-input-position", "top");
            script.setAttribute("data-theme", themeUrl(GISCUS_THEMES[theme] ?? GISCUS_THEMES.oriental));
            script.setAttribute("data-lang", "zh-CN");
            script.setAttribute("data-loading", "lazy");
            script.onerror = () => {
                container.innerHTML = '<p class="giscus-error">评论加载失败，请检查网络后重试。</p>';
            };
            container.append(script);

            const handleMessage = (event) => {
              if (event.origin !== "https://giscus.app") return;
              const payload = event.data?.giscus;
              if (!payload || payload.error || !payload.viewer) return;

              const viewer = payload.viewer;
              setAccount({
                login: viewer.login || "",
                avatarUrl: viewer.avatarUrl || "",
                url: viewer.url || ""
              });
            };
            window.addEventListener("message", handleMessage);

            return () => {
              window.removeEventListener("message", handleMessage);
              observer.disconnect();
            };
        }, { rootMargin: "400px 0px" });
        observer.observe(container);

        return () => observer.disconnect();
    }, [config, theme]);

    if (!config.enabled) return null;

  const signOut = () => {
    const iframe = document.querySelector(".giscus iframe");
    if (iframe?.src) {
      const url = new URL(iframe.src);
      url.searchParams.delete("session");
      iframe.src = url.toString();
    } else {
      window.location.reload();
    }
    try {
      window.localStorage.removeItem(GISCUS_SESSION_KEY);
      setAccount(null);
    } catch {}
  };

  const signIn = () => {
    const current = window.location.pathname + window.location.search + window.location.hash;
    window.location.assign(
      `https://giscus.app/api/oauth/authorize?redirect_uri=${encodeURIComponent(
        window.location.origin + current
      )}`
    );
  };

  return (
    <section className="giscus-comments" aria-label="评论">
      <div className="giscus-heading">
        <h2>评论</h2>
        {account ? (
          <div className="giscus-account">
            <img src={account.avatarUrl} alt={account.login} referrerPolicy="no-referrer" />
            <span className="giscus-account-name">{account.login}</span>
            <button type="button" onClick={signOut}>退出登录</button>
          </div>
        ) : (
          <div className="giscus-account">
            <span className="giscus-account-anonymous">未登录</span>
            <button type="button" onClick={signIn}>使用 GitHub 登录</button>
          </div>
        )}
      </div>
      <div ref={containerRef} />
    </section>
  );
}
