import { supabase } from '@/integrations/supabase/client';

export interface RateioUpsert {
  campaignId: string;
  storeId: string;
  pieceId: string;
  quantity: number;
}

export interface RateioDelete {
  campaignId: string;
  storeId: string;
  pieceId: string;
}

export interface RateioBulkOptions {
  isNegotiationView: boolean;
  negotiationSupplierId?: string | null;
  isAdjustmentView?: boolean;
  adjustmentId?: string | null;
  /** Map of source (campaign) piece_id -> adjustment piece_id. Required for adjustment writes. */
  srcToAdjPieceId?: Map<string, string>;
}

export async function applyRateioBulk(
  upserts: RateioUpsert[],
  deletes: RateioDelete[],
  options: RateioBulkOptions
): Promise<void> {
  const { isNegotiationView, negotiationSupplierId, isAdjustmentView, adjustmentId, srcToAdjPieceId } = options;
  
  // ━━━ REDE DE SEGURANÇA: deduplica upserts pela chave única ━━━
  // O Postgres não permite múltiplos upserts da mesma chave em um único comando.
  // Aqui aplicamos "último vence" como fallback. Se o caller precisar de soma,
  // ele deve agregar ANTES de chamar esta função.
  const dedupedMap = new Map<string, RateioUpsert>();
  for (const u of upserts) {
    const key = `${u.campaignId}|${u.storeId}|${u.pieceId}`;
    dedupedMap.set(key, u);
  }
  upserts = Array.from(dedupedMap.values());
  
  if (isAdjustmentView && adjustmentId) {
    const translate = (pid: string) => srcToAdjPieceId?.get(pid) ?? pid;
    if (upserts.length > 0) {
      const payload = upserts
        .map(u => {
          const adjPid = srcToAdjPieceId?.get(u.pieceId);
          // Se não há mapeamento, salva com o ID de origem diretamente
          // (peças componentes de kit podem não estar no campaign_adjustment_pieces)
          return {
            adjustment_id: adjustmentId,
            store_id: u.storeId,
            piece_id: adjPid ?? u.pieceId,
            quantity: u.quantity,
          };
        })
        .filter(Boolean) as any[];

      // Dedup safety net: elimina duplicatas por (adjustment_id, store_id, piece_id)
      const seenMap = new Map<string, typeof payload[0]>();
      for (const row of payload) {
        seenMap.set(`${row.adjustment_id}|${row.store_id}|${row.piece_id}`, row);
      }
      const safePayload = Array.from(seenMap.values());

      for (let i = 0; i < safePayload.length; i += 500) {
        const { error } = await supabase
          .from('campaign_adjustment_store_pieces' as never)
          .upsert(safePayload.slice(i, i + 500) as never, { onConflict: 'adjustment_id,store_id,piece_id' });
        if (error) throw error;
      }
    }
    if (deletes.length > 0) {
      // Group by store_id and delete using IN(piece_ids) to reduce request count.
      const byStore = new Map<string, string[]>();
      for (const d of deletes) {
        const adjPid = translate(d.pieceId);
        if (!adjPid) continue;
        const arr = byStore.get(d.storeId) ?? [];
        arr.push(adjPid);
        byStore.set(d.storeId, arr);
      }
      const entries = Array.from(byStore.entries());
      const CONCURRENCY = 4;
      for (let i = 0; i < entries.length; i += CONCURRENCY) {
        const batch = entries.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async ([storeId, pieceIds]) => {
          for (let j = 0; j < pieceIds.length; j += 200) {
            const slice = pieceIds.slice(j, j + 200);
            const { error } = await supabase
              .from('campaign_adjustment_store_pieces' as never)
              .delete()
              .eq('adjustment_id', adjustmentId)
              .eq('store_id', storeId)
              .in('piece_id', slice);
            if (error) throw error;
          }
        }));
      }
    }
  } else if (isNegotiationView && negotiationSupplierId) {
    if (upserts.length > 0) {
      const payload = upserts.map(u => ({
        supplier_id: negotiationSupplierId,
        campaign_id: u.campaignId,
        store_id: u.storeId,
        piece_id: u.pieceId,
        quantity: u.quantity,
      }));

      // Dedup safety net: elimina duplicatas por (supplier_id, store_id, piece_id)
      const seenMap = new Map<string, typeof payload[0]>();
      for (const row of payload) {
        seenMap.set(`${row.supplier_id}|${row.store_id}|${row.piece_id}`, row);
      }
      const safePayload = Array.from(seenMap.values());

      for (let i = 0; i < safePayload.length; i += 500) {
        const { error } = await supabase
          .from('budget_negotiation_store_pieces' as never)
          .upsert(safePayload.slice(i, i + 500) as never, { onConflict: 'supplier_id,store_id,piece_id' });
        if (error) throw error;
      }
    }
    if (deletes.length > 0) {
      const byStore = new Map<string, string[]>();
      for (const d of deletes) {
        const arr = byStore.get(d.storeId) ?? [];
        arr.push(d.pieceId);
        byStore.set(d.storeId, arr);
      }
      const entries = Array.from(byStore.entries());
      const CONCURRENCY = 4;
      for (let i = 0; i < entries.length; i += CONCURRENCY) {
        const batch = entries.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async ([storeId, pieceIds]) => {
          for (let j = 0; j < pieceIds.length; j += 200) {
            const slice = pieceIds.slice(j, j + 200);
            const { error } = await supabase
              .from('budget_negotiation_store_pieces' as never)
              .delete()
              .eq('supplier_id', negotiationSupplierId)
              .eq('store_id', storeId)
              .in('piece_id', slice);
            if (error) throw error;
          }
        }));
      }
    }
  } else {
    if (upserts.length > 0) {
      const payload = upserts.map(u => ({
        campaign_id: u.campaignId,
        store_id: u.storeId,
        piece_id: u.pieceId,
        quantity: u.quantity,
      }));

      // Dedup safety net: elimina duplicatas por (campaign_id, store_id, piece_id)
      const seenMap = new Map<string, typeof payload[0]>();
      for (const row of payload) {
        seenMap.set(`${row.campaign_id}|${row.store_id}|${row.piece_id}`, row);
      }
      const safePayload = Array.from(seenMap.values());

      for (let i = 0; i < safePayload.length; i += 500) {
        const { error } = await supabase
          .from('campaign_store_pieces')
          .upsert(safePayload.slice(i, i + 500), { onConflict: 'campaign_id,store_id,piece_id' });
        if (error) throw error;
      }
    }
    if (deletes.length > 0) {
      // Group deletes by (campaignId, storeId) and use IN(piece_ids) to drastically
      // reduce HTTP calls — avoids "Failed to fetch" from browser connection limits.
      const byKey = new Map<string, { campaignId: string; storeId: string; pieceIds: string[] }>();
      for (const d of deletes) {
        const k = `${d.campaignId}|${d.storeId}`;
        const entry = byKey.get(k) ?? { campaignId: d.campaignId, storeId: d.storeId, pieceIds: [] };
        entry.pieceIds.push(d.pieceId);
        byKey.set(k, entry);
      }
      const entries = Array.from(byKey.values());
      const CONCURRENCY = 4;
      for (let i = 0; i < entries.length; i += CONCURRENCY) {
        const batch = entries.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (e) => {
          for (let j = 0; j < e.pieceIds.length; j += 200) {
            const slice = e.pieceIds.slice(j, j + 200);
            const { error } = await supabase
              .from('campaign_store_pieces')
              .delete()
              .eq('campaign_id', e.campaignId)
              .eq('store_id', e.storeId)
              .in('piece_id', slice);
            if (error) throw error;
          }
        }));
      }
    }
  }
}
