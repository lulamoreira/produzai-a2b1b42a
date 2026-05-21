import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Store as StoreIcon, AlertTriangle, Clock } from "lucide-react";
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
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();


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
        console.error("Supabase Error [occ-portal-config]:", error);
        throw error;
      }
      return data;
    },
  });

  const { data: tokensData, isLoading: loadingTokens } = useQuery({
    queryKey: ["occ-portal-stores-v1-logic", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      // Fetch all active stores in the campaign from loja_a_loja_lojas
      const { data: lojas, error: lojasErr } = await supabase
        .from("loja_a_loja_lojas")
        .select("store_id, client_stores(id, name, city, state, store_code)")
        .eq("campaign_id", campaignId!)
        .eq("ativo", true);
      
      if (lojasErr) {
        console.error("Supabase Error [occ-portal-lojas]:", lojasErr);
        throw lojasErr;
      }

      // Fetch existing tokens
      const { data: existingTokens, error: tokensErr } = await supabase
        .from("store_portal_tokens")
        .select("token, store_id")
        .eq("campaign_id", campaignId!);
      
      if (tokensErr) {
        console.error("Supabase Error [occ-portal-tokens]:", tokensErr);
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

      const uniqueStoresList = Array.from(uniqueStoresMap.values());
      const tokensList = uniqueStoresList.map(store => ({
        token: tokenMap.get(store.id) || null,
        client_stores: store
      })) as StoreToken[];

      return {
        tokens: tokensList,
        hasStores: uniqueStoresList.length > 0,
        hasTokens: tokensList.some(t => t.token !== null)
      };
    },
  });


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


  // Group by state -> city
  const grouped = tokens.reduce<Record<string, Record<string, StoreToken[]>>>((acc, t) => {
    if (!t.client_stores) return acc;
    const state = t.client_stores.state || "Sem UF";
    const city = t.client_stores.city || "Sem cidade";
    if (!acc[state]) acc[state] = {};
    if (!acc[state][city]) acc[state][city] = [];
    acc[state][city].push(t);
    return acc;
  }, {});

  const sortedStates = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "pt-BR"));


  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">{subtitle}</p>
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

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : !hasStores ? (
          <OccurrencesPortalEmptyState type="no-stores" onGoToStores={!isPublic ? handleGoToStores : undefined} />
        ) : isModuleDisabled || !hasTokens ? (
          <OccurrencesPortalEmptyState type="no-access" onGoToStores={!isPublic ? handleGoToStores : undefined} />
        ) : isDeadlinePassed ? (
          <OccurrencesPortalEmptyState type="deadline-passed" />
        ) : tokens.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">Nenhuma loja disponível.</div>
        ) : (

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
          </div>
        )}

      </div>
    </div>
  );
}
