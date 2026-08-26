import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useCampaignFavorites, useToggleFavorite } from "@/hooks/useCampaignFavorites";
import { useClientFavorites, useToggleClientFavorite } from "@/hooks/useClientFavorites";

import { Star, ArrowRight, Users } from "lucide-react";

const FavoritesV2 = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: favorites = [], isLoading } = useCampaignFavorites();
  const toggleFavorite = useToggleFavorite();
  const { data: clientFavorites = [], isLoading: loadingClients } = useClientFavorites();
  const toggleClientFavorite = useToggleClientFavorite();

  if (isLoading || loadingClients) {
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

        {clientFavorites.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-stone-400" />
              <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">Clientes</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientFavorites.map((fav) => (
                <div
                  key={fav.id}
                  className="bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow p-4 cursor-pointer group"
                  onClick={() => navigate(`/agency/${fav.agency_id}/clients/${fav.client_id}`)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-inner bg-stone-500">
                      <span className="text-white font-bold text-lg">
                        {(fav.client_name || "C").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-stone-800 truncate">{fav.client_name}</h3>
                      <p className="text-xs text-stone-400 mt-0.5 truncate">{fav.agency_name}</p>
                      <span className="text-[11px] text-brand-400 font-medium mt-3 flex items-center gap-1 group-hover:gap-2 transition-all">
                        Acessar <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleClientFavorite.mutate({ clientId: fav.client_id });
                      }}
                      disabled={toggleClientFavorite.isPending}
                      className="p-1 rounded hover:bg-stone-100 transition-colors flex-shrink-0"
                      aria-label="Remover dos favoritos"
                      title="Remover dos favoritos"
                    >
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {favorites.length === 0 && clientFavorites.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-stone-200 border-dashed">
            <Star className="w-12 h-12 text-stone-200 mx-auto mb-3" />
            <h3 className="text-stone-800 font-medium">Você ainda não tem favoritos</h3>
            <p className="text-sm text-stone-400 mt-2">Clique na estrela em um cliente ou campanha para favoritar.</p>
          </div>
        ) : favorites.length === 0 ? null : (

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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite.mutate({ campaignId: fav.campaign_id, isFavorited: true });
                      }}
                      disabled={toggleFavorite.isPending}
                      className="p-1 rounded hover:bg-stone-100 transition-colors flex-shrink-0"
                      aria-label="Remover dos favoritos"
                      title="Remover dos favoritos"
                    >
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    </button>
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