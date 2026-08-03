import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BatchAccessParams {
  userIds: string[];
  resourceIds: string[];
  resourceType: "agency" | "client" | "campaign";
  categoryId: string;
}

export function useBatchUserAccess() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ userIds, resourceIds, resourceType, categoryId }: BatchAccessParams) => {
      const { data, error } = await supabase.rpc("process_batch_user_access", {
        p_user_ids: userIds,
        p_resource_ids: resourceIds,
        p_resource_type: resourceType,
        p_category_id: categoryId
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success("Autorizações em lote processadas com sucesso!");
      
      // Invalidate relevant queries
      if (vars.resourceType === "agency") {
        qc.invalidateQueries({ queryKey: ["user_agency_access"] });
      } else if (vars.resourceType === "client") {
        qc.invalidateQueries({ queryKey: ["user_client_access"] });
      } else if (vars.resourceType === "campaign") {
        qc.invalidateQueries({ queryKey: ["user_campaign_access"] });
      }
      
      qc.invalidateQueries({ queryKey: ["admin_users_list"] });
    },
    onError: (e: any) => {
      toast.error(`Erro ao processar lote: ${e.message}`);
    },
  });
}
