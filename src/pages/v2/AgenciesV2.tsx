import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAgencies } from "@/hooks/useAgencies";
import { useUserAgencyAccess } from "@/hooks/useUserAgencyAccess";
import { useFormatters } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";


const AgenciesV2 = ({ onAddClick, onEditClick }: { onAddClick?: () => void, onEditClick?: (agency: any) => void }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { isAdmin, isAdminOrMaster } = useUserRole();
  const navigate = useNavigate();
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

  const content = (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-800 tracking-tight">Agências</h1>
        {isAdminOrMaster && onAddClick && (
          <Button 
            onClick={onAddClick}
            className="bg-brand-400 hover:bg-brand-500 text-white rounded-lg px-4 py-2 text-sm font-medium h-auto"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nova Agência
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full" />
        </div>
      ) : agencies.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-stone-200 border-dashed">
          <Building2 className="w-12 h-12 text-stone-200 mx-auto mb-3" />
          <h3 className="text-stone-800 font-medium">Nenhuma agência cadastrada ainda</h3>
          {isAdminOrMaster && onAddClick && (
            <Button variant="outline" className="mt-4" onClick={onAddClick}>
              Criar primeira agência
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {agencies.map((agency) => (
            <div
              key={agency.id}
              className="bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-all p-5 cursor-pointer group flex flex-col items-center text-center"
              onClick={() => navigate(`/agency/${agency.id}/clients`)}
            >
              {agency.logo_url ? (
                <img src={agency.logo_url} alt={agency.name} className="w-16 h-16 rounded-xl object-cover shadow-sm border border-stone-100" />
              ) : (
                <div 
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-sm"
                  style={{ backgroundColor: agency.color || "#A88B6A" }}
                >
                  {agency.name.charAt(0).toUpperCase()}
                </div>
              )}
              <h3 className="text-base font-semibold text-stone-800 mt-4 truncate w-full">{agency.name}</h3>
              <p className="text-[11px] text-stone-400 mt-1">
                Criada em {dateShort(agency.created_at)}
              </p>
              
              <div className="w-full flex items-center justify-between mt-6 pt-4 border-t border-stone-50">
                <span className="text-sm text-brand-400 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                  Acessar <ArrowRight className="w-3.5 h-3.5" />
                </span>
                {isAdminOrMaster && onEditClick && (
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
          ))}
        </div>
      )}
    </div>
  );


  return content;
};

export default AgenciesV2;