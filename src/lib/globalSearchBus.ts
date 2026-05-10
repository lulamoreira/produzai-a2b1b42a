// Tiny event bus to open the global search dialog from anywhere.
const EVT = "produzai:open-global-search";

export function openGlobalSearch() {
  window.dispatchEvent(new Event(EVT));
}

export function onOpenGlobalSearch(handler: () => void): () => void {
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}
