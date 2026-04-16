import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TiposManager from "@/components/LojaALoja/TiposManager";
import LojasManager from "@/components/LojaALoja/LojasManager";
import LojaALojaDashboard from "@/components/LojaALoja/LojaALojaDashboard";
import PortaisManager from "@/components/LojaALoja/PortaisManager";
import PortalDashboard from "@/components/LojaALoja/PortalDashboard";
import PortalConfigTab from "@/components/LojaALoja/PortalConfigTab";
import {
  LayoutGrid,
  Store,
  BarChart3,
  Settings2,
  LayoutDashboard,
  Settings,
  GripVertical,
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

interface Props {
  campaignId: string;
  clientId: string;
  isAdmin: boolean;
}

const TAB_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  dashboard: { label: "Dashboard", icon: BarChart3 },
  "portal-dashboard": { label: "Ocorrências", icon: LayoutDashboard },
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

export default function LojaALojaTab({ campaignId, clientId, isAdmin }: Props) {
  const { order, saveOrder, loaded } = useLojaALojaTabOrder();
  const [active, setActive] = useState<string>(DEFAULT_LOJA_A_LOJA_TABS[0]);

  // Quando a ordem carrega/muda, garante que a aba ativa exista; default = primeira
  useEffect(() => {
    if (!loaded) return;
    if (!order.includes(active)) {
      setActive(order[0] ?? DEFAULT_LOJA_A_LOJA_TABS[0]);
    }
  }, [loaded, order, active]);

  // Define a primeira aba da ordem salva como padrão na montagem
  useEffect(() => {
    if (loaded && order[0]) setActive(order[0]);
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

  const renderedOrder = useMemo(() => order, [order]);

  return (
    <Tabs value={active} onValueChange={setActive} className="w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={renderedOrder} strategy={horizontalListSortingStrategy}>
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            {renderedOrder.map((id) => (
              <SortableTab key={id} id={id} />
            ))}
          </TabsList>
        </SortableContext>
      </DndContext>

      <TabsContent value="dashboard">
        <LojaALojaDashboard campaignId={campaignId} clientId={clientId} />
      </TabsContent>
      <TabsContent value="portal-dashboard">
        <PortalDashboard campaignId={campaignId} clientId={clientId} isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="tipos">
        <TiposManager campaignId={campaignId} isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="lojas">
        <LojasManager campaignId={campaignId} clientId={clientId} isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="portais">
        <PortaisManager campaignId={campaignId} clientId={clientId} isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="config">
        <PortalConfigTab campaignId={campaignId} clientId={clientId} isAdmin={isAdmin} />
      </TabsContent>
    </Tabs>
  );
}
