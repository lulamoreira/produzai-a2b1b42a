import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface NotificationSetting {
  id: string;
  agency_id: string;
  event_type: string;
  role_scope: string;
  enabled: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

export function useNotificationSettings(agencyId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["notification_settings", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("agency_id", agencyId)
        .order("event_type")
        .order("role_scope");
      if (error) throw error;
      return (data ?? []) as unknown as NotificationSetting[];
    },
    enabled: !!agencyId,
  });

  const updateSetting = async (eventType: string, roleScope: string, enabled: boolean) => {
    if (!agencyId || !user) return;

    const existing = settings.find(
      (s) => s.event_type === eventType && s.role_scope === roleScope
    );

    if (existing) {
      const { error } = await supabase
        .from("notification_settings")
        .update({ enabled, updated_at: new Date().toISOString(), updated_by: user.id } as any)
        .eq("id", existing.id);
      if (error) {
        toast.error("Erro ao salvar configuração");
        return;
      }
    } else {
      const { error } = await supabase
        .from("notification_settings")
        .insert({
          agency_id: agencyId,
          event_type: eventType,
          role_scope: roleScope,
          enabled,
          updated_by: user.id,
        } as any);
      if (error) {
        toast.error("Erro ao salvar configuração");
        return;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["notification_settings", agencyId] });
    toast.success("Configuração salva");
  };

  return { settings, isLoading, updateSetting };
}
