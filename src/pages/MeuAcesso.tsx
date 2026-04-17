import { useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUserDirectAccess, type CampaignAccess } from "@/hooks/useUserDirectAccess";
import { useCampaignFavorites, useToggleFavorite } from "@/hooks/useCampaignFavorites";
import AppLayout from "@/components/AppLayout";
import { Star, ArrowRight, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const MeuAcesso = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLimited, campaigns: directCampaigns, isLoading: directLoading } = useUserDirectAccess();
  const { data: favorites, isLoading: favLoading } = useCampaignFavorites();
  const toggleFavorite = useToggleFavorite();

  if (directLoading || favLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Admin/master shouldn't be here
  if (!isLimited) {
    return <Navigate to="/agencies" replace />;
  }

  // Group campaigns by client
  const byClient = directCampaigns.reduce((acc, c) => {
    if (!acc[c.clientId]) acc[c.clientId] = { clientName: c.clientName, agencyId: c.agencyId, campaigns: [] };
    acc[c.clientId].campaigns.push(c);
    return acc;
  }, {} as Record<string, { clientName: string; agencyId: string; campaigns: CampaignAccess[] }>);
  const clientGroups = Object.entries(byClient).sort((a, b) =>
    a[1].clientName.localeCompare(b[1].clientName, "pt-BR")
  );

  const hasFavorites = favorites && favorites.length > 0;
  const hasCampaigns = directCampaigns.length > 0;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Briefcase className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {t("meuAcesso.title", "Meu Acesso")}
          </h1>
        </div>

        {/* Empty state */}
        {!hasFavorites && !hasCampaigns && (
          <div className="text-center py-20">
            <Briefcase className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {t("meuAcesso.empty", "Nenhum acesso configurado. Entre em contato com o administrador.")}
            </p>
          </div>
        )}

        {/* Favorites section */}
        {hasFavorites && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                {t("sidebar.favorites", "Favoritos")}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites!.map((fav) => {
                const color = fav.campaign_color || "#6366f1";
                const initial = (fav.campaign_name || "C").charAt(0).toUpperCase();
                return (
                  <div
                    key={fav.id}
                    className="group card-base cursor-pointer hover:shadow-md transition-shadow duration-150 relative"
                    onClick={() =>
                      navigate(`/agency/${fav.agency_id}/clients/${fav.client_id}/campaigns/${fav.campaign_id}`)
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
                        <h3 className="font-semibold text-base truncate" style={{ color: "var(--text-primary)" }}>
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
          </>
        )}

        {/* Divider between favorites and campaigns */}
        {hasFavorites && hasCampaigns && (
          <div className="mt-10 pt-8 border-t" style={{ borderColor: "var(--border)" }} />
        )}

        {/* Minhas Campanhas section */}
        {hasCampaigns && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <Briefcase className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                {t("meuAcesso.myCampaigns", "Minhas Campanhas")}
              </h2>
            </div>

            <div className="space-y-8">
              {clientGroups.map(([clientId, group]) => (
                <div key={clientId}>
                  <h3 className="font-bold text-base mb-3" style={{ color: "var(--text-primary)" }}>
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
                            navigate(`/agency/${c.agencyId}/clients/${c.clientId}/campaigns/${c.campaignId}`)
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
                              <h4 className="font-semibold text-base truncate" style={{ color: "var(--text-primary)" }}>
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
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default MeuAcesso;
