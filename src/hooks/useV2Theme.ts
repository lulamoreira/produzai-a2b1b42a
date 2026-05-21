import { useState, useEffect } from "react";

export type V2Theme = "light" | "dark" | "system" | "multicolor";

export function useV2Theme() {
  const [theme, setThemeState] = useState<V2Theme>(() => {
    return (localStorage.getItem("v2-theme") as V2Theme) || "light";
  });

  const applyTheme = (targetTheme: V2Theme) => {
    let effectiveTheme: string = targetTheme;
    
    if (targetTheme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    
    document.documentElement.setAttribute("data-v2-theme", effectiveTheme);
  };

  const setTheme = (newTheme: V2Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("v2-theme", newTheme);
    applyTheme(newTheme);
  };

  useEffect(() => {
    applyTheme(theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");
      
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  return { theme, setTheme };
}
