import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TiposManager from "@/components/LojaALoja/TiposManager";
import LojasManager from "@/components/LojaALoja/LojasManager";
import LojaALojaDashboard from "@/components/LojaALoja/LojaALojaDashboard";
import PortaisManager from "@/components/LojaALoja/PortaisManager";
import PortalDashboard from "@/components/LojaALoja/PortalDashboard";
import PortalConfigTab from "@/components/LojaALoja/PortalConfigTab";
import OccurrencesByStoreTab from "@/components/LojaALoja/OccurrencesByStoreTab";
import {
  LayoutGrid,
  Store,
  BarChart3,
  Settings2,
  LayoutDashboard,
  Settings,
  GripVertical,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useLojaALojaTabOrder,
  DEFAULT_LOJA_A_LOJA_TABS,
} from "@/hooks/useLojaALojaTabOrder";
import type { LalPermissions } from "@/hooks/useLojaALojaPermissions";

interface Props {
  campaignId: string;
  clientId: string;
  permissions: LalPermissions;
}

const TAB_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  dashboard: { label: "Dashboard", icon: BarChart3 },
  "portal-dashboard": { label: "Ocorrências", icon: LayoutDashboard },
  "por-loja": { label: "Por Loja", icon: Building2 },
  tipos: { label: "Loja a Loja", icon: LayoutGrid },
  lojas: { label: "Classificação", icon: Store },
  portais: { label: "Acessos", icon: Settings2 },
  config: { label: "Config", icon: Settings },
};

function SortableTab({ id }: { id: string }) {
  const meta = TAB_META[id];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!meta) return null;
  const Icon = meta.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative inline-flex items-center rounded-sm",
        isDragging && "z-10"
      )}
    >
      <span
        {...attributes}
        {...listeners}
        role="button"
        aria-label="Arrastar para reordenar"
        title="Arrastar para reordenar"
        className={cn(
          "flex h-7 w-5 items-center justify-center rounded-l-sm text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-grab active:cursor-grabbing touch-none select-none",
          isDragging && "cursor-grabbing"
        )}
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <TabsTrigger value={id} className="gap-1.5 pl-2">
        <Icon className="h-3.5 w-3.5" />
        {meta.label}
      </TabsTrigger>
    </div>
  );
}

export default function LojaALojaTab({ campaignId, clientId, permissions }: Props) {
  const { order, saveOrder, loaded } = useLojaALojaTabOrder();

  // Filter tabs by per-area view permission
  const visibleTabs = useMemo(() => {
    return order.filter((id) => {
      switch (id) {
        case "dashboard": return permissions.canViewModule;
        case "portal-dashboard": return permissions.ocorrencias.canView;
        case "por-loja": return permissions.ocorrencias.canView;
        case "tipos": return permissions.estrutura.canView;
        case "lojas": return permissions.classificacao.canView;
        case "portais": return permissions.acessos.canView;
        case "config": return permissions.config.canView;
        default: return false;
      }
    });
  }, [order, permissions]);

  const [active, setActive] = useState<string>(visibleTabs[0] ?? DEFAULT_LOJA_A_LOJA_TABS[0]);

  useEffect(() => {
    if (!loaded) return;
    if (!visibleTabs.includes(active)) {
      setActive(visibleTabs[0] ?? DEFAULT_LOJA_A_LOJA_TABS[0]);
    }
  }, [loaded, visibleTabs, active]);

  useEffect(() => {
    if (loaded && visibleTabs[0]) setActive(visibleTabs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const oldIndex = order.indexOf(String(a.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    saveOrder(next);
  };

  if (permissions.isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Carregando permissões...</div>;
  }

  if (!permissions.canViewModule) {
    return <div className="text-sm text-muted-foreground p-4">Você não tem acesso a este módulo.</div>;
  }

  return (
    <Tabs value={active} onValueChange={setActive} className="w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleTabs} strategy={horizontalListSortingStrategy}>
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            {visibleTabs.map((id) => (
              <SortableTab key={id} id={id} />
            ))}
          </TabsList>
        </SortableContext>
      </DndContext>

      {visibleTabs.includes("dashboard") && (
        <TabsContent value="dashboard">
          <LojaALojaDashboard campaignId={campaignId} clientId={clientId} />
        </TabsContent>
      )}
      {visibleTabs.includes("portal-dashboard") && (
        <TabsContent value="portal-dashboard">
          <PortalDashboard campaignId={campaignId} clientId={clientId} permissions={permissions.ocorrencias} />
        </TabsContent>
      )}
      {visibleTabs.includes("por-loja") && (
        <TabsContent value="por-loja">
          <OccurrencesByStoreTab campaignId={campaignId} clientId={clientId} permissions={permissions.ocorrencias} />
        </TabsContent>
      )}
      {visibleTabs.includes("tipos") && (
        <TabsContent value="tipos">
          <TiposManager campaignId={campaignId} permissions={permissions.estrutura} />
        </TabsContent>
      )}
      {visibleTabs.includes("lojas") && (
        <TabsContent value="lojas">
          <LojasManager campaignId={campaignId} clientId={clientId} permissions={permissions.classificacao} />
        </TabsContent>
      )}
      {visibleTabs.includes("portais") && (
        <TabsContent value="portais">
          <PortaisManager campaignId={campaignId} clientId={clientId} permissions={permissions.acessos} />
        </TabsContent>
      )}
      {visibleTabs.includes("config") && (
        <TabsContent value="config">
          <PortalConfigTab campaignId={campaignId} clientId={clientId} permissions={permissions.config} />
        </TabsContent>
      )}
    </Tabs>
  );
}
