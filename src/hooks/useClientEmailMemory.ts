import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Memória de e-mails por Agência.
 * Carrega os e-mails já usados em qualquer diálogo de envio para esta agência
 * (resolvido a partir do clientId ou campaignId) e expõe um helper
 * para registrar novos e-mails após cada envio.
 */
export function useClientEmailMemory(opts: {
  clientId?: string | null;
  campaignId?: string | null;
}) {
  const queryClient = useQueryClient();
  const { clientId: clientIdProp, campaignId } = opts;

  // Resolve agencyId starting from clientId or campaignId
  const agencyIdQuery = useQuery({
    queryKey: ["resolve_agency_id", clientIdProp, campaignId],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      if (clientIdProp) {
        const { data } = await supabase.from("clients").select("agency_id").eq("id", clientIdProp).maybeSingle();
        return data?.agency_id ?? null;
      }
      if (campaignId) {
        const { data } = await supabase.from("campaigns").select("clients(agency_id)").eq("id", campaignId).maybeSingle();
        return (data as any)?.clients?.agency_id ?? null;
      }
      return null;
    },
    enabled: !!clientIdProp || !!campaignId,
  });

  const agencyId = agencyIdQuery.data;

  const listQuery = useQuery({
    queryKey: ["agency_email_memory", agencyId],
    enabled: !!agencyId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_email_memory" as any)
        .select("email, last_used_at, usage_count, contact_name")
        .eq("agency_id", agencyId!)
        .order("last_used_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        email: string;
        last_used_at: string;
        usage_count: number;
        contact_name: string | null;
      }>;
    },
  });

  // Realtime: sincronizar nova memória entre abas/usuários da mesma agência
  useEffect(() => {
    if (!agencyId) return;
    const ch = supabase
      .channel(`agency-email-memory-${agencyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_email_memory",
          filter: `agency_id=eq.${agencyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["agency_email_memory", agencyId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [agencyId, queryClient]);

  const suggestions = useMemo(
    () => (listQuery.data ?? []).map((r) => r.email),
    [listQuery.data]
  );

  const recordMutation = useMutation({
    mutationFn: async (emails: string[]) => {
      if (!clientIdProp && !campaignId) return;
      // We still need a clientId to trigger record_client_emails, 
      // but it will store with agency_id now.
      let targetClientId = clientIdProp;
      if (!targetClientId && campaignId) {
        const { data } = await supabase.from("campaigns").select("client_id").eq("id", campaignId).maybeSingle();
        targetClientId = data?.client_id;
      }
      
      if (!targetClientId) return;

      const cleaned = Array.from(
        new Set(
          (emails || [])
            .map((e) => (e || "").trim().toLowerCase())
            .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
        )
      );
      if (cleaned.length === 0) return;
      const { error } = await supabase.rpc("record_client_emails" as any, {
        _client_id: targetClientId,
        _emails: cleaned,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (agencyId) {
        queryClient.invalidateQueries({ queryKey: ["agency_email_memory", agencyId] });
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (email: string) => {
      if (!agencyId) return;
      const norm = (email || "").trim().toLowerCase();
      const { error } = await supabase
        .from("client_email_memory" as any)
        .delete()
        .eq("agency_id", agencyId)
        .eq("email", norm);
      if (error) throw error;
    },
    onSuccess: () => {
      if (agencyId) {
        queryClient.invalidateQueries({ queryKey: ["agency_email_memory", agencyId] });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ oldEmail, newEmail }: { oldEmail: string; newEmail: string }) => {
      if (!agencyId) return;
      const oldNorm = (oldEmail || "").trim().toLowerCase();
      const newNorm = (newEmail || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newNorm)) {
        throw new Error("E-mail inválido");
      }
      if (oldNorm === newNorm) return;
      const { error } = await supabase
        .from("client_email_memory" as any)
        .update({ email: newNorm })
        .eq("agency_id", agencyId)
        .eq("email", oldNorm);
      if (error) throw error;
    },
    onSuccess: () => {
      if (agencyId) {
        queryClient.invalidateQueries({ queryKey: ["agency_email_memory", agencyId] });
      }
    },
  });

  const updateContactNameMutation = useMutation({
    mutationFn: async ({ email, contactName }: { email: string; contactName: string | null }) => {
      if (!agencyId) return;
      const norm = (email || "").trim().toLowerCase();
      const trimmed = (contactName ?? "").trim();
      const { error } = await supabase
        .from("client_email_memory" as any)
        .update({ contact_name: trimmed === "" ? null : trimmed })
        .eq("agency_id", agencyId)
        .eq("email", norm);
      if (error) throw error;
    },
    onSuccess: () => {
      if (agencyId) {
        queryClient.invalidateQueries({ queryKey: ["agency_email_memory", agencyId] });
      }
    },
  });

  return {
    agencyId,
    suggestions,
    entries: listQuery.data ?? [],
    isLoading: listQuery.isLoading || agencyIdQuery.isLoading,
    record: (emails: string[]) => {
      // fire-and-forget; falhas não devem bloquear envios
      recordMutation.mutate(emails, {
        onError: (e) => console.warn("[email-memory] record failed", e),
      });
    },
    removeEmail: removeMutation.mutateAsync,
    updateEmail: updateMutation.mutateAsync,
    updateContactName: updateContactNameMutation.mutateAsync,
  };
}
