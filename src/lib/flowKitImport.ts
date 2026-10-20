import { ensureKitPrefix } from "./kitName";
import type { FlowParsedPiece } from "./parseFlowWorkbook";

/** Underscores in raw Flow codes delimit tokens, unlike JavaScript word boundaries. */
export function isFlowKit(sourceName: string): boolean {
  return /(^|[^\p{L}\p{N}])KIT(?=$|[^\p{L}\p{N}])/iu.test(sourceName);
}

export function flowNameWithoutKit(name: string): string {
  return name.replace(/(^|[^\p{L}\p{N}])KIT(?=$|[^\p{L}\p{N}])/giu, "$1").replace(/\s+/g, " ").trim();
}

export function buildFlowImportRecords(piece: FlowParsedPiece, campaignId: string, nextCode: number, nextOrder: number, imageUrl: string | null) {
  const kit = isFlowKit(piece.sourceName);
  const name = kit ? flowNameWithoutKit(piece.name) : piece.name.trim();
  if (!name) throw new Error("Informe o nome da peça antes de importar.");
  const common = {
    campaign_id: campaignId, category: piece.category.trim().toUpperCase(),
    sub_location: piece.subLocation.trim() || null, image_url: imageUrl,
    is_deleted: false, is_new: false, is_mockup: false,
  };
  return {
    kit: kit ? { ...common, name: ensureKitPrefix(name), code: nextCode, display_order: nextOrder } : null,
    piece: {
      ...common, name, code: nextCode + (kit ? 1 : 0), display_order: nextOrder + (kit ? 1 : 0),
      kit_only: kit, size: piece.size.trim(), specification: piece.specification.trim() || "Vide Book/Manual",
      installation_instructions: "Sem informações específicas",
    },
    nextCode: nextCode + (kit ? 2 : 1), nextOrder: nextOrder + (kit ? 2 : 1),
  };
}