import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useCampaignFavorites, useToggleFavorite } from "@/hooks/useCampaignFavorites";
import { useAgencies } from "@/hooks/useAgencies";
import { useUserAgencyAccess } from "@/hooks/useUserAgencyAccess";
import { useUserDirectAccess } from "@/hooks/useUserDirectAccess";
import AppLayout from "@/components/AppLayout";
import { Star, ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const Favorites = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { data: favorites, isLoading } = useCampaignFavorites();
  const toggleFavorite = useToggleFavorite();
  const { isLimited, campaigns: directCampaigns, isLoading: directLoading } = useUserDirectAccess();

  // Agency data — same hooks as AgencySelect
  const { data: allAgencies = [], isLoading: loadingAgencies } = useAgencies();
  const { data: agencyAccess = [] } = useUserAgencyAccess();

  const { data: clientAccess = [] } = useQuery({
    queryKey: ["user_client_access_agencies", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_client_access")
        .select("client_id, suspended, clients(agency_id)")
        .eq("user_id", user.id);
      if (error) throw error;
      return data as { client_id: string; suspended: boolean; clients: { agency_id: string } | null }[];
    },
    enabled: !!user && !isAdmin,
  });

  const agencies = isAdmin
    ? allAgencies
    : allAgencies.filter((ag) => {
        const hasAgencyAccess = agencyAccess.some((a) => a.agency_id === ag.id && !a.suspended);
        const hasClientInAgency = clientAccess.some(
          (ca) => ca.clients?.agency_id === ag.id && !ca.suspended
        );
        return hasAgencyAccess || hasClientInAgency;
      });

  // Group direct-access campaigns by client (for restricted users)
  const byClient = directCampaigns.reduce((acc, c) => {
    if (!acc[c.clientId]) acc[c.clientId] = { clientName: c.clientName, agencyId: c.agencyId, campaigns: [] };
    acc[c.clientId].campaigns.push(c);
    return acc;
  }, {} as Record<string, { clientName: string; agencyId: string; campaigns: typeof directCampaigns }>);
  const clientGroups = Object.entries(byClient).sort((a, b) =>
    a[1].clientName.localeCompare(b[1].clientName, "pt-BR")
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        {/* Favorites section */}
        <div className="flex items-center gap-3 mb-6">
          <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {t("sidebar.favorites", "Favoritos")}
          </h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !favorites || favorites.length === 0 ? (
          <div className="text-center py-12">
            <Star className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {t("favorites.empty", "Nenhuma campanha favoritada ainda.")}
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              {t("favorites.emptyHint", "Use a estrela nos cards de campanha para adicionar favoritos.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((fav) => {
              const color = fav.campaign_color || "#6366f1";
              const initial = (fav.campaign_name || "C").charAt(0).toUpperCase();

              return (
                <div
                  key={fav.id}
                  className="group card-base cursor-pointer hover:shadow-md transition-shadow duration-150 relative"
                  onClick={() =>
                    navigate(
                      `/agency/${fav.agency_id}/clients/${fav.client_id}/campaigns/${fav.campaign_id}`
                    )
                  }
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[var(--radius-card)]"
                    style={{ backgroundColor: color }}
                  />

                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      <span className="text-white font-semibold text-base">{initial}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-semibold text-base truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {fav.campaign_name}
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {fav.client_name} · {fav.agency_name}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite.mutate({ campaignId: fav.campaign_id, isFavorited: true });
                      }}
                    >
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-end mt-3">
                    <span className="text-[13px] font-medium text-primary flex items-center gap-1">
                      {t("clientDashboard.access", "Acessar")}{" "}
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Divider + secondary section: Acesso Direto (restricted) OR Todas as Agências (others) */}
        <div className="mt-10 pt-8 border-t" style={{ borderColor: "var(--border)" }}>
          {directLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {isLimited
                    ? t("favorites.directAccess", "Acesso Direto")
                    : t("favorites.allAgencies", "Todas as Agências")}
                </h2>
              </div>

          {isLimited ? (
            // Restricted user: campaigns grouped by client
            directCampaigns.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">
                  {t("favorites.noDirectCampaigns", "Nenhuma campanha disponível.")}
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {clientGroups.map(([clientId, group]) => (
                  <div key={clientId}>
                    <h3
                      className="font-bold text-foreground text-base mb-3"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {group.clientName}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.campaigns.map((c) => {
                        const initial = (c.campaignName || "C").charAt(0).toUpperCase();
                        const color = "#6366f1";
                        return (
                          <div
                            key={c.campaignId}
                            className="group card-base cursor-pointer hover:shadow-md transition-shadow duration-150 relative"
                            onClick={() =>
                              navigate(
                                `/agency/${c.agencyId}/clients/${c.clientId}/campaigns/${c.campaignId}`
                              )
                            }
                          >
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[var(--radius-card)]"
                              style={{ backgroundColor: color }}
                            />
                            <div className="flex items-start gap-3">
                              <div
                                className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: color }}
                              >
                                <span className="text-white font-semibold text-base">{initial}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4
                                  className="font-semibold text-base truncate"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {c.campaignName}
                                </h4>
                                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                                  {c.clientName}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-end mt-3">
                              <span className="text-[13px] font-medium text-primary flex items-center gap-1">
                                {t("clientDashboard.access", "Acessar")}{" "}
                                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : loadingAgencies ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
            </div>
          ) : agencies.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">
                {t("agencySelect.noAgencies", "Nenhuma agência disponível.")}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {agencies.map((agency) => {
                const agencyColor = agency.color || "#6366f1";
                return (
                  <div
                    key={agency.id}
                    className="group aqua-card p-6 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border border-border flex flex-col items-center text-center w-[260px]"
                    style={{
                      background: `linear-gradient(135deg, ${agencyColor}15, ${agencyColor}08)`,
                      borderColor: `${agencyColor}30`,
                    }}
                    onClick={() => navigate(`/agency/${agency.id}`)}
                  >
                    <div
                      className="w-16 h-16 aqua-icon flex items-center justify-center shadow-lg overflow-hidden mb-3"
                      style={{ background: `linear-gradient(145deg, ${agencyColor}, ${agencyColor}cc)` }}
                    >
                      {agency.logo_url ? (
                        <img src={agency.logo_url} alt={agency.name} className="w-full h-full object-cover relative z-10" />
                      ) : (
                        <Building2 className="w-7 h-7 text-white relative z-10 drop-shadow-sm" />
                      )}
                    </div>
                    <h3 className="font-bold text-foreground text-base mb-0.5">{agency.name}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {t("agencySelect.createdAt", "Criado em")} {new Date(agency.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3 group-hover:text-primary transition-colors">
                      <span>{t("clientDashboard.access", "Acessar")}</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Favorites;
