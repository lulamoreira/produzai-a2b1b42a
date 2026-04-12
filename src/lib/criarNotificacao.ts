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
 * Calls the database function `criar_notificacao` to dispatch notifications
 * to the correct users based on notification_settings role_scope configuration.
 */
export async function criarNotificacao(params: CriarNotificacaoParams) {
  const { error } = await supabase.rpc("criar_notificacao", {
    _agency_id: params.agency_id,
    _campaign_id: params.campaign_id ?? null,
    _store_id: params.store_id ?? null,
    _client_id: params.client_id ?? null,
    _type: params.type,
    _title: params.title,
    _body: params.body,
    _action_url: params.action_url ?? null,
  });

  if (error) {
    console.error("[criarNotificacao] Error:", error.message);
  }
}
