import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { normCpf, normRg } from "@/lib/normalizeDoc";

export interface BlockedInstaller {
  id: string;
  doc_type: "cpf" | "rg";
  doc_norm: string;
  name: string | null;
  reason: string | null;
}

export function useBlockedInstallers(clientId?: string) {
  return useQuery({
    queryKey: ["blocked_installers", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_installers" as any)
        .select("id, doc_type, doc_norm, name, reason, client_id");
      
      if (error) throw error;

      const filteredData = (data as any[]).filter(item => {
        if (!clientId) {
          // If no clientId provided (global admin), show only global blocks
          return !item.client_id;
        }
        // If clientId provided, show global blocks AND blocks for this specific client
        return !item.client_id || item.client_id === clientId;
      });

      const cpfs = new Set<string>();
      const rgs = new Set<string>();

      filteredData.forEach((item) => {
        if (item.doc_type === "cpf") cpfs.add(item.doc_norm);
        if (item.doc_type === "rg") rgs.add(item.doc_norm);
      });

      return { cpfs, rgs, raw: filteredData };
    },
    // We want this to be available quickly
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
