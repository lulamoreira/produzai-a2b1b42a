import { useState, useMemo, useCallback, useEffect } from "react";
import { useLojaALojaLojas } from "@/hooks/useLojaALoja";
import {
  useStorePortalConfig,
  useUpsertPortalConfig,
  useStorePortalOverrides,
  useUpsertStoreOverride,
  useBulkSetOverrides,
} from "@/hooks/useStorePortalConfig";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import DebouncedInput from "@/components/DebouncedInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Minus } from "lucide-react";
import { format } from "date-fns";
import MotivosManager from "./MotivosManager";

interface Props {
  campaignId: string;
  clientId: string;
  isAdmin: boolean;
}

const MODULES = [
  { key: "module_ocorrencias" as const, label: "Ocorrências", desc: "Permite que a loja registre ocorrências" },
  { key: "module_manutencao" as const, label: "Manutenção", desc: "Permite que a loja solicite manutenção" },
  { key: "module_reposicoes" as const, label: "Reposições", desc: "Permite que a loja solicite reposições" },
  { key: "module_conformidade" as const, label: "Conformidade", desc: "Permite que a loja registre conformidade" },
];

const DEADLINE_KEYS = {
  module_ocorrencias: "deadline_ocorrencias" as const,
  module_manutencao: "deadline_manutencao" as const,
  module_reposicoes: "deadline_reposicoes" as const,
  module_conformidade: "deadline_conformidade" as const,
};

type ModuleKey = (typeof MODULES)[number]["key"];

export default function PortalConfigTab({ campaignId, clientId, isAdmin }: Props) {
  const { data: config, isLoading: configLoading } = useStorePortalConfig(campaignId);
  const upsertConfig = useUpsertPortalConfig();
  const { data: overrides = [] } = useStorePortalOverrides(campaignId);
  const upsertOverride = useUpsertStoreOverride();
  const bulkSet = useBulkSetOverrides();

  const { data: lojas = [] } = useLojaALojaLojas(campaignId);
  const storeIds = useMemo(() => [...new Set(lojas.filter((l) => l.ativo).map((l) => l.store_id))], [lojas]);

  const { data: stores = [] } = useQuery({
    queryKey: ["portal-config-stores", clientId, storeIds],
    enabled: storeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_stores")
        .select("id, name, city, state, store_code")
        .in("id", storeIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const overrideMap = useMemo(() => {
    const m = new Map<string, (typeof overrides)[0]>();
    overrides.forEach((o) => m.set(o.store_id, o));
    return m;
  }, [overrides]);

  // Debounced global config save
  const [localConfig, setLocalConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    if (config) setLocalConfig(config);
  }, [config]);

    const saveConfig = useCallback(
    (patch: Record<string, any>) => {
      const next = { ...localConfig, ...patch, campaign_id: campaignId };
      setLocalConfig(next);
      const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = next as any;
      upsertConfig.mutate(rest as any);
    },
    [localConfig, campaignId, upsertConfig]
  );

  const handleToggle = (key: ModuleKey, val: boolean) => {
    if (!isAdmin) return;
    saveConfig({ [key]: val });
  };

  const handleDeadline = (key: string, val: string) => {
    if (!isAdmin) return;
    saveConfig({ [key]: val || null });
  };

  const handleStoreToggle = (storeId: string, key: ModuleKey, currentVal: boolean | null) => {
    if (!isAdmin) return;
    const newVal = currentVal === null ? false : currentVal ? false : true;
    upsertOverride.mutate({ campaign_id: campaignId, store_id: storeId, [key]: newVal });
  };

  const handleBulkAll = (value: boolean) => {
    if (!isAdmin) return;
    bulkSet.mutate({
      campaign_id: campaignId,
      store_ids: storeIds,
      values: { module_conformidade: value, module_ocorrencias: value, module_manutencao: value, module_reposicoes: value },
    });
  };

  const handleStoreAll = (storeId: string, value: boolean) => {
    if (!isAdmin) return;
    upsertOverride.mutate({
      campaign_id: campaignId,
      store_id: storeId,
      module_conformidade: value,
      module_ocorrencias: value,
      module_manutencao: value,
      module_reposicoes: value,
    });
  };

  if (configLoading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Section A — Global Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurações Globais</CardTitle>
          <CardDescription>Ative ou desative módulos e defina prazos para o portal das lojas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {MODULES.map((mod) => {
            const isOn = (localConfig as any)?.[mod.key] ?? true;
            const deadlineKey = DEADLINE_KEYS[mod.key];
            const deadlineVal = (localConfig as any)?.[deadlineKey] ?? "";
            return (
              <div key={mod.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">{mod.label}</Label>
                    <p className="text-xs text-muted-foreground">{mod.desc}</p>
                  </div>
                  <Switch checked={isOn} onCheckedChange={(v) => handleToggle(mod.key, v)} disabled={!isAdmin} />
                </div>
                {isOn && (
                  <div className="flex items-center gap-2 pl-4">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Prazo:</Label>
                    <Input
                      type="datetime-local"
                      className="h-8 text-xs w-auto"
                      value={deadlineVal ? deadlineVal.slice(0, 16) : ""}
                      onChange={(e) => handleDeadline(deadlineKey, e.target.value ? new Date(e.target.value).toISOString() : "")}
                      disabled={!isAdmin}
                    />
                  </div>
                )}
                <Separator />
              </div>
            );
          })}

          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-sm">Título do Portal</Label>
              <DebouncedInput
                className="mt-1"
                placeholder="Título personalizado (opcional)"
                value={(localConfig as any)?.portal_title ?? ""}
                onValueCommit={(v) => saveConfig({ portal_title: v || null })}
                disabled={!isAdmin}
              />
            </div>
            <div>
              <Label className="text-sm">Mensagem de Boas-vindas</Label>
              <DebouncedInput
                className="mt-1"
                placeholder="Mensagem opcional exibida no portal"
                value={(localConfig as any)?.portal_welcome_message ?? ""}
                onValueCommit={(v) => saveConfig({ portal_welcome_message: v || null })}
                disabled={!isAdmin}
              />
            </div>
          </div>

          {(localConfig as any)?.updated_at && (
            <p className="text-xs text-muted-foreground">
              Último salvamento: {format(new Date((localConfig as any).updated_at), "dd/MM/yyyy HH:mm")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section B — Per-Store Overrides */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg">Configurações por Loja</CardTitle>
              <CardDescription>Sobrescreva a configuração global para lojas específicas. Valores vazios (—) usam a configuração global.</CardDescription>
            </div>
            {isAdmin && storeIds.length > 0 && (
              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Autorizar tudo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Autorizar todos os módulos?</AlertDialogTitle>
                      <AlertDialogDescription>Isso ativará todos os 4 módulos para todas as {storeIds.length} lojas.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleBulkAll(true)}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive">
                      <XCircle className="h-3.5 w-3.5" />
                      Remover tudo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desativar todos os módulos?</AlertDialogTitle>
                      <AlertDialogDescription>Isso desativará todos os 4 módulos para todas as {storeIds.length} lojas.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleBulkAll(false)}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma loja vinculada.</p>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loja</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>UF</TableHead>
                    {MODULES.map((m) => (
                      <TableHead key={m.key} className="text-center text-xs">{m.label}</TableHead>
                    ))}
                    {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.map((store) => {
                    const ov = overrideMap.get(store.id);
                    return (
                      <TableRow key={store.id}>
                        <TableCell className="font-medium text-sm">
                          {store.store_code ? `${store.store_code} — ` : ""}
                          {store.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{store.city || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{store.state || "—"}</TableCell>
                        {MODULES.map((mod) => {
                          const val = ov ? (ov as any)[mod.key] : null;
                          return (
                            <TableCell key={mod.key} className="text-center">
                              {val === null ? (
                                <button
                                  className="inline-flex items-center justify-center"
                                  onClick={() => handleStoreToggle(store.id, mod.key, null)}
                                  disabled={!isAdmin}
                                  title="Usar configuração global — clique para sobrescrever"
                                >
                                  <Minus className="h-4 w-4 text-muted-foreground" />
                                </button>
                              ) : val ? (
                                <button
                                  className="inline-flex items-center justify-center"
                                  onClick={() => handleStoreToggle(store.id, mod.key, true)}
                                  disabled={!isAdmin}
                                  title="Ativado — clique para desativar"
                                >
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </button>
                              ) : (
                                <button
                                  className="inline-flex items-center justify-center"
                                  onClick={() => handleStoreToggle(store.id, mod.key, false)}
                                  disabled={!isAdmin}
                                  title="Desativado — clique para usar config global"
                                >
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </button>
                              )}
                            </TableCell>
                          );
                        })}
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2"
                                onClick={() => handleStoreAll(store.id, true)}
                              >
                                Tudo
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2 text-destructive"
                                onClick={() => handleStoreAll(store.id, false)}
                              >
                                Nada
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section C — Motivos de Ocorrência */}
      <MotivosManager clientId={clientId} isAdmin={isAdmin} />
    </div>
  );
}
