import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AgencySupplier } from "@/hooks/useAgencySuppliers";

export interface SupplierCampaignInvite {
  campaign_id: string;
  campaign_name: string;
  client_id: string;
  client_name: string;
  is_winner: boolean;
  status: string;
  invited_at: string | null;
}

export function useSupplierCampaignInvites(supplier: AgencySupplier | null) {
  return useQuery({
    queryKey: ["supplier_campaign_invites", supplier?.id],
    enabled: !!supplier,
    queryFn: async (): Promise<SupplierCampaignInvite[]> => {
      if (!supplier) return [];

      // Coleta todos os e-mails do fornecedor (principal + contatos)
      const emails = new Set<string>();
      if (supplier.email) emails.add(supplier.email.trim().toLowerCase());
      (supplier.contacts || []).forEach((c) => {
        if (c.email) emails.add(c.email.trim().toLowerCase());
      });

      // Busca todos os budget_suppliers com campanha e cliente aninhados
      const { data, error } = await supabase
        .from("budget_suppliers")
        .select(`
          campaign_id,
          is_winner,
          status,
          invited_at,
          email,
          company_name,
          campaigns!inner(
            id,
            name,
            client_id,
            clients!inner(
              id,
              name,
              agency_id
            )
          )
        `);

      if (error) throw error;
      if (!data) return [];

      const normalize = (s: string) =>
        s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const supplierNameNorm = normalize(supplier.company_name);

      return (data as any[])
        .filter((row) => {
          // Filtro 1: deve ser da mesma agência
          const clientAgencyId = row.campaigns?.clients?.agency_id;
          if (clientAgencyId !== supplier.agency_id) return false;

          // Filtro 2: match por e-mail (primário)
          if (emails.size > 0 && row.email) {
            if (emails.has(row.email.trim().toLowerCase())) return true;
          }

          // Filtro 3: fallback por nome da empresa
          if (row.company_name && normalize(row.company_name) === supplierNameNorm) return true;

          return false;
        })
        .map((row) => ({
          campaign_id: row.campaign_id,
          campaign_name: row.campaigns?.name ?? "",
          client_id: row.campaigns?.client_id ?? "",
          client_name: row.campaigns?.clients?.name ?? "",
          is_winner: row.is_winner ?? false,
          status: row.status ?? "aguardando",
          invited_at: row.invited_at,
        }))
        .sort((a, b) => {
          if (!a.invited_at) return 1;
          if (!b.invited_at) return -1;
          return b.invited_at.localeCompare(a.invited_at);
        });
    },
  });
}
