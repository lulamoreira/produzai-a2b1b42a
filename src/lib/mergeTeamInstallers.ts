/** Minimal installer fields used to compare and copy between teams. */
export interface InstallerFields {
  name: string;
  phone: string | null;
  cpf: string | null;
  rg: string | null;
  is_leader: boolean | null;
  is_unified_doc: boolean | null;
}

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
const rgKey = (v: string | null | undefined) => (v ?? "").replace(/[^0-9a-z]/gi, "").toUpperCase();
const nameKey = (v: string | null | undefined) =>
  (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

/** Same person when CPF/RU, RG or name match. */
export function isSameInstaller(a: InstallerFields, b: InstallerFields): boolean {
  const ca = digits(a.cpf), cb = digits(b.cpf);
  if (ca && ca === cb) return true;
  const ra = rgKey(a.rg), rb = rgKey(b.rg);
  if (ra && ra === rb) return true;
  const na = nameKey(a.name);
  return !!na && na === nameKey(b.name);
}

/**
 * Adds installers from `source` that are missing in `current`.
 * Existing installers are kept untouched; duplicates are skipped.
 * Copied installers lose leadership when the team already has a leader.
 */
export function mergeInstallers<T extends InstallerFields>(current: InstallerFields[], source: T[]) {
  const accepted: InstallerFields[] = [...current];
  const toAdd: InstallerFields[] = [];
  let skipped = 0;
  for (const s of source) {
    if (accepted.some((c) => isSameInstaller(c, s))) { skipped++; continue; }
    const hasLeader = accepted.some((c) => c.is_leader);
    const copy: InstallerFields = {
      name: s.name, phone: s.phone, cpf: s.cpf, rg: s.rg,
      is_unified_doc: s.is_unified_doc, is_leader: !!s.is_leader && !hasLeader,
    };
    accepted.push(copy);
    toAdd.push(copy);
  }
  return { toAdd, skipped };
}
