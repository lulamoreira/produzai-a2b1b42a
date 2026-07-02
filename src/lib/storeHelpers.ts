import type { ClientStore } from "@/hooks/useMultiClientData";
import type { StoreContact } from "@/hooks/useStoreContacts";

type StoreIdentityInput = {
  name?: string | null;
  cnpj?: string | null;
};

/** Normalize store names for identity comparisons without changing display text. */
export function normalizeStoreIdentityName(name?: string | null): string {
  return (name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/** Normalize CNPJ/tax-id-like values by comparing digits only. */
export function normalizeStoreIdentityCnpj(cnpj?: string | null): string {
  return (cnpj ?? "").replace(/\D/g, "");
}

/**
 * Build the store import identity key.
 * When CNPJ is available, name + CNPJ is the canonical identity; otherwise we
 * only fall back to name for records that truly do not carry CNPJ.
 */
export function getStoreIdentityKey(store: StoreIdentityInput): string {
  const name = normalizeStoreIdentityName(store.name);
  const cnpj = normalizeStoreIdentityCnpj(store.cnpj);

  if (name && cnpj) return `name_cnpj:${name}:${cnpj}`;
  if (name) return `name:${name}`;
  if (cnpj) return `cnpj:${cnpj}`;
  return "";
}

/** Build a displayable address string from a store record */
export function buildAddress(store: Pick<ClientStore, "street" | "number" | "complement" | "neighborhood" | "city" | "state" | "zip_code">) {
  return [store.street, store.number, store.complement, store.neighborhood, store.city, store.state, store.zip_code]
    .filter(Boolean)
    .join(", ") || "Endereço não cadastrado";
}

/** Get store display name (nickname preferred) */
export function getStoreName(stores: ClientStore[], id: string | null): string {
  if (!id) return "—";
  const s = stores.find((st) => st.id === id);
  return s?.nickname || s?.name || "—";
}

/** Build contacts-by-store lookup map */
export function buildContactsByStoreMap(contacts: StoreContact[]): Record<string, StoreContact[]> {
  const map: Record<string, StoreContact[]> = {};
  contacts.forEach((c) => {
    (map[c.store_id] = map[c.store_id] || []).push(c);
  });
  return map;
}

/** Extract unique sorted states from stores */
export function getUniqueStates(stores: ClientStore[]): string[] {
  return [...new Set(stores.map((s) => s.state?.trim()).filter(Boolean) as string[])].sort();
}

/** Extract unique sorted cities from stores, optionally filtered by state */
export function getUniqueCities(stores: ClientStore[], filterState?: string): string[] {
  const filtered = filterState ? stores.filter((s) => s.state?.trim() === filterState) : stores;
  return [...new Set(filtered.map((s) => s.city).filter(Boolean) as string[])].sort();
}

/** Match a store by search term (name, nickname, store_code) */
export function matchesStoreSearch(store: ClientStore, term: string): boolean {
  if (!term) return true;
  const lower = term.toLowerCase();
  return (
    store.name.toLowerCase().includes(lower) ||
    (store.nickname || "").toLowerCase().includes(lower) ||
    (store.store_code || "").toLowerCase().includes(lower) ||
    (store.city || "").toLowerCase().includes(lower) ||
    (store.state || "").toLowerCase().includes(lower)
  );
}
