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
}

export async function applyRateioBulk(
  upserts: RateioUpsert[],
  deletes: RateioDelete[],
  options: RateioBulkOptions
): Promise<void> {
  const { isNegotiationView, negotiationSupplierId } = options;
  if (isNegotiationView && negotiationSupplierId) {
    if (upserts.length > 0) {
      const payload = upserts.map(u => ({
        supplier_id: negotiationSupplierId,
        campaign_id: u.campaignId,
        store_id: u.storeId,
        piece_id: u.pieceId,
        quantity: u.quantity,
      }));
      for (let i = 0; i < payload.length; i += 500) {
        const { error } = await supabase
          .from('budget_negotiation_store_pieces' as never)
          .upsert(payload.slice(i, i + 500) as never, { onConflict: 'supplier_id,store_id,piece_id' });
        if (error) throw error;
      }
    }
    if (deletes.length > 0) {
      for (const d of deletes) {
        const { error } = await supabase
          .from('budget_negotiation_store_pieces' as never)
          .delete()
          .eq('supplier_id', negotiationSupplierId)
          .eq('store_id', d.storeId)
          .eq('piece_id', d.pieceId);
        if (error) throw error;
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
      for (let i = 0; i < payload.length; i += 500) {
        const { error } = await supabase
          .from('campaign_store_pieces')
          .upsert(payload.slice(i, i + 500), { onConflict: 'campaign_id,store_id,piece_id' });
        if (error) throw error;
      }
    }
    if (deletes.length > 0) {
      for (const d of deletes) {
        const { error } = await supabase
          .from('campaign_store_pieces')
          .delete()
          .eq('campaign_id', d.campaignId)
          .eq('store_id', d.storeId)
          .eq('piece_id', d.pieceId);
        if (error) throw error;
      }
    }
  }
}
