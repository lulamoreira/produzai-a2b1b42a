import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { saveBlobAs } from "@/lib/saveBlobAs";
import {
  buildRequoteFinalWorkbook,
  type RequoteFinalKit,
  type RequoteFinalPiece,
  type RequoteFinalStore,
  type RequoteFinalStoreQty,
} from "@/lib/buildRequoteFinalWorkbook";

/**
 * Fetches everything needed for the final post-approval requote workbook and
 * triggers a browser download.
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
        piecesRes,
        kitsRes,
        kitPiecesRes,
        adjStoresRes,
        storeQtyRes,
        baselineRes,
        extrasRes,
      ] = await Promise.all([
        supabase.from("campaigns").select("name").eq("id", campaignId).maybeSingle(),
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
          .select("id, code, name, specification")
          .eq("adjustment_id", adjustmentId)
          .eq("is_deleted", false),
        supabase
          .from("campaign_adjustment_kits")
          .select("id, name")
          .eq("adjustment_id", adjustmentId)
          .eq("is_deleted", false),
        supabase
          .from("campaign_adjustment_kit_pieces" as any)
          .select("kit_id, piece_id, quantity")
          .eq("adjustment_id", adjustmentId),
        supabase
          .from("campaign_adjustment_stores" as any)
          .select("id, name, nickname, city, state, store_code, is_deleted")
          .eq("adjustment_id", adjustmentId)
          .eq("is_deleted", false),
        supabase
          .from("campaign_adjustment_store_pieces" as any)
          .select("store_id, piece_id, quantity")
          .eq("adjustment_id", adjustmentId),
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

      const requoteData = requoteRes.data as any;
      const submittedPrices = new Map<string, number>();
      const submittedKitPrices = new Map<string, number>();
      const j = (requoteData?.adjusted_prices_jsonb || {}) as any;
      for (const p of j.prices || []) {
        if (p.piece_id != null) submittedPrices.set(String(p.piece_id), Number(p.new_price) || 0);
      }
      for (const k of j.kits || []) {
        if (k.kit_id != null) submittedKitPrices.set(String(k.kit_id), Number(k.new_price) || 0);
      }

      const baselineRows = (baselineRes.data as any[]) || [];
      const baselineByPiece = new Map<string, number>();
      for (const r of baselineRows) {
        if (!r.piece_id) continue;
        baselineByPiece.set(
          String(r.piece_id),
          Number(r.adjusted_unit_price ?? r.unit_price ?? 0),
        );
      }
      const getBaseline = (pieceId: string) => baselineByPiece.get(String(pieceId)) ?? 0;

      // Compute per-piece total qty across all stores
      const storeQtyRows = (storeQtyRes.data as any[]) || [];
      const qtyByPiece = new Map<string, number>();
      for (const q of storeQtyRows) {
        const k = String(q.piece_id);
        qtyByPiece.set(k, (qtyByPiece.get(k) || 0) + Number(q.quantity || 0));
      }

      // Kit -> list of piece ids
      const kitPiecesRows = (kitPiecesRes.data as any[]) || [];
      const piecesByKit = new Map<string, { pieceId: string; quantityInKit: number }[]>();
      for (const kp of kitPiecesRows) {
        const arr = piecesByKit.get(String(kp.kit_id)) || [];
        arr.push({ pieceId: String(kp.piece_id), quantityInKit: Number(kp.quantity || 0) });
        piecesByKit.set(String(kp.kit_id), arr);
      }
      // Build inverse: piece -> kit_id (first one)
      const kitByPiece = new Map<string, string>();
      for (const [kitId, list] of piecesByKit) {
        for (const { pieceId } of list) {
          if (!kitByPiece.has(pieceId)) kitByPiece.set(pieceId, kitId);
        }
      }

      const pieceRows = (piecesRes.data as any[]) || [];
      const pieceById = new Map(pieceRows.map((p) => [String(p.id), p]));

      const pieces: RequoteFinalPiece[] = pieceRows.map((p) => {
        const id = String(p.id);
        return {
          id,
          code: String(p.code ?? ""),
          name: String(p.name ?? ""),
          specification: p.specification ?? null,
          kitId: kitByPiece.get(id) ?? null,
          previousPrice: getBaseline(id),
          newPrice: submittedPrices.get(id) ?? getBaseline(id),
          totalQty: qtyByPiece.get(id) ?? 0,
        };
      });

      const kits: RequoteFinalKit[] = ((kitsRes.data as any[]) || []).map((k) => {
        const id = String(k.id);
        const memberList = piecesByKit.get(id) || [];
        const kitPiecesDetailed = memberList.map(({ pieceId, quantityInKit }) => {
          const meta = pieceById.get(pieceId) || {};
          return {
            id: pieceId,
            code: String((meta as any).code ?? ""),
            name: String((meta as any).name ?? ""),
            previousPrice: getBaseline(pieceId),
            newPrice: submittedPrices.get(pieceId) ?? getBaseline(pieceId),
            quantityInKit,
          };
        });
        const prevKit = kitPiecesDetailed.reduce((s, p) => s + p.previousPrice * p.quantityInKit, 0);
        const newKit =
          submittedKitPrices.get(id) ??
          kitPiecesDetailed.reduce((s, p) => s + p.newPrice * p.quantityInKit, 0);
        return {
          id,
          name: String(k.name ?? ""),
          previousPrice: prevKit,
          newPrice: newKit,
          totalQty: 0, // kits don't have direct store rateio in adjustment schema
          pieces: kitPiecesDetailed,
        };
      });

      const stores: RequoteFinalStore[] = ((adjStoresRes.data as any[]) || []).map((s) => ({
        id: String(s.id),
        name: String(s.nickname || s.name || ""),
        code: s.store_code ?? null,
        city: s.city ?? null,
        state: s.state ?? null,
      }));

      // storeQuantities: adjustment_store_pieces use the live store_id which points to
      // campaign_adjustment_stores.id in this module
      const storeQuantities: RequoteFinalStoreQty[] = storeQtyRows.map((q) => ({
        storeId: String(q.store_id),
        pieceId: String(q.piece_id),
        quantity: Number(q.quantity || 0),
      }));

      const extras = (extrasRes.data as any) || {};
      const previousInstallation = Number(extras.adjusted_installation_value ?? extras.installation_value ?? 0);
      const previousFreight = Number(extras.adjusted_freight_value ?? extras.freight_value ?? 0);
      const ex = (requoteData?.adjusted_extras_jsonb || {}) as any;
      const installation = Number(ex.installation ?? j.installation ?? previousInstallation);
      const freight = Number(ex.freight ?? j.freight ?? previousFreight);

      const { blob, fileName } = await buildRequoteFinalWorkbook({
        campaignName: (campaignRes.data as any)?.name ?? "",
        adjustmentName: (adjustmentRes.data as any)?.name ?? "",
        supplierName: (supplierRes.data as any)?.company_name ?? "",
        pieces,
        kits,
        stores,
        storeQuantities,
        installation,
        freight,
        previousInstallation,
        previousFreight,
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
