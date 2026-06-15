import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useCampaignFavorites, useToggleFavorite } from "@/hooks/useCampaignFavorites";

import { Star, ArrowRight } from "lucide-react";

const FavoritesV2 = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: favorites = [], isLoading } = useCampaignFavorites();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
          <h1 className="text-2xl font-bold text-stone-800 tracking-tight">Favoritos</h1>
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-stone-200 border-dashed">
            <Star className="w-12 h-12 text-stone-200 mx-auto mb-3" />
            <h3 className="text-stone-800 font-medium">Você ainda não tem favoritos</h3>
            <p className="text-sm text-stone-400 mt-2">Acesse uma campanha e clique na estrela para favoritar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((fav) => {
              const color = fav.campaign_color || "#A88B6A";
              const initial = (fav.campaign_name || "C").charAt(0).toUpperCase();
              return (
                <div
                  key={fav.id}
                  className="bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow p-4 cursor-pointer group"
                  onClick={() => navigate(`/agency/${fav.agency_id}/clients/${fav.client_id}/campaigns/${fav.campaign_id}`)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-inner"
                      style={{ backgroundColor: color }}
                    >
                      <span className="text-white font-bold text-lg">{initial}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-stone-800 truncate">{fav.campaign_name}</h3>
                      <p className="text-xs text-stone-400 mt-0.5 truncate">
                        {fav.client_name} · {fav.agency_name}
                      </p>
                      <span className="text-[11px] text-brand-400 font-medium mt-3 flex items-center gap-1 group-hover:gap-2 transition-all">
                        Acessar <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    
  );
};

export default FavoritesV2;