import { useParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { Store, AlertTriangle, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import OcorrenciasTab from "@/components/StorePortal/OcorrenciasTab";
import ManutencaoTab from "@/components/StorePortal/ManutencaoTab";
import ReposicoesTab from "@/components/StorePortal/ReposicoesTab";
import ConformidadeTab from "@/components/StorePortal/ConformidadeTab";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface PortalData {
  token_id: string;
  campaign: {
    id: string;
    name: string;
    client_id: string;
    clients: { name: string; agency_id: string; agencies: { name: string } };
  };
  store: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    store_code: string | null;
    nickname: string | null;
  };
  tipos: Array<{ id: string; nome: string; letra: string; tem_subdivisao: boolean | null; display_order: number | null }>;
  subdivisoes: Array<{ id: string; tipo_id: string; nome: string; display_order: number | null }>;
  pecas: Array<{ id: string; nome: string; image_url: string | null; tipo_id: string | null; subdivisao_id: string | null; display_order: number | null; campaign_id: string }>;
  lojas: Array<{ id: string; store_id: string; tipo_id: string | null; subdivisao_id: string | null; ativo: boolean | null; campaign_id: string }>;
  portal_config?: {
    module_conformidade: boolean;
    module_ocorrencias: boolean;
    module_manutencao: boolean;
    module_reposicoes: boolean;
    deadline_conformidade: string | null;
    deadline_ocorrencias: string | null;
    deadline_manutencao: string | null;
    deadline_reposicoes: string | null;
    portal_title: string | null;
    portal_welcome_message: string | null;
  } | null;
  store_override?: {
    module_conformidade: boolean | null;
    module_ocorrencias: boolean | null;
    module_manutencao: boolean | null;
    module_reposicoes: boolean | null;
  } | null;
}

type ModuleKey = "module_ocorrencias" | "module_manutencao" | "module_reposicoes" | "module_conformidade";
type DeadlineKey = "deadline_ocorrencias" | "deadline_manutencao" | "deadline_reposicoes" | "deadline_conformidade";

const MODULE_TABS: Array<{
  value: string;
  label: string;
  moduleKey: ModuleKey;
  deadlineKey: DeadlineKey;
}> = [
  { value: "ocorrencias", label: "Ocorrências", moduleKey: "module_ocorrencias", deadlineKey: "deadline_ocorrencias" },
  { value: "manutencao", label: "Manutenção", moduleKey: "module_manutencao", deadlineKey: "deadline_manutencao" },
  { value: "reposicoes", label: "Reposições", moduleKey: "module_reposicoes", deadlineKey: "deadline_reposicoes" },
  { value: "conformidade", label: "Conformidade", moduleKey: "module_conformidade", deadlineKey: "deadline_conformidade" },
];

function isModuleEnabled(
  config: PortalData["portal_config"],
  override: PortalData["store_override"],
  key: ModuleKey
): boolean {
  // Override takes priority if not null
  if (override && override[key] !== null && override[key] !== undefined) {
    return override[key] as boolean;
  }
  // Global config
  if (config) {
    return config[key];
  }
  // Default: enabled
  return true;
}

function getDeadlineStatus(config: PortalData["portal_config"], key: DeadlineKey): { expired: boolean; warning: boolean; deadline: Date | null } {
  if (!config || !config[key]) return { expired: false, warning: false, deadline: null };
  const deadline = new Date(config[key]!);
  const now = new Date();
  const expired = now > deadline;
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  const warning = !expired && (deadline.getTime() - now.getTime()) < threeDays;
  return { expired, warning, deadline };
}

export default function StorePortal() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortalData | null>(null);

  useEffect(() => {
    if (!token) { setError("Token não informado"); setLoading(false); return; }

    supabase.functions.invoke("validate-store-token", { body: { token } })
      .then(({ data: res, error: fnErr }) => {
        if (fnErr || !res?.success) {
          setError(res?.error || fnErr?.message || "Token inválido");
        } else {
          setData(res as PortalData);
        }
        setLoading(false);
      });
  }, [token]);

  const enabledTabs = useMemo(() => {
    if (!data) return [];
    return MODULE_TABS.filter((tab) =>
      isModuleEnabled(data.portal_config, data.store_override, tab.moduleKey)
    );
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md text-center px-6 py-8">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground text-sm">{error || "Token inválido ou expirado."}</p>
        </div>
      </div>
    );
  }

  const agencyId = data.campaign.clients.agency_id;
  const agencyName = data.campaign.clients.agencies.name;
  const storeName = data.store.nickname || data.store.name;
  const storeLocation = [data.store.city, data.store.state].filter(Boolean).join("/");
  const defaultTab = enabledTabs.length > 0 ? enabledTabs[0].value : "ocorrencias";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-[#8C6F4E] text-white px-4 py-4 shadow-md">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <Store className="w-6 h-6 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs opacity-80 truncate">{agencyName}</p>
              <h1 className="text-lg font-bold truncate">
                {data.portal_config?.portal_title || data.campaign.name}
              </h1>
            </div>
          </div>
          <p className="text-sm opacity-90 truncate">
            {storeName}{storeLocation ? ` — ${storeLocation}` : ""}
            {data.store.store_code ? ` (${data.store.store_code})` : ""}
          </p>
          {data.portal_config?.portal_welcome_message && (
            <p className="text-xs opacity-75 mt-1">{data.portal_config.portal_welcome_message}</p>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {enabledTabs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum módulo habilitado para esta loja.
          </div>
        ) : (
          <Tabs defaultValue={defaultTab}>
            <TabsList className={`w-full grid h-auto`} style={{ gridTemplateColumns: `repeat(${enabledTabs.length}, 1fr)` }}>
              {enabledTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm py-2">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {enabledTabs.map((tab) => {
              const deadlineStatus = getDeadlineStatus(data.portal_config, tab.deadlineKey);
              return (
                <TabsContent key={tab.value} value={tab.value}>
                  {deadlineStatus.expired ? (
                    <div className="text-center py-12">
                      <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <h2 className="text-lg font-semibold text-foreground mb-1">Prazo encerrado</h2>
                      <p className="text-sm text-muted-foreground">
                        O prazo para {tab.label.toLowerCase()} encerrou em{" "}
                        {deadlineStatus.deadline?.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  ) : (
                    <>
                      {deadlineStatus.warning && deadlineStatus.deadline && (
                        <Alert className="mb-4 border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
                          <Clock className="h-4 w-4 text-yellow-600" />
                          <AlertDescription className="text-yellow-700 dark:text-yellow-400 text-sm">
                            Atenção: o prazo para {tab.label.toLowerCase()} encerra em{" "}
                            {deadlineStatus.deadline.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}.
                          </AlertDescription>
                        </Alert>
                      )}
                      {tab.value === "ocorrencias" && <OcorrenciasTab data={data} agencyId={agencyId} />}
                      {tab.value === "manutencao" && <ManutencaoTab data={data} agencyId={agencyId} />}
                      {tab.value === "reposicoes" && <ReposicoesTab data={data} agencyId={agencyId} />}
                      {tab.value === "conformidade" && <ConformidadeTab data={data} agencyId={agencyId} />}
                    </>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
    </div>
  );
}
