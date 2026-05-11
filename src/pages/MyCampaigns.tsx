import { useTranslation } from "react-i18next";
import { useUserDirectAccess } from "@/hooks/useUserDirectAccess";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Store, Grid3X3, LayoutList, AlertTriangle, CalendarDays, LogOut, Package, Camera, Building2, Star, ArrowRight, Palette, GitMerge, DollarSign } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import ModuleGrid from "@/components/ModuleGrid";
import { useCampaignFavorites, useToggleFavorite } from "@/hooks/useCampaignFavorites";

const MyCampaigns = () => {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { campaigns, isLimited, isLoading } = useUserDirectAccess();
  const { data: favorites } = useCampaignFavorites();
  const toggleFavorite = useToggleFavorite();
  const hasFavorites = favorites && favorites.length > 0;

  const MODULE_META: Record<string, { label: string; icon: React.ElementType }> = {
    stores: { label: t("modules.stores"), icon: Store },
    matrix: { label: t("modules.matrix"), icon: Grid3X3 },
    pieces: { label: t("modules.pieces"), icon: LayoutList },
    occurrences: { label: t("modules.occurrences"), icon: AlertTriangle },
    scheduling: { label: t("modules.scheduling"), icon: CalendarDays },
    installations: { label: t("modules.installations"), icon: Camera },
    loja_a_loja: { label: "Loja a Loja", icon: Building2 },
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isLimited) {
    return <Navigate to="/agencies" replace />;
  }

  if (campaigns.length === 1 && campaigns[0].modules.length === 1) {
    const c = campaigns[0];
    return (
      <Navigate
        to={`/agency/${c.agencyId}/clients/${c.clientId}/campaigns/${c.campaignId}`}
        state={{ initialSection: c.modules[0], limitedMode: true }}
        replace
      />
    );
  }

  const handleNavigate = (campaign: typeof campaigns[0], module: string) => {
    navigate(
      `/agency/${campaign.agencyId}/clients/${campaign.clientId}/campaigns/${campaign.campaignId}`,
      { state: { initialSection: module, limitedMode: true } }
    );
  };

  return (
    <AppLayout title={t("myCampaigns.title")}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-2">{t("myCampaigns.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("myCampaigns.selectModule")}</p>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">{t("myCampaigns.noAccess")}</p>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" /> {t("auth.logout")}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {hasFavorites && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <h3 className="text-lg font-bold text-foreground">
                    {t("sidebar.favorites", "Favoritos")}
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {favorites!.map((fav) => {
                    const color = fav.campaign_color || "#6366f1";
                    const initial = (fav.campaign_name || "C").charAt(0).toUpperCase();
                    return (
                      <div
                        key={fav.id}
                        className="group aqua-card border border-border bg-card p-4 cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden"
                        onClick={() =>
                          navigate(
                            `/agency/${fav.agency_id}/clients/${fav.client_id}/campaigns/${fav.campaign_id}`,
                            { state: { limitedMode: true } }
                          )
                        }
                      >
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1"
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
                            <h4 className="font-semibold text-base truncate text-foreground">
                              {fav.campaign_name}
                            </h4>
                            <p className="text-xs mt-0.5 text-muted-foreground truncate">
                              {fav.client_name}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite.mutate({
                                campaignId: fav.campaign_id,
                                isFavorited: true,
                              });
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
                <div className="border-t border-border pt-2" />
              </div>
            )}

            {campaigns.map((c) => (
              <div
                key={`${c.campaignId}-${c.modules.join(",")}`}
                className="aqua-card border border-border p-6 bg-card hover:shadow-md transition-shadow"
              >
                <div className="mb-5">
                  <h3 className="font-bold text-foreground text-lg">{c.campaignName}</h3>
                  <p className="text-xs text-muted-foreground">{c.clientName}</p>
                </div>
                <ModuleGrid
                  items={c.modules.map((mod) => {
                    const meta = MODULE_META[mod];
                    return meta ? { key: mod, label: meta.label, icon: meta.icon } : null;
                  }).filter(Boolean) as any}
                  onSelect={(mod) => handleNavigate(c, mod)}
                />
              </div>
            ))}

            <div className="text-center pt-6">
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" /> {t("auth.logout")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MyCampaigns;
