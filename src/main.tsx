import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/aqua-theme.css";
import "./styles/v2-themes.css";
import "./styles/color-palettes.css";
import "./i18n";
import { bootstrapColorTheme } from "@/hooks/useColorTheme";

bootstrapColorTheme();

// "ResizeObserver loop ..." is a benign browser notice (layout settled in the
// next frame). Swallow it so error overlays/handlers don't treat it as a crash.
window.addEventListener(
  "error",
  (e) => {
    if (typeof e.message === "string" && e.message.startsWith("ResizeObserver loop")) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  },
  true,
);

// After a new publish, stale chunks fail to load: reload once to fetch the new version.
window.addEventListener("vite:preloadError", () => {
  const key = "chunk_reload_at";
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last > 30000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
});

// Auto-select content on focus for all inputs and textareas
document.addEventListener('focusin', (e) => {
  const target = e.target as HTMLElement;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.select();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
