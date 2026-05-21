import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Store as StoreIcon, ChevronRight, Clock, MapPin, Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isAfter } from "date-fns";
import { useTranslation } from "react-i18next";
import { OccurrencesPortalEmptyState } from "@/components/v2/campaigns/OccurrencesPortalEmptyState";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface StoreToken {
  token: string | null;
  client_stores: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    store_code: string | null;
  } | null;
}

export default function OccurrencesPortalV2() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPublic = !user;
  const [selectedState, setSelectedState] = useState<string>("all");

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ["occ-portal-config", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_portal_config")
        .select("occurrences_portal_title, occurrences_portal_subtitle, module_ocorrencias, deadline_ocorrencias")
        .eq("campaign_id", campaignId!)
        .maybeSingle();
      if (error) {
        console.error("Supabase Error [occ-portal-config-v2]:", error);
        throw error;
      }
      return data;
    },
  });

  const { data: storesData, isLoading: loadingStores } = useQuery({
    queryKey: ["occ-portal-stores-v2-logic", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      // 1. Fetch all active stores in the campaign
      const { data: lojas, error: lojasErr } = await supabase
        .from("loja_a_loja_lojas")
        .select("store_id, client_stores(id, name, city, state, store_code)")
        .eq("campaign_id", campaignId!)
        .eq("ativo", true);
      
      if (lojasErr) {
        console.error("Supabase Error [occ-portal-lojas-v2]:", lojasErr);
        throw lojasErr;
      }

      // 2. Fetch existing tokens
      const { data: existingTokens, error: tokensErr } = await supabase
        .from("store_portal_tokens")
        .select("token, store_id")
        .eq("campaign_id", campaignId!);
      
      if (tokensErr) {
        console.error("Supabase Error [occ-portal-tokens-v2]:", tokensErr);
        throw tokensErr;
      }

      const tokenMap = new Map(existingTokens?.map(t => [t.store_id, t.token]) || []);

      // Dedup stores
      const uniqueStoresMap = new Map<string, any>();
      (lojas || []).forEach((l: any) => {
        if (l.client_stores && !uniqueStoresMap.has(l.store_id)) {
          uniqueStoresMap.set(l.store_id, l.client_stores);
        }
      });

      const uniqueStores = Array.from(uniqueStoresMap.values());
      const tokensList = uniqueStores
        .map(store => ({
          token: tokenMap.get(store.id) || null,
          client_stores: store
        }))
        .filter(t => t.token !== null) as StoreToken[];

      return {
        allStores: uniqueStores,
        tokens: tokensList,
        hasStores: uniqueStores.length > 0,
        hasTokens: tokensList.length > 0
      };
    },
  });

  const isLoading = loadingConfig || loadingStores;
  const title = config?.occurrences_portal_title || t("occurrences.portal.title");
  const subtitle = config?.occurrences_portal_subtitle || t("occurrences.portal.subtitle");
  
  const isModuleDisabled = config && config.module_ocorrencias === false;
  const deadline = config?.deadline_ocorrencias ? new Date(config.deadline_ocorrencias) : null;
  const isDeadlinePassed = deadline && isAfter(new Date(), deadline);

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-stone-100 text-stone-600",
      "bg-orange-100 text-orange-600",
      "bg-amber-100 text-amber-600",
      "bg-blue-100 text-blue-600",
      "bg-green-100 text-green-600"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const handleGoToStores = () => {
    if (isPublic) return;
    const pathParts = window.location.pathname.split("/");
    const agencyId = pathParts[2];
    const clientId = pathParts[4];
    navigate(`/agency/${agencyId}/clients/${clientId}/campaigns/${campaignId}?section=loja_a_loja&tab=lojas`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-6 w-96 mb-10" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Smart Empty States Logic
  if (!storesData?.hasStores) {
    return (
      <div className="min-h-screen bg-stone-50 py-12 px-4">
        <OccurrencesPortalEmptyState type="no-stores" onGoToStores={!isPublic ? handleGoToStores : undefined} isV2 />
      </div>
    );
  }

  if (isModuleDisabled || !storesData?.hasTokens) {
    return (
      <div className="min-h-screen bg-stone-50 py-12 px-4">
        <OccurrencesPortalEmptyState type="no-access" onGoToStores={!isPublic ? handleGoToStores : undefined} isV2 />
      </div>
    );
  }

  if (isDeadlinePassed) {
    return (
      <div className="min-h-screen bg-stone-50 py-12 px-4">
        <div className="max-w-6xl mx-auto">
           <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
              <p className="text-sm text-stone-500 mt-1">{subtitle}</p>
            </div>
            {deadline && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200">
                <Clock className="h-3.5 w-3.5" />
                {t("occurrences.portal.deadlineExpired")}: {deadline.toLocaleDateString()}
              </div>
            )}
          </header>
          <OccurrencesPortalEmptyState type="deadline-passed" isV2 />
        </div>
      </div>
    );
  }

  const availableStates = useMemo(() => {
    const states = new Set<string>();
    storesData?.tokens?.forEach(s => {
      if (s.client_stores?.state) states.add(s.client_stores.state);
    });
    return Array.from(states).sort();
  }, [storesData?.tokens]);

  const filteredTokens = useMemo(() => {
    if (!storesData?.tokens) return [];
    if (selectedState === "all") return storesData.tokens;
    return storesData.tokens.filter(s => s.client_stores?.state === selectedState);
  }, [storesData?.tokens, selectedState]);

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
            <p className="text-sm text-stone-500 mt-1">{subtitle}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {availableStates.length > 1 && (
              <div className="w-full sm:w-48">
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger className="bg-white border-stone-200">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-stone-400" />
                      <SelectValue placeholder="Filtrar por UF" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span>Todos os Estados</span>
                      </div>
                    </SelectItem>
                    {availableStates.map(state => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {deadline && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 text-xs font-medium border border-stone-200">
                <Clock className="h-3.5 w-3.5" />
                {t("occurrences.portal.deadline")}: {deadline.toLocaleDateString()}
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTokens.map((s) => (
            <a
              key={s.token}
              href={`/loja/${s.token}`}
              className="group bg-white rounded-xl border border-stone-100 p-5 shadow-sm hover:shadow-md hover:border-stone-200 transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className={cn("h-12 w-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0", getAvatarColor(s.client_stores?.name || ""))}>
                  {getInitials(s.client_stores?.name || "")}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-stone-900 truncate">
                      {s.client_stores?.name}
                    </span>
                    {s.client_stores?.state && (
                      <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 text-[10px] font-bold uppercase">
                        {s.client_stores.state}
                      </span>
                    )}
                  </div>
                  <div className="text-stone-400 text-sm truncate">
                    {s.client_stores?.store_code || s.client_stores?.city || "—"}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#C2714F] group-hover:translate-x-1 transition-transform shrink-0" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
