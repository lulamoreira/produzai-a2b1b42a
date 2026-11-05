import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Store as StoreIcon, ClipboardList } from "lucide-react";

interface SummaryStore {
  store_id: string;
  name: string;
  store_code: string | null;
  city: string | null;
  state: string | null;
  token: string | null;
  total_count: number;
  open_count: number;
}

export default function OccurrencesStatusBoard() {
  const { campaignId: routeCampaignId, token: routeToken } = useParams<{ campaignId?: string; token?: string }>();
  const navigate = useNavigate();
  const isTokenMode = !!routeToken;

  useEffect(() => {
    if (isTokenMode || !routeCampaignId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_portal_token_for_campaign", { p_campaign_id: routeCampaignId });
      if (cancelled) return;
      if (error) { console.error("Supabase Error [get_portal_token_for_campaign]:", error); return; }
      if (data) navigate(`/ocorrencias-status/t/${data}`, { replace: true });
    })();
    return () => { cancelled = true; };
  }, [isTokenMode, routeCampaignId, navigate]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["occ-status-board", routeToken],
    enabled: isTokenMode,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_occurrences_summary_by_token", { p_token: routeToken! });
      if (error) { console.error("Supabase Error [get_occurrences_summary_by_token]:", error); throw error; }
      return data as any;
    },
  });

  if (!isTokenMode || isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  if (isError || data === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground">Solicite um novo link ao responsável pela campanha.</p>
        </div>
      </div>
    );
  }

  const campaign = data?.campaign ?? null;
  const config = data?.config ?? null;
  const stores: SummaryStore[] = (data?.stores ?? []) as SummaryStore[];
  const title = config?.occurrences_portal_title || "Status das Ocorrências";
  const subtitle = config?.occurrences_portal_subtitle || "Lojas com ocorrências registradas. Toque numa loja para ver a situação.";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
          {campaign?.name && (
            <p className="text-sm text-muted-foreground mt-1">
              {campaign.client_name ? `${campaign.client_name} · ` : ""}{campaign.name}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>
        </header>

        {stores.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
            Nenhuma loja com ocorrências registradas.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stores.map((s) => {
              const inner = (
                <>
                  <div className="flex items-start gap-2">
                    <StoreIcon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-foreground truncate">{s.name}</div>
                      {s.store_code && <div className="text-xs text-muted-foreground">Cód: {s.store_code}</div>}
                      <div className="text-xs text-muted-foreground mt-0.5">{s.city}{s.state ? ` / ${s.state}` : ""}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {s.open_count > 0 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                        {s.open_count} aberta{s.open_count === 1 ? "" : "s"}
                      </span>
                    )}
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {s.total_count} no total
                    </span>
                  </div>
                </>
              );
              if (!s.token) {
                return <div key={s.store_id} className="rounded-lg border bg-card/50 p-4 opacity-70">{inner}</div>;
              }
              return (
                <a key={s.store_id} href={`/loja/${s.token}?situacao=1`} className="rounded-lg border bg-card p-4 hover:ring-2 hover:ring-primary/50 transition-all block">
                  {inner}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
