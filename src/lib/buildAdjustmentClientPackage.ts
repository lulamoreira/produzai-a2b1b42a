import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { buildRequoteFinalPackage } from "@/hooks/useExportRequoteFinal";
import { buildRateioGridPDF } from "@/lib/exportRateioGridPDF";

export interface AdjustmentClientPackage {
  workbookBlob: Blob;
  workbookFileName: string;
  pdfBlob: Blob;
  pdfFileName: string;
}

interface BuildParams {
  campaignId: string;
  adjustmentId: string;
  supplierId: string;
  campaignName: string;
  clientName: string;
  agencyName: string;
}

/**
 * Generates BOTH artifacts (final workbook + "Guia Visual de Rateio" PDF) for
 * an approved adjustment, using the exact same builders as the in-app
 * "Baixar planilha final" and "Exportar Rateio por Loja (Ajuste) → Peças e
 * Kits → PDF" buttons. No download is triggered — caller receives blobs.
 */
export async function buildAdjustmentClientPackage(
  params: BuildParams,
): Promise<AdjustmentClientPackage> {
  const { campaignId, adjustmentId, supplierId, campaignName, clientName, agencyName } = params;

  // ── 1. Workbook (same as Baixar planilha final) ──────────────────────────
  const workbookPromise = buildRequoteFinalPackage({
    campaignId,
    adjustmentId,
    supplierId,
  });

  // ── 2. PDF — mirror the "Ajuste" branch from CampaignDetail.tsx ─────────
  const [
    adjPiecesRes,
    adjKitsRes,
    adjKitPiecesRows,
    adjStorePiecesRows,
    adjStoresRows,
    srcPiecesRes,
    srcKitsRes,
    campaignRes,
  ] = await Promise.all([
    supabase
      .from("campaign_adjustment_pieces")
      .select("id, source_piece_id, code, name, specification, size, category, sub_location, is_new, is_deleted, kit_only")
      .eq("adjustment_id", adjustmentId),
    supabase
      .from("campaign_adjustment_kits")
      .select("id, source_kit_id, name, is_deleted")
      .eq("adjustment_id", adjustmentId),
    supabasePaginate<any>((from, to) =>
      supabase
        .from("campaign_adjustment_kit_pieces" as any)
        .select("id, kit_id, piece_id, quantity", { count: "exact" })
        .eq("adjustment_id", adjustmentId)
        .order("id")
        .range(from, to) as any,
    ),
    supabasePaginate<any>((from, to) =>
      supabase
        .from("campaign_adjustment_store_pieces" as any)
        .select("store_id, piece_id, quantity", { count: "exact" })
        .eq("adjustment_id", adjustmentId)
        .order("id")
        .range(from, to) as any,
    ),
    supabasePaginate<any>((from, to) =>
      supabase
        .from("campaign_adjustment_stores" as any)
        .select("source_store_id, name, nickname, city, state, store_code, showcase_count", { count: "exact" })
        .eq("adjustment_id", adjustmentId)
        .order("id")
        .range(from, to) as any,
    ),
    supabase
      .from("campaign_pieces")
      .select("id, code, name, image_url, image_thumb_url, image_report_url, image_full_url, specification, installation_instructions, category, sub_location, size")
      .eq("campaign_id", campaignId),
    supabase
      .from("campaign_kits")
      .select("id, code, name, image_url, category, sub_location")
      .eq("campaign_id", campaignId),
    supabase.from("campaigns").select("client_id").eq("id", campaignId).maybeSingle(),
  ]);

  const clientId = (campaignRes.data as any)?.client_id || null;
  const { data: storeRows } = clientId
    ? await supabase
        .from("client_stores")
        .select("id, name, nickname, city, state, store_code, showcase_count")
        .eq("client_id", clientId)
    : { data: [] as any[] };

  const originalPiecesById = new Map<string, any>();
  ((srcPiecesRes.data as any[]) || []).forEach((p) => originalPiecesById.set(p.id, p));
  const originalKitsById = new Map<string, any>();
  ((srcKitsRes.data as any[]) || []).forEach((k) => originalKitsById.set(k.id, k));

  const pdfPieces = ((adjPiecesRes.data as any[]) || [])
    .filter((p) => !p.is_deleted)
    .map((p) => {
      const orig = p.source_piece_id ? originalPiecesById.get(p.source_piece_id) : null;
      return {
        id: p.id,
        campaign_id: "",
        code: p.code ?? 0,
        category: p.category ?? orig?.category ?? "",
        name: p.name ?? "",
        size: p.size ?? orig?.size ?? "",
        store_category: null,
        sub_location: p.sub_location ?? orig?.sub_location ?? null,
        image_url: orig?.image_url ?? null,
        image_thumb_url: orig?.image_thumb_url ?? null,
        image_report_url: orig?.image_report_url ?? null,
        image_full_url: orig?.image_full_url ?? null,
        image_hash: null,
        specification: p.specification ?? orig?.specification ?? "",
        installation_instructions: orig?.installation_instructions ?? "",
        kit_only: !!p.kit_only,
        is_mockup: false,
        display_order: 0,
        created_at: "",
      };
    }) as any[];

  const pdfKits = ((adjKitsRes.data as any[]) || [])
    .filter((k) => !k.is_deleted)
    .map((k) => {
      const orig = k.source_kit_id ? originalKitsById.get(k.source_kit_id) : null;
      return {
        id: k.id,
        campaign_id: "",
        name: k.name ?? "",
        code: orig?.code ?? 0,
        display_order: 0,
        image_url: orig?.image_url ?? null,
        image_report_url: (orig as any)?.image_report_url ?? null,
        is_mockup: false,
        category: orig?.category ?? null,
        sub_location: orig?.sub_location ?? null,
        created_at: "",
      };
    }) as any[];

  const pdfKitPieces = ((adjKitPiecesRows as any[]) || []).map((kp) => ({
    id: kp.id,
    kit_id: kp.kit_id,
    piece_id: kp.piece_id,
    quantity: Number(kp.quantity) || 0,
    display_order: 0,
    created_at: "",
  })) as any[];

  const pdfQtyMap: Record<string, number> = {};
  ((adjStorePiecesRows as any[]) || []).forEach((sp) => {
    pdfQtyMap[`${sp.store_id}-${sp.piece_id}`] = Number(sp.quantity) || 0;
  });

  // Filter stores to those participating in the adjustment rateio
  const storeIdsInRateio = new Set(
    (adjStorePiecesRows as any[]).map((r) => String(r.store_id)),
  );
  const currentStoreById = new Map(((storeRows as any[]) || []).map((s) => [String(s.id), s]));
  const snapshotStoreById = new Map(
    ((adjStoresRows as any[]) || [])
      .filter((s) => s.source_store_id)
      .map((s) => [String(s.source_store_id), s]),
  );
  const pdfStores = Array.from(storeIdsInRateio).map((id) => {
    const current = currentStoreById.get(id);
    if (current) return current;
    const snap = snapshotStoreById.get(id) as any;
    return {
      id,
      name: snap?.name || "Loja removida",
      nickname: snap?.nickname || null,
      city: snap?.city || null,
      state: snap?.state || null,
      store_code: snap?.store_code || null,
      showcase_count: Number(snap?.showcase_count || 0),
    };
  }) as any[];

  const pdfPromise = buildRateioGridPDF(
    pdfPieces,
    pdfKits,
    pdfKitPieces,
    pdfStores,
    pdfQtyMap,
    campaignName,
    clientName,
    agencyName,
    "pieces_and_kits",
    undefined,
    "Ajuste",
  );

  const [{ blob: workbookBlob, fileName: workbookFileName }, { blob: pdfBlob, fileName: pdfFileName }] =
    await Promise.all([workbookPromise, pdfPromise]);

  return { workbookBlob, workbookFileName, pdfBlob, pdfFileName };
}
