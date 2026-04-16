import { useState, useMemo, useCallback, useEffect } from "react";
import { useLojaALojaLojas } from "@/hooks/useLojaALoja";
import {
  useStorePortalConfig,
  useUpsertPortalConfig,
  useStorePortalOverrides,
  useUpsertStoreOverride,
  useBulkSetOverrides,
} from "@/hooks/useStorePortalConfig";
import {
  usePortalConfigLayout,
  useUpdatePortalConfigLayout,
  DEFAULT_CARD_ORDER,
} from "@/hooks/usePortalConfigLayout";
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
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { CheckCircle2, XCircle, Minus, Copy, ExternalLink, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import MotivosManager from "./MotivosManager";
import { useTableSort } from "@/hooks/useTableSort";
import SortableHeader from "./SortableHeader";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

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

const CARD_TITLES: Record<string, string> = {
  portal_ocorrencias: "Portal de Ocorrências",
  globais: "Configurações Globais",
  por_loja: "Configurações por Loja",
  motivos: "Motivos de Ocorrência",
};

interface SortableCardProps {
  id: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isAdmin: boolean;
  children: React.ReactNode;
  title: string;
}

function SortableCard({ id, collapsed, onToggleCollapsed, isAdmin, children, title }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !isAdmin });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={cn(isDragging && "ring-2 ring-primary")}>
        <Collapsible open={!collapsed} onOpenChange={onToggleCollapsed}>
          <div className="flex items-center gap-2 px-6 py-4 border-b">
            {isAdmin && (
              <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Arrastar para reordenar"
                type="button"
              >
                <GripVertical className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="flex-1 flex items-center gap-2 text-left"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className="text-lg font-semibold">{title}</span>
            </button>
          </div>
          <CollapsibleContent>{children}</CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}

export default function PortalConfigTab({ campaignId, clientId, isAdmin }: Props) {
  const { data: config, isLoading: configLoading } = useStorePortalConfig(campaignId);
  const upsertConfig = useUpsertPortalConfig();
  const { data: overrides = [] } = useStorePortalOverrides(campaignId);
  const upsertOverride = useUpsertStoreOverride();
  const bulkSet = useBulkSetOverrides();

  const { data: layout } = usePortalConfigLayout();
  const updateLayout = useUpdatePortalConfigLayout();

  const cardOrder = layout?.card_order ?? [...DEFAULT_CARD_ORDER];
  const collapsedCards = layout?.collapsed_cards ?? ["por_loja"];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !isAdmin) return;
    const oldIdx = cardOrder.indexOf(active.id as string);
    const newIdx = cardOrder.indexOf(over.id as string);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(cardOrder, oldIdx, newIdx);
    updateLayout.mutate({ card_order: next });
  };

  const toggleCollapsed = (key: string) => {
    const isCollapsed = collapsedCards.includes(key);
    const next = isCollapsed ? collapsedCards.filter((k) => k !== key) : [...collapsedCards, key];
    if (isAdmin) {
      updateLayout.mutate({ collapsed_cards: next });
    } else {
      // Non-admins: do nothing (can't change global state)
      toast.info("Apenas administradores podem alterar o layout");
    }
  };

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

  const storesSort = useTableSort(stores as any[], {
    getValue: {
      name: (s: any) => (s.store_code ? `${s.store_code} ${s.name}` : s.name).toLowerCase(),
      city: (s: any) => (s.city ?? "").toLowerCase(),
      state: (s: any) => (s.state ?? "").toLowerCase(),
    },
  });

  const overrideMap = useMemo(() => {
    const m = new Map<string, (typeof overrides)[0]>();
    overrides.forEach((o) => m.set(o.store_id, o));
    return m;
  }, [overrides]);

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

  const portalUrl = `${window.location.origin}/ocorrencias-portal/${campaignId}`;

  // Render functions for each card body
  const renderCardBody = (key: string) => {
    switch (key) {
      case "portal_ocorrencias":
        return (
          <CardContent className="space-y-4 pt-6">
            <CardDescription className="-mt-2">
              Página pública que lista todas as lojas vinculadas para acesso rápido ao portal de cada uma.
            </CardDescription>
            <div>
              <Label className="text-sm">Título</Label>
              <DebouncedInput
                className="mt-1"
                placeholder="Portal de Ocorrências"
                value={(localConfig as any)?.occurrences_portal_title ?? ""}
                onValueCommit={(v) => saveConfig({ occurrences_portal_title: v || null })}
                disabled={!isAdmin}
              />
            </div>
            <div>
              <Label className="text-sm">Subtítulo</Label>
              <DebouncedInput
                className="mt-1"
                placeholder="Selecione sua loja para registrar uma ocorrência"
                value={(localConfig as any)?.occurrences_portal_subtitle ?? ""}
                onValueCommit={(v) => saveConfig({ occurrences_portal_subtitle: v || null })}
                disabled={!isAdmin}
              />
            </div>
            <div>
              <Label className="text-sm">URL pública</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={portalUrl} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(portalUrl);
                    toast.success("Link copiado");
                  }}
                  title="Copiar"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(portalUrl, "_blank")}
                  title="Abrir"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        );

      case "globais":
        return (
          <CardContent className="space-y-6 pt-6">
            <CardDescription className="-mt-2">Ative ou desative módulos e defina prazos para o portal das lojas</CardDescription>
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
              <div>
                <Label className="text-sm">Mensagem para peças bloqueadas (com *)</Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Peças cujo nome contém um asterisco (*) ficam bloqueadas para reporte. Esta mensagem aparece quando a loja clicar em uma delas.
                </p>
                <DebouncedInput
                  className="mt-1"
                  placeholder="Ex: Esta peça está sob análise da agência. Aguarde novas instruções."
                  value={(localConfig as any)?.blocked_piece_message ?? ""}
                  onValueCommit={(v) => saveConfig({ blocked_piece_message: v || null })}
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
        );

      case "por_loja":
        return (
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardDescription>Sobrescreva a configuração global para lojas específicas. Valores vazios (—) usam a configuração global.</CardDescription>
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
        );

      case "motivos":
        return (
          <CardContent className="pt-6">
            <MotivosManager clientId={clientId} isAdmin={isAdmin} embedded />
          </CardContent>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={cardOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {cardOrder.map((key) => (
              <SortableCard
                key={key}
                id={key}
                title={CARD_TITLES[key] ?? key}
                collapsed={collapsedCards.includes(key)}
                onToggleCollapsed={() => toggleCollapsed(key)}
                isAdmin={isAdmin}
              >
                {renderCardBody(key)}
              </SortableCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
