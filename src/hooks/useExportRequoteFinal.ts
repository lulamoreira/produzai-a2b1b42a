import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { saveBlobAs } from "@/lib/saveBlobAs";
import { buildRequoteFinalWorkbook } from "@/lib/buildRequoteFinalWorkbook";

/**
 * Fetches everything needed for the final post-approval requote workbook and
 * triggers a browser download. Uses the same Matriz Lojas x Peças layout as
 * the standard Rateio export, with an additional "Preços (Recotação)" sheet
 * listing all pieces + kits with their previous / new unit prices and totals.
 */
export function useExportRequoteFinal(
  campaignId: string | undefined,
  adjustmentId: string | undefined,
  supplierId: string | undefined | null,
) {
  const [isExporting, setIsExporting] = useState(false);

  const exportFinal = async () => {
    if (!campaignId || !adjustmentId || !supplierId) {
      toast.error("Faltam dados para gerar a planilha.");
      return;
    }
    setIsExporting(true);
    try {
      const [
        campaignRes,
        adjustmentRes,
        supplierRes,
        requoteRes,
        adjPiecesRes,
        adjKitsRes,
        srcPiecesRes,
        srcKitsRes,
        adjKitPiecesRows,
        adjStorePiecesRows,
        baselineRows,
        extrasRes,
      ] = await Promise.all([
        supabase.from("campaigns").select("name, client_id").eq("id", campaignId).maybeSingle(),
        supabase.from("campaign_adjustments").select("name").eq("id", adjustmentId).maybeSingle(),
        supabase.from("budget_suppliers").select("company_name").eq("id", supplierId).maybeSingle(),
        supabase
          .from("campaign_adjustment_budget_request" as any)
          .select("adjusted_prices_jsonb, adjusted_extras_jsonb, status")
          .eq("adjustment_id", adjustmentId)
          .eq("supplier_id", supplierId)
          .maybeSingle(),
        supabase
          .from("campaign_adjustment_pieces")
          .select("id, source_piece_id, code, name, specification, size, category, sub_location, is_new, is_deleted, kit_only")
          .eq("adjustment_id", adjustmentId),
        supabase
          .from("campaign_adjustment_kits")
          .select("id, source_kit_id, name, is_deleted")
          .eq("adjustment_id", adjustmentId),
        supabase
          .from("campaign_pieces")
          .select("id, code, name, image_url, image_thumb_url, image_report_url, image_full_url, specification, installation_instructions, category, sub_location, size")
          .eq("campaign_id", campaignId),
        supabase
          .from("campaign_kits")
          .select("id, code, name, image_url, category, sub_location")
          .eq("campaign_id", campaignId),
        supabasePaginate<any>((from, to) =>
          supabase
            .from("campaign_adjustment_kit_pieces" as any)
            .select("id, kit_id, piece_id, quantity")
            .eq("adjustment_id", adjustmentId)
            .range(from, to) as any,
        ),
        supabasePaginate<any>((from, to) =>
          supabase
            .from("campaign_adjustment_store_pieces" as any)
            .select("store_id, piece_id, quantity")
            .eq("adjustment_id", adjustmentId)
            .range(from, to) as any,
        ),
        supabase
          .from("budget_prices" as any)
          .select("piece_id, unit_price, adjusted_unit_price")
          .eq("supplier_id", supplierId),
        supabase
          .from("budget_extra_costs" as any)
          .select("installation_value, freight_value, adjusted_installation_value, adjusted_freight_value")
          .eq("supplier_id", supplierId)
          .maybeSingle(),
      ]);

      const clientId = (campaignRes.data as any)?.client_id || null;
      const { data: storeRows } = clientId
        ? await supabase
            .from("client_stores")
            .select("id, name, nickname, city, state, store_code, showcase_count")
            .eq("client_id", clientId)
        : { data: [] as any[] };

      // Approved new prices + extras
      const requoteData = requoteRes.data as any;
      const j = (requoteData?.adjusted_prices_jsonb || {}) as any;
      const newPriceByAdjPiece: Record<string, number> = {};
      for (const row of j.prices || []) {
        if (row.piece_id != null)
          newPriceByAdjPiece[String(row.piece_id)] = Number(row.new_price) || 0;
      }
      const ex = (requoteData?.adjusted_extras_jsonb || {}) as any;
      const extras = (extrasRes.data as any) || {};
      const previousInstallation = Number(
        extras.adjusted_installation_value ?? extras.installation_value ?? 0,
      );
      const previousFreight = Number(
        extras.adjusted_freight_value ?? extras.freight_value ?? 0,
      );
      const newInstallation = Number(
        ex.installation ?? j.installation ?? previousInstallation,
      );
      const newFreight = Number(ex.freight ?? j.freight ?? previousFreight);

      // Baseline prices keyed by source piece id
      const previousPriceBySourcePiece: Record<string, number> = {};
      for (const r of (baselineRows.data as any[]) || []) {
        if (!r.piece_id) continue;
        previousPriceBySourcePiece[String(r.piece_id)] = Number(
          r.adjusted_unit_price ?? r.unit_price ?? 0,
        );
      }

      // Filter stores to those actually present in the rateio (avoid huge
      // empty tabs for stores that don't participate in this campaign).
      const storeIdsInRateio = new Set(
        (adjStorePiecesRows as any[]).map((r) => String(r.store_id)),
      );
      const usedStores = ((storeRows as any[]) || []).filter((s) =>
        storeIdsInRateio.has(String(s.id)),
      );

      const { blob, fileName } = await buildRequoteFinalWorkbook({
        campaignName: (campaignRes.data as any)?.name ?? "",
        adjustmentName: (adjustmentRes.data as any)?.name ?? "Ajuste",
        supplierName: (supplierRes.data as any)?.company_name ?? "",
        currencyCode: "BRL",
        adjPieces: ((adjPiecesRes.data as any[]) || []) as any,
        adjKits: ((adjKitsRes.data as any[]) || []) as any,
        adjKitPieces: ((adjKitPiecesRows as any[]) || []) as any,
        adjStorePieces: ((adjStorePiecesRows as any[]) || []).map((r: any) => ({
          store_id: String(r.store_id),
          piece_id: String(r.piece_id),
          quantity: Number(r.quantity || 0),
        })),
        stores: usedStores.length > 0 ? (usedStores as any) : ((storeRows as any[]) || []),
        sourcePieces: ((srcPiecesRes.data as any[]) || []) as any,
        sourceKits: ((srcKitsRes.data as any[]) || []) as any,
        previousPriceBySourcePiece,
        newPriceByAdjPiece,
        previousInstallation,
        previousFreight,
        newInstallation,
        newFreight,
        generatedAt: new Date(),
      });

      saveBlobAs(blob, fileName);
      toast.success("Planilha final gerada com sucesso!");
    } catch (e: any) {
      console.error("[useExportRequoteFinal]", e);
      toast.error(e?.message || "Erro ao gerar planilha.");
    } finally {
      setIsExporting(false);
    }
  };

  return { exportFinal, isExporting };
}
