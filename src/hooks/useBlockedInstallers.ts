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

export function useBlockedInstallers() {
  return useQuery({
    queryKey: ["blocked_installers"],
    queryFn: async () => {
      // Use standard pagination as requested
      const data = await supabasePaginate<BlockedInstaller>((from, to) =>
        supabase
          .from("blocked_installers" as any)
          .select("id, doc_type, doc_norm, name, reason", { count: "exact" })
          .order("id")
          .range(from, to) as any
      );

      const cpfs = new Set<string>();
      const rgs = new Set<string>();

      data.forEach((item) => {
        if (item.doc_type === "cpf") cpfs.add(item.doc_norm);
        if (item.doc_type === "rg") rgs.add(item.doc_norm);
      });

      return { cpfs, rgs, raw: data };
    },
    // We want this to be available quickly
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
