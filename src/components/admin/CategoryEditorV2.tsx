/**
 * CategoryEditorV2 — new permission category editor.
 *
 * Writes ONLY to `permission_grants` (Phase 2). Legacy boolean columns are
 * untouched. Old CategoryManager continues to coexist.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search, ChevronDown, ChevronRight, Eye, Pencil, Trash2, Lock,
  Users, Save, AlertTriangle, Sparkles, Loader2, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  PERMISSION_MODULES, PERMISSION_PRESETS, CATEGORY_COLORS,
  type PermissionModule,
} from "@/lib/permissionRegistry";
import {
  useCategoryGrants, useToggleGrant, useBulkSetGrants, useUserCountByCategory,
} from "@/hooks/usePermissionGrants";
import {
  useAddPermissionCategory, useUpdatePermissionCategory,
  type PermissionCategory,
} from "@/hooks/usePermissionCategories";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Partial<PermissionCategory> | null; // null = create new
}

const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string; hint: string }> = {
  view:   { label: "Visualizar", icon: Eye,    color: "bg-emerald-500 hover:bg-emerald-600",  hint: "Permite ver mas não editar" },
  edit:   { label: "Editar",     icon: Pencil, color: "bg-amber-500 hover:bg-amber-600",      hint: "Criar e modificar registros" },
  delete: { label: "Apagar",     icon: Trash2, color: "bg-red-500 hover:bg-red-600",          hint: "Remoção permanente — cuidado" },
};

function ActionToggle({
  action, active, disabled, onToggle,
}: {
  action: string; active: boolean; disabled?: boolean;
  onToggle: () => void;
}) {
  const meta = ACTION_META[action];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={cn(
              "h-8 w-8 rounded-md flex items-center justify-center transition-colors shrink-0",
              active ? `${meta.color} text-white` : "bg-muted text-muted-foreground opacity-60 hover:opacity-100",
              disabled && "cursor-not-allowed opacity-40 hover:opacity-40",
            )}
          >
            <Icon className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{meta.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ModuleCardProps {
  module: PermissionModule;
  hasGrant: (moduleKey: string, action: string) => boolean;
  onToggle: (moduleKey: string, action: string, granted: boolean) => void;
  disabled: boolean;
  query: string;
}

function ModuleCard({ module, hasGrant, onToggle, disabled, query }: ModuleCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Filter by search
  const matchesSearch = useMemo(() => {
    if (!query) return true;
    const q = query.toLowerCase();
    if (module.label.toLowerCase().includes(q)) return true;
    if (module.description?.toLowerCase().includes(q)) return true;
    if (module.specialActions?.some(s => s.label.toLowerCase().includes(q))) return true;
    if (module.subModules?.some(s => s.label.toLowerCase().includes(q))) return true;
    return false;
  }, [query, module]);

  if (!matchesSearch) return null;

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(e => !e)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded(x => !x); }}
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-foreground truncate">{module.label}</div>
          {module.description && (
            <div className="text-xs text-muted-foreground truncate">{module.description}</div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {module.actions.map(action => (
            <ActionToggle
              key={action}
              action={action}
              active={hasGrant(module.key, action)}
              disabled={disabled}
              onToggle={() => onToggle(module.key, action, !hasGrant(module.key, action))}
            />
          ))}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 p-4 space-y-4">
          <div className="space-y-2">
            {module.actions.map(action => {
              const meta = ACTION_META[action];
              if (!meta) return null;
              const granted = hasGrant(module.key, action);
              return (
                <label
                  key={action}
                  className="flex items-start gap-3 p-2 rounded-md hover:bg-background cursor-pointer"
                >
                  <Switch
                    checked={granted}
                    disabled={disabled}
                    onCheckedChange={(v) => onToggle(module.key, action, v)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{meta.label} {module.label.toLowerCase()}</div>
                    <div className="text-xs text-muted-foreground">{meta.hint}</div>
                  </div>
                </label>
              );
            })}
          </div>

          {module.specialActions && module.specialActions.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Recursos avançados
              </div>
              <div className="space-y-2">
                {module.specialActions.map(sp => {
                  const actionKey = `special:${sp.key}`;
                  const granted = hasGrant(module.key, actionKey);
                  return (
                    <label key={sp.key} className="flex items-start gap-3 p-2 rounded-md hover:bg-background cursor-pointer">
                      <Switch
                        checked={granted}
                        disabled={disabled}
                        onCheckedChange={(v) => onToggle(module.key, actionKey, v)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{sp.label}</div>
                        {sp.description && <div className="text-xs text-muted-foreground">{sp.description}</div>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {module.subModules && module.subModules.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Sub-áreas
              </div>
              <div className="space-y-1.5">
                {module.subModules.map(sub => (
                  <div key={sub.key} className="flex items-center gap-3 p-2 rounded-md bg-background border border-border">
                    <div className="flex-1 text-sm">{sub.label}</div>
                    <div className="flex items-center gap-1.5">
                      {sub.actions.map(action => (
                        <ActionToggle
                          key={action}
                          action={action}
                          active={hasGrant(sub.key, action)}
                          disabled={disabled}
                          onToggle={() => onToggle(sub.key, action, !hasGrant(sub.key, action))}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CategoryEditorV2({ open, onOpenChange, category }: Props) {
  const isEdit = !!category?.id;
  const isSystem = !!category?.is_system;

  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [color, setColor] = useState(category?.color || "blue");
  const [query, setQuery] = useState("");
  const [pendingPreset, setPendingPreset] = useState<keyof typeof PERMISSION_PRESETS | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (open) {
      setName(category?.name || "");
      setDescription(category?.description || "");
      setColor(category?.color || "blue");
      setQuery("");
      setSaveState('idle');
    }
  }, [open, category?.id, category?.name, category?.description, category?.color]);

  const { data: grants = [] } = useCategoryGrants(category?.id);
  const { data: userCount = 0 } = useUserCountByCategory(category?.id);
  const toggleGrant = useToggleGrant();
  const bulkSet = useBulkSetGrants();
  const addCat = useAddPermissionCategory();
  const updateCat = useUpdatePermissionCategory();

  const grantSet = useMemo(() => {
    const s = new Set<string>();
    grants.forEach(g => { if (g.granted) s.add(`${g.module_key}::${g.action}`); });
    return s;
  }, [grants]);

  const hasGrant = (moduleKey: string, action: string) => grantSet.has(`${moduleKey}::${action}`);

  const handleToggle = (moduleKey: string, action: string, granted: boolean) => {
    if (!category?.id) {
      toast.error("Salve a categoria primeiro para configurar permissões");
      return;
    }
    toggleGrant.mutate({ categoryId: category.id, moduleKey, action, granted });
  };

  const handleSaveMeta = async () => {
    if (!name.trim()) { toast.error("Informe um nome"); return; }
    setSaveState('saving');
    try {
      if (isEdit && category?.id) {
        await updateCat.mutateAsync({
          id: category.id,
          name: name.trim(),
          description: description.trim() || null,
          color,
        } as never);
      } else {
        await addCat.mutateAsync({
          name: name.trim(),
          description: description.trim() || null,
          color,
        } as never);
      }
      setSaveState('saved');
      setTimeout(() => {
        setSaveState('idle');
        onOpenChange(false);
      }, 2000);
    } catch (e) {
      setSaveState('idle');
      toast.error("Erro ao salvar");
    }
  };

  const applyPreset = (key: keyof typeof PERMISSION_PRESETS) => {
    if (!category?.id) { toast.error("Salve a categoria primeiro"); return; }
    const preset = PERMISSION_PRESETS[key];
    bulkSet.mutate({
      categoryId: category.id,
      grants: preset.grants,
      clearOthers: true,
    });
    setPendingPreset(null);
  };

  const sectionTitle = (label: string) => (
    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-6 mb-2 px-1">
      {label}
    </div>
  );

  const renderSection = (sectionKey: "campaign" | "cross_cutting" | "admin") => {
    const mods = PERMISSION_MODULES.filter(m => m.category === sectionKey);
    return mods.map(m => (
      <ModuleCard
        key={m.key}
        module={m}
        hasGrant={hasGrant}
        onToggle={handleToggle}
        disabled={isSystem}
        query={query}
      />
    ));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
          <SheetTitle className="flex items-center gap-2">
            {isSystem && <Lock className="w-4 h-4 text-muted-foreground" />}
            {isEdit ? "Editar categoria" : "Nova categoria"}
          </SheetTitle>
          {isSystem && (
            <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Categoria do sistema — não pode ser modificada
            </div>
          )}
        </SheetHeader>

        <div className="p-6 space-y-5">
          {/* Color selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">Cor</label>
            <div className="flex items-center gap-2">
              {CATEGORY_COLORS.map(c => (
                <button
                  key={c.key}
                  type="button"
                  disabled={isSystem}
                  onClick={() => setColor(c.key)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all",
                    c.class,
                    color === c.key ? "ring-2 ring-offset-2 ring-foreground scale-110" : "opacity-70 hover:opacity-100",
                    isSystem && "cursor-not-allowed opacity-50",
                  )}
                  aria-label={c.label}
                />
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Nome</label>
            <Input
              value={name}
              disabled={isSystem}
              onChange={(e) => setName(e.target.value)}
              className="h-10 text-base"
              placeholder="Ex: Editor de Campanhas"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Descrição (opcional)</label>
            <Textarea
              value={description}
              disabled={isSystem}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="O que esta categoria autoriza?"
            />
          </div>

          {/* Usage + save meta */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              {userCount} {userCount === 1 ? "usuário" : "usuários"} usam esta categoria
            </div>
            <Button size="sm" onClick={handleSaveMeta} disabled={isSystem || !name.trim()}>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {isEdit ? "Salvar dados" : "Criar"}
            </Button>
          </div>

          {/* Presets */}
          {isEdit && !isSystem && (
            <div className="pt-4 border-t border-border">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Atalhos rápidos
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PERMISSION_PRESETS).map(([key, p]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingPreset(key as keyof typeof PERMISSION_PRESETS)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          {isEdit && (
            <div className="pt-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar módulo ou permissão..."
                  className="pl-9 h-9"
                />
              </div>
            </div>
          )}

          {/* Modules */}
          {isEdit && (
            <div>
              {sectionTitle("Módulos da campanha")}
              <div className="space-y-2">{renderSection("campaign")}</div>

              {sectionTitle("Módulos transversais")}
              <div className="space-y-2">{renderSection("cross_cutting")}</div>

              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-6 mb-2 px-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Administração
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-2 text-xs text-amber-700 dark:text-amber-400 mb-2">
                Permissões administrativas — conceda apenas a usuários de confiança
              </div>
              <div className="space-y-2">{renderSection("admin")}</div>
            </div>
          )}

          {!isEdit && (
            <div className="text-sm text-muted-foreground italic text-center py-8 border-2 border-dashed border-border rounded-lg">
              Salve a categoria para começar a configurar permissões
            </div>
          )}
        </div>

        <AlertDialog open={!!pendingPreset} onOpenChange={(o) => !o && setPendingPreset(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Aplicar "{pendingPreset && PERMISSION_PRESETS[pendingPreset].label}"?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Isso substitui todas as permissões atuais desta categoria.
                {pendingPreset && (
                  <span className="block mt-2 text-foreground">
                    {PERMISSION_PRESETS[pendingPreset].description}
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => pendingPreset && applyPreset(pendingPreset)}>
                Aplicar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
