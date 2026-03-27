/**
 * Build a standardized export file name:
 * AgencyName_ClientName_Label_YYYY-MM-DD_HH-mm.xlsx
 */
export function buildExportFileName(
  label: string,
  opts?: { agencyName?: string; clientName?: string; extension?: string }
): string {
  const parts: string[] = [];
  if (opts?.agencyName) parts.push(sanitize(opts.agencyName));
  if (opts?.clientName) parts.push(sanitize(opts.clientName));
  parts.push(sanitize(label));

  const now = new Date();
  const date = now.toLocaleDateString("pt-BR", { year: "numeric", month: "2-digit", day: "2-digit" }).split("/").reverse().join("-");
  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", "-");
  parts.push(`${date}_${time}`);

  return `${parts.join("_")}.${opts?.extension || "xlsx"}`;
}

function sanitize(str: string): string {
  return str.replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, "").replace(/\s+/g, "_").slice(0, 40);
}
