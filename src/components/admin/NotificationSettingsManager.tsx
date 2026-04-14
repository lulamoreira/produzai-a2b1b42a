import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { usePermissionCategories } from "@/hooks/usePermissionCategories";
import { Switch } from "@/components/ui/switch";

const EVENTOS = [
  { type: "ocorrencia_aberta", label: "Nova ocorrência aberta" },
  { type: "instalacao_concluida", label: "Instalação concluída" },
  { type: "checkin_realizado", label: "Check-in realizado" },
  { type: "aprovacao_lojista", label: "Aprovação do lojista" },
  { type: "recusa_lojista", label: "Recusa do lojista" },
  { type: "aprovacao_equipe", label: "Aprovação da equipe" },
  { type: "recusa_equipe", label: "Recusa da equipe" },
  { type: "ocorrencia_resolvida", label: "Ocorrência resolvida" },
  { type: "novo_usuario_pendente", label: "Novo usuário aguardando" },
  { type: "orcamento_enviado", label: "Orçamento enviado por fornecedor" },
];

const ROLE_COLUNAS = [
  { scope: "admin", label: "Admin" },
  { scope: "master_global", label: "Master Global" },
  { scope: "master_cliente", label: "Master de Cliente" },
  { scope: "viewer", label: "Viewer" },
];

export default function NotificationSettingsManager() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  // Get the user's agency_id from profile
  const { data: profile } = useQuery({
    queryKey: ["profile_agency", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // If user has no agency_id in profile, try to get from user_agency_access
  const { data: agencyAccess } = useQuery({
    queryKey: ["user_agency_for_notif", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_agency_access")
        .select("agency_id")
        .eq("user_id", user.id)
        .eq("suspended", false)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !profile?.agency_id,
  });

  // Fallback for admins: query the first agency directly
  const { data: fallbackAgency } = useQuery({
    queryKey: ["first_agency_fallback"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agencies")
        .select("id")
        .is("deleted_at", null)
        .order("name")
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: isAdmin && !profile?.agency_id && !agencyAccess?.agency_id,
  });

  const agencyId = profile?.agency_id || agencyAccess?.agency_id || fallbackAgency?.id;
  const { settings, isLoading, updateSetting, updateCategorySetting } = useNotificationSettings(agencyId ?? undefined);
  const { data: categories = [] } = usePermissionCategories();

  // Admin sees all 4 role columns; master sees 3 (no admin column)
  const roleColunas = isAdmin ? ROLE_COLUNAS : ROLE_COLUNAS.filter((c) => c.scope !== "admin");

  if (isLoading || !agencyId) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-base font-semibold mb-1">Notificações</h2>
      <p className="text-xs text-muted-foreground mb-6">
        Configure quem recebe cada tipo de notificação. Alterações têm efeito imediato.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Evento</th>
              {roleColunas.map((col) => (
                <th key={col.scope} className="text-center py-2 px-3 font-medium text-muted-foreground whitespace-nowrap">
                  {col.label}
                </th>
              ))}
              {categories.map((cat) => (
                <th key={cat.id} className="text-center py-2 px-3 font-medium text-muted-foreground whitespace-nowrap">
                  {cat.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EVENTOS.map((evento) => (
              <tr key={evento.type} className="border-b border-border/40 hover:bg-muted/30">
                <td className="py-3 pr-4 font-medium">{evento.label}</td>
                {/* Role-based columns */}
                {roleColunas.map((col) => {
                  const setting = settings.find(
                    (s) => s.event_type === evento.type && s.role_scope === col.scope
                  );
                  return (
                    <td key={col.scope} className="text-center py-3 px-3">
                      <Switch
                        checked={setting?.enabled ?? false}
                        onCheckedChange={(val) => updateSetting(evento.type, col.scope, val)}
                      />
                    </td>
                  );
                })}
                {/* Category-based columns */}
                {categories.map((cat) => {
                  const setting = settings.find(
                    (s) => s.event_type === evento.type && s.category_id === cat.id
                  );
                  return (
                    <td key={cat.id} className="text-center py-3 px-3">
                      <Switch
                        checked={setting?.enabled ?? false}
                        onCheckedChange={(val) => updateCategorySetting(evento.type, cat.id, val)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isAdmin && (
        <p className="text-xs text-muted-foreground mt-4">
          As configurações de Admin são gerenciadas pelo administrador da agência.
        </p>
      )}
    </div>
  );
}
