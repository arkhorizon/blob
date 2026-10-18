import { useEffect, useRef } from "react";

function themeUrl(filename) {
    const base = import.meta.env.BASE_URL.endsWith("/")
        ? import.meta.env.BASE_URL
        : `${import.meta.env.BASE_URL}/`;
    return new URL(
        `${base}giscus/${filename}?v=comment-style-v6`,
        window.location.origin
    ).toString();
}

const GISCUS_THEMES = {
  oriental: "shiye-oriental.css",
  magazine: "shiye-magazine.css",
  night: "shiye-night.css"
};

export default function GiscusComments({ config, theme }) {
    const containerRef = useRef(null);

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
            script.setAttribute("data-strict", "true");
            script.setAttribute("data-reactions-enabled", "1");
            script.setAttribute("data-emit-metadata", "0");
            script.setAttribute("data-input-position", "top");
            script.setAttribute("data-theme", themeUrl(GISCUS_THEMES[theme] ?? GISCUS_THEMES.oriental));
            script.setAttribute("data-lang", "zh-CN");
            script.setAttribute("data-loading", "lazy");
            script.onerror = () => {
                container.innerHTML = '<p class="giscus-error">评论加载失败，请检查网络后重试。</p>';
            };
            container.append(script);
        }, { rootMargin: "400px 0px" });
        observer.observe(container);

        return () => observer.disconnect();
    }, [config, theme]);

    if (!config.enabled) return null;

    return (
        <section className="giscus-comments" aria-label="评论">
            <h2>评论</h2>
            <div ref={containerRef} />
        </section>
    );
}
