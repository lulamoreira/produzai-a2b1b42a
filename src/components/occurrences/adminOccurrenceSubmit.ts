import { supabase } from "@/integrations/supabase/client";
import type { LalPeca } from "@/lib/adminOccurrence";

export interface AdminOccurrenceEntry {
  key: string;
  pecaId: string;
  motiveId: string;
  description: string;
  priority: string;
  photos: string[];
}

/** Token do portal da loja nesta campanha (cria se ainda não existir), igual ao "Gerar link". */
export async function ensureStoreToken(campaignId: string, storeId: string): Promise<string> {
  const { data: existing, error: selErr } = await supabase
    .from("store_portal_tokens")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing?.id) return existing.id;
  const { error } = await supabase
    .from("store_portal_tokens")
    .upsert({ campaign_id: campaignId, store_id: storeId }, { onConflict: "campaign_id,store_id", ignoreDuplicates: true });
  if (error) throw error;
  const { data, error: againErr } = await supabase
    .from("store_portal_tokens")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("store_id", storeId)
    .single();
  if (againErr) throw againErr;
  if (!data?.id) throw new Error("não foi possível obter o link do portal da loja");
  return data.id;
}

/**
 * Grava cada ocorrência como o portal do lojista grava (store_occurrence_reports),
 * uma por vez. Uma falha não desfaz as já gravadas; devolve quais falharam.
 * A notificação sai pelo gatilho do banco, como no portal.
 */
export async function submitAdminOccurrences(input: {
  campaignId: string;
  storeId: string;
  tokenId: string;
  reporterType: string;
  internalNote: string;
  entries: AdminOccurrenceEntry[];
  pecaById: Map<string, LalPeca>;
}): Promise<{ saved: number; failed: Array<{ index: number; message: string }> }> {
  let saved = 0;
  const failed: Array<{ index: number; message: string }> = [];
  for (let i = 0; i < input.entries.length; i++) {
    const e = input.entries[i];
    const peca = input.pecaById.get(e.pecaId);
    try {
      if (!peca) throw new Error("peça não encontrada");
      const { error } = await supabase.from("store_occurrence_reports").insert({
        token_id: input.tokenId,
        campaign_id: input.campaignId,
        store_id: input.storeId,
        loja_a_loja_peca_id: peca.id,
        tipo_id: peca.tipo_id,
        subdivisao_id: peca.subdivisao_id,
        description: e.description.trim() || null,
        priority: e.priority,
        photo_urls: e.photos.length > 0 ? e.photos : null,
        reporter_type: input.reporterType,
        motive_id: e.motiveId,
        agency_notes: input.internalNote,
      });
      if (error) throw error;
      saved++;
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err);
      failed.push({ index: i, message });
    }
  }
  return { saved, failed };
}
