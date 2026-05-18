import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Memória de e-mails por cliente.
 * Carrega os e-mails já usados em qualquer diálogo de envio para esse cliente
 * (resolvido a partir do campaignId quando necessário) e expõe um helper
 * para registrar novos e-mails após cada envio.
 */
export function useClientEmailMemory(opts: {
  clientId?: string | null;
  campaignId?: string | null;
}) {
  const queryClient = useQueryClient();
  const { clientId: clientIdProp, campaignId } = opts;

  // Resolve clientId a partir do campaignId quando não passado
  const clientIdQuery = useQuery({
    queryKey: ["campaign_client_id", campaignId],
    enabled: !clientIdProp && !!campaignId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("client_id")
        .eq("id", campaignId!)
        .maybeSingle();
      if (error) throw error;
      return data?.client_id ?? null;
    },
  });

  const clientId = clientIdProp ?? clientIdQuery.data ?? null;

  const listQuery = useQuery({
    queryKey: ["client_email_memory", clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_email_memory" as any)
        .select("email, last_used_at, usage_count")
        .eq("client_id", clientId!)
        .order("last_used_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        email: string;
        last_used_at: string;
        usage_count: number;
      }>;
    },
  });

  // Realtime: sincronizar nova memória entre abas/usuários
  useEffect(() => {
    if (!clientId) return;
    const ch = supabase
      .channel(`client-email-memory-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_email_memory",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["client_email_memory", clientId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [clientId, queryClient]);

  const suggestions = useMemo(
    () => (listQuery.data ?? []).map((r) => r.email),
    [listQuery.data]
  );

  const recordMutation = useMutation({
    mutationFn: async (emails: string[]) => {
      if (!clientId) return;
      const cleaned = Array.from(
        new Set(
          (emails || [])
            .map((e) => (e || "").trim().toLowerCase())
            .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
        )
      );
      if (cleaned.length === 0) return;
      const { error } = await supabase.rpc("record_client_emails" as any, {
        _client_id: clientId,
        _emails: cleaned,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: ["client_email_memory", clientId] });
      }
    },
  });

  return {
    clientId,
    suggestions,
    isLoading: listQuery.isLoading || clientIdQuery.isLoading,
    record: (emails: string[]) => {
      // fire-and-forget; falhas não devem bloquear envios
      recordMutation.mutate(emails, {
        onError: (e) => console.warn("[email-memory] record failed", e),
      });
    },
  };
}
