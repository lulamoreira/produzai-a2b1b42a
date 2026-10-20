/** Shared naming convention for newly created kits. */
export function ensureKitPrefix(name: string): string {
  const trimmed = name.trim();
  return trimmed.startsWith("KIT ") ? trimmed : `KIT ${trimmed}`;
}