import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Store as StoreIcon, AlertTriangle, Clock, Globe, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isAfter } from "date-fns";
import { OccurrencesPortalEmptyState } from "@/components/v2/campaigns/OccurrencesPortalEmptyState";
import { useTranslation } from "react-i18next";
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

export default function OccurrencesPortal() {
  const { campaignId: routeCampaignId, token: routeToken } = useParams<{ campaignId?: string; token?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [selectedState, setSelectedState] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const isTokenMode = !!routeToken;

  // Token mode: single RPC returns everything (works anonymously)
  const { data: tokenData, isLoading: loadingToken, isError: tokenError } = useQuery({
    queryKey: ["occ-portal-by-token", routeToken],
    enabled: isTokenMode,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_portal_directory_by_token", { p_token: routeToken! });
      if (error) {
        console.error("Supabase Error [get_portal_directory_by_token]:", error);
        throw error;
      }
      return data as any;
    },
  });

  const resolvedCampaignId = isTokenMode ? tokenData?.campaign?.id : routeCampaignId;

  const { data: legacyConfig, isLoading: loadingLegacyConfig } = useQuery({
    queryKey: ["occ-portal-config", routeCampaignId],
    enabled: !isTokenMode && !!routeCampaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_portal_config")
        .select("occurrences_portal_title, occurrences_portal_subtitle, module_ocorrencias, deadline_ocorrencias")
        .eq("campaign_id", routeCampaignId!)
        .maybeSingle();
      if (error) {
        console.error("Supabase Error [occ-portal-config]:", error);
        throw error;
      }
      return data;
    },
  });

  const { data: legacyTokensData, isLoading: loadingLegacyTokens } = useQuery({
    queryKey: ["occ-portal-stores-v1-logic", routeCampaignId],
    enabled: !isTokenMode && !!routeCampaignId,
    queryFn: async () => {
      const { data: lojas, error: lojasErr } = await supabase
        .from("loja_a_loja_lojas")
        .select("store_id, client_stores(id, name, city, state, store_code)")
        .eq("campaign_id", routeCampaignId!)
        .eq("ativo", true);
      if (lojasErr) {
        console.error("Supabase Error [occ-portal-lojas]:", lojasErr);
        throw lojasErr;
      }
      const { data: existingTokens, error: tokensErr } = await supabase
        .rpc("get_campaign_store_links", { _campaign_id: routeCampaignId! });
      if (tokensErr) {
        console.error("Supabase Error [occ-portal-tokens]:", tokensErr);
        throw tokensErr;
      }
      const tokenMap = new Map((existingTokens ?? []).map((t: any) => [t.store_id, t.token]));
      const uniqueStoresMap = new Map<string, any>();
      (lojas || []).forEach((l: any) => {
        if (l.client_stores && !uniqueStoresMap.has(l.store_id)) {
          uniqueStoresMap.set(l.store_id, l.client_stores);
        }
      });
      const uniqueStoresList = Array.from(uniqueStoresMap.values());
      const tokensList = uniqueStoresList.map(store => ({
        token: tokenMap.get(store.id) || null,
        client_stores: store
      })) as StoreToken[];
      return {
        tokens: tokensList,
        hasStores: uniqueStoresList.length > 0,
        hasTokens: tokensList.some(t => t.token !== null),
      };
    },
  });

  // Normalized data (works for both modes)
  const config = isTokenMode ? (tokenData?.config ?? null) : legacyConfig;

  const tokensData = useMemo(() => {
    if (isTokenMode) {
      if (!tokenData) return undefined;
      const stores = (tokenData.stores ?? []) as Array<{
        store_id: string; name: string; store_code: string | null;
        city: string | null; state: string | null; token: string | null;
      }>;
      const tokensList: StoreToken[] = stores.map((s) => ({
        token: s.token,
        client_stores: {
          id: s.store_id,
          name: s.name,
          city: s.city,
          state: s.state,
          store_code: s.store_code,
        },
      }));
      return {
        tokens: tokensList,
        hasStores: tokensList.length > 0,
        hasTokens: tokensList.some((t) => t.token !== null),
      };
    }
    return legacyTokensData;
  }, [isTokenMode, tokenData, legacyTokensData]);

  const isLoading = isTokenMode ? loadingToken : (loadingLegacyConfig || loadingLegacyTokens);

  // Token invalid / expired
  if (isTokenMode && !loadingToken && (tokenError || tokenData === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground">
            Solicite um novo link ao responsável pela campanha.
          </p>
        </div>
      </div>
    );
  }


  const isLoading = loadingConfig || loadingTokens;
  const title = config?.occurrences_portal_title || t("occurrences.portal.title");
  const subtitle = config?.occurrences_portal_subtitle || t("occurrences.portal.subtitle");
  
  const isModuleDisabled = config && config.module_ocorrencias === false;
  const deadline = config?.deadline_ocorrencias ? new Date(config.deadline_ocorrencias) : null;
  const isDeadlinePassed = deadline && isAfter(new Date(), deadline);

  const { user } = useAuth();
  const isPublic = !user;

  const handleGoToStores = () => {
    if (isPublic) return;
    const pathParts = window.location.pathname.split("/");
    const agencyId = pathParts[2];
    const clientId = pathParts[4];
    navigate(`/agency/${agencyId}/clients/${clientId}/campaigns/${campaignId}?section=loja_a_loja&tab=lojas`);
  };

  const tokens = tokensData?.tokens || [];
  const hasStores = tokensData?.hasStores;
  const hasTokens = tokensData?.hasTokens;

  const availableStates = useMemo(() => {
    const states = new Set<string>();
    tokens.forEach(s => {
      if (s.client_stores?.state) states.add(s.client_stores.state);
    });
    return Array.from(states).sort();
  }, [tokens]);

  const filteredTokens = useMemo(() => {
    let result = tokens;
    if (selectedState !== "all") result = result.filter(s => s.client_stores?.state === selectedState);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(s =>
        s.client_stores?.name?.toLowerCase().includes(q) ||
        s.client_stores?.store_code?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tokens, selectedState, searchQuery]);

  // Group by state -> city
  const grouped = filteredTokens.reduce<Record<string, Record<string, StoreToken[]>>>((acc, t) => {
    if (!t.client_stores) return acc;
    const state = t.client_stores.state || "Sem UF";
    const city = t.client_stores.city || "Sem cidade";
    if (!acc[state]) acc[state] = {};
    if (!acc[state][city]) acc[state][city] = [];
    acc[state][city].push(t);
    return acc;
  }, {});

  const sortedStates = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (!hasStores) {
    return <OccurrencesPortalEmptyState type="no-stores" onGoToStores={!isPublic ? handleGoToStores : undefined} />;
  }

  if (isModuleDisabled || !hasTokens) {
    return <OccurrencesPortalEmptyState type="no-access" onGoToStores={!isPublic ? handleGoToStores : undefined} />;
  }

  if (isDeadlinePassed) {
    return <OccurrencesPortalEmptyState type="deadline-passed" />;
  }

  if (tokens.length === 0) {
    return <div className="text-center py-16 text-muted-foreground">Nenhuma loja disponível.</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-8 sm:mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">{subtitle}</p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar loja por nome ou código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {availableStates.length > 1 && (
              <div className="w-full md:w-64">
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
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
          </div>
        </header>

        {isModuleDisabled && (
          <Alert variant="destructive" className="mb-8">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Módulo desativado</AlertTitle>
            <AlertDescription>
              O registro de ocorrências para esta campanha não está habilitado no momento.
            </AlertDescription>
          </Alert>
        )}

        {isDeadlinePassed && !isModuleDisabled && (
          <Alert className="mb-8 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10">
            <Clock className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-500">Prazo de ocorrências encerrado</AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-400">
              O prazo para registro de ocorrências expirou em {deadline?.toLocaleDateString("pt-BR")} às {deadline?.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-8">
          {sortedStates.map((state) => {
            const cities = Object.keys(grouped[state]).sort((a, b) => a.localeCompare(b, "pt-BR"));
            return (
              <section key={state}>
                <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#8C6F4E]" />
                  {state}
                </h2>
                <div className="space-y-5">
                  {cities.map((city) => {
                    const cityStores = [...grouped[state][city]].sort((a, b) =>
                      (a.client_stores?.name || "").localeCompare(b.client_stores?.name || "", "pt-BR")
                    );
                    return (
                      <div key={city}>
                        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                          {city}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {cityStores.map((s) => {
                            const hasToken = !!s.token;
                            const CardContent = (
                              <div className="flex items-start gap-2">
                                <StoreIcon className="h-4 w-4 text-[#8C6F4E] mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                  <div className="font-medium text-sm text-foreground truncate">
                                    {s.client_stores?.name}
                                  </div>
                                  {s.client_stores?.store_code && (
                                    <div className="text-xs text-muted-foreground">
                                      Cód: {s.client_stores.store_code}
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {s.client_stores?.city}
                                    {s.client_stores?.state ? ` / ${s.client_stores.state}` : ""}
                                  </div>
                                  {!hasToken && (
                                    <div className="text-[10px] text-destructive font-semibold uppercase mt-1">
                                      Acesso não configurado
                                    </div>
                                  )}
                                </div>
                              </div>
                            );

                            if (!hasToken || isModuleDisabled) {
                              return (
                                <div
                                  key={s.client_stores?.id}
                                  className="rounded-lg border bg-card/50 p-4 opacity-70 grayscale flex flex-col gap-1 cursor-not-allowed"
                                >
                                  {CardContent}
                                </div>
                              );
                            }

                            return (
                              <a
                                key={s.token}
                                href={`/loja/${s.token}`}
                                className="rounded-lg border bg-card p-4 hover:ring-2 hover:ring-[#8C6F4E]/50 cursor-pointer transition-all flex flex-col gap-1"
                              >
                                {CardContent}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {sortedStates.length === 0 && (searchQuery || selectedState !== "all") && (
            <p className="text-center text-muted-foreground py-12">Nenhuma loja encontrada para os filtros aplicados.</p>
          )}
        </div>
      </div>
    </div>
  );
}
