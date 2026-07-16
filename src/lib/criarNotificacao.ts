import { supabase } from "@/integrations/supabase/client";

interface CriarNotificacaoParams {
  agency_id: string;
  campaign_id?: string;
  store_id?: string;
  client_id?: string;
  type: string;
  title: string;
  body: string;
  action_url?: string;
}

/**
 * Calls the database function `criar_notificacao_segura` (authenticated wrapper)
 * to dispatch notifications. Requires an authenticated user with access to the
 * campaign/agency. Errors are re-thrown so callers can decide how to surface them.
 */
export async function criarNotificacao(params: CriarNotificacaoParams) {
  const { error } = await supabase.rpc("criar_notificacao_segura" as any, {
    _agency_id: params.agency_id,
    _campaign_id: params.campaign_id ?? null,
    _store_id: params.store_id ?? null,
    _client_id: params.client_id ?? null,
    _type: params.type,
    _title: params.title,
    _body: params.body,
    _action_url: params.action_url ?? null,
  } as any);

  if (error) {
    console.error("[criarNotificacao] Error:", error.message);
    throw error;
  }
}
