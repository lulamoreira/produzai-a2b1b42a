import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCampaignFavorites, useToggleFavorite } from "@/hooks/useCampaignFavorites";
import AppLayout from "@/components/AppLayout";
import { Star, ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const Favorites = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: favorites, isLoading } = useCampaignFavorites();
  const toggleFavorite = useToggleFavorite();

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
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
          <div className="text-center py-20">
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

        {/* Link to all agencies */}
        <div className="mt-8 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate("/agencies")}
          >
            <Building2 className="w-4 h-4" />
            {t("favorites.viewAllAgencies", "Ver todas as agências")}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Favorites;
