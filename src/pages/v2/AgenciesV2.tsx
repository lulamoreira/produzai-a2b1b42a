import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAgencies } from "@/hooks/useAgencies";
import { useUserAgencyAccess } from "@/hooks/useUserAgencyAccess";
import { useCampaignFavorites } from "@/hooks/useCampaignFavorites";
import { useFormatters } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star, Plus, ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const AgenciesV2 = ({ onAddClick, onEditClick }: { onAddClick: () => void, onEditClick: (agency: any) => void }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { data: favorites = [] } = useCampaignFavorites();
  const { data: allAgencies = [], isLoading } = useAgencies();
  const { data: agencyAccess = [] } = useUserAgencyAccess();
  const { dateShort } = useFormatters();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-10">
      {/* Favoritos */}
      {favorites.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <h2 className="text-xl font-semibold text-stone-800 tracking-tight">Favoritos</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
        </section>
      )}

      {/* Agências */}
      <section>
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-stone-800">Agências</h2>
          <p className="text-sm text-stone-400 mt-1">Selecione uma agência para gerenciar seus clientes e campanhas.</p>
          {isAdmin && (
            <div className="mt-6">
              <Button 
                onClick={onAddClick}
                className="bg-brand-400 hover:bg-brand-500 text-white rounded-lg px-4 py-2 text-sm font-medium h-auto"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Nova Agência
              </Button>
            </div>
          )}
        </div>

        {agencies.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-stone-200 border-dashed">
            <Building2 className="w-12 h-12 text-stone-200 mx-auto mb-3" />
            <h3 className="text-stone-800 font-medium">Nenhuma agência encontrada</h3>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-6">
            {agencies.map((agency) => (
              <div
                key={agency.id}
                className="bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-all p-5 cursor-pointer w-full max-w-[280px] group"
                onClick={() => navigate(`/agency/${agency.id}/clients`)}
              >
                <div className="flex flex-col items-center text-center">
                  {agency.logo_url ? (
                    <img src={agency.logo_url} alt={agency.name} className="w-14 h-14 rounded-xl object-cover shadow-sm border border-stone-100" />
                  ) : (
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-sm"
                      style={{ backgroundColor: agency.color || "#A88B6A" }}
                    >
                      {agency.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <h3 className="text-base font-semibold text-stone-800 mt-3 truncate w-full">{agency.name}</h3>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Criada em {dateShort(agency.created_at)}
                  </p>
                  
                  <div className="w-full flex items-center justify-between mt-4">
                    <span className="text-sm text-brand-400 font-medium flex items-center gap-1 group-hover:gap-1.5 transition-all">
                      Acessar <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[11px] text-stone-400 hover:text-stone-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditClick(agency);
                        }}
                      >
                        Editar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AgenciesV2;