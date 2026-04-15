import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// Auto-select content on focus for all inputs and textareas
document.addEventListener('focusin', (e) => {
  const target = e.target as HTMLElement;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.select();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
