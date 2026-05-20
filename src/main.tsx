import { createRoot } from "react-dom/client";
import "geist/dist/fonts/geist-sans/style.css";
import "geist/dist/fonts/geist-mono/style.css";
import App from "./App.tsx";
import "./index.css";
import "./styles/aqua-theme.css";
import "./i18n";

// Auto-select content on focus for all inputs and textareas
document.addEventListener('focusin', (e) => {
  const target = e.target as HTMLElement;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.select();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
