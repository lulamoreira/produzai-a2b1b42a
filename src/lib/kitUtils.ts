/**
 * Returns the display name for a kit with the "KIT " prefix.
 * Use this for all UI rendering. Do NOT use for exports or editable inputs.
 */
export function getKitDisplayName(kit: { name: string }): string {
  return `KIT ${kit.name}`;
}
