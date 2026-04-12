import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type UserApprovalInfo = {
  user_id: string;
  display_name: string | null;
  approval_status: ApprovalStatus;
  created_at: string;
  agency_id: string | null;
  client_id: string | null;
};

export function useUserApprovalStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["approval_status", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("approval_status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.approval_status as ApprovalStatus) ?? "pending";
    },
    enabled: !!user,
  });
}

export function usePendingUsersCount() {
  return useQuery({
    queryKey: ["pending_users_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("approval_status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useAllUsersApproval() {
  return useQuery({
    queryKey: ["all_users_approval"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, approval_status, created_at, agency_id, client_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as UserApprovalInfo[];
    },
  });
}

export function useUpdateApprovalStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: ApprovalStatus }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ approval_status: status })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all_users_approval"] });
      qc.invalidateQueries({ queryKey: ["pending_users_count"] });
      toast.success("Status atualizado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
}
