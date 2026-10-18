import { useCallback, useEffect, useState } from "react";
import ErrorBoundary from "./ErrorBoundary";
import ReadingView from "./ReadingView";

const THEME_KEY = "sy-theme";

function getInitialTheme() {
  if (typeof window === "undefined") return "oriental";
  try {
    return window.localStorage.getItem(THEME_KEY) || document.documentElement.dataset.theme || "oriental";
  } catch {
    return document.documentElement.dataset.theme || "oriental";
  }
}

function getInitialReadingTheme() {
  if (typeof window === "undefined") return "oriental";
  try {
    const theme = window.localStorage.getItem(THEME_KEY);
    return ["oriental", "magazine", "night"].includes(theme) ? theme : "oriental";
  } catch {
    return "oriental";
  }
}

function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.assign("/");
}

export default function ReadingApp({ essay, essays, essayOrder, contentData, giscus }) {
  const [theme, setTheme] = useState(getInitialReadingTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const handleThemeChange = useCallback((nextTheme) => setTheme(nextTheme), []);

  return (
    <ErrorBoundary resetLabel="重新加载" onReset={() => window.location.reload()}>
      <ReadingView
        essay={essay}
        essays={essays}
        essayOrder={essayOrder}
        contentData={contentData}
        giscus={giscus}
        theme={theme}
        onThemeChange={handleThemeChange}
        onBack={goBack}
      />
    </ErrorBoundary>
  );
}
