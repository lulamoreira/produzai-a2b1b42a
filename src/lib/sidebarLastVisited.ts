const KEY = "sidebar_last_visited_section";

type Map = Record<string, string>;

function read(): Map {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; }
  catch { return {}; }
}

export function getLastVisitedSection(campaignId: string): string | null {
  return read()[campaignId] || null;
}

export function setLastVisitedSection(campaignId: string, section: string) {
  try {
    const map = read();
    map[campaignId] = section;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

export function clearLastVisitedSection(campaignId: string) {
  try {
    const map = read();
    delete map[campaignId];
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}
