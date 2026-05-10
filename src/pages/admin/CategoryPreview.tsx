/**
 * CategoryPreview — read-only visual map of what a category authorises.
 *
 * Static page (no fake login, no RLS override). Pulls from `permission_grants`.
 */
import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCategoryGrants } from "@/hooks/usePermissionGrants";
import { PERMISSION_MODULES, CATEGORY_COLORS } from "@/lib/permissionRegistry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Check, X, Eye, Pencil, Trash2, Share2, Edit, Sparkles, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function PermissionChip({
  granted, label, icon: Icon,
}: { granted: boolean; label: string; icon?: React.ElementType }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
        granted
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          : "bg-muted text-muted-foreground line-through opacity-60",
      )}
    >
      {Icon ? <Icon className="w-3 h-3" /> : granted ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {label}
    </div>
  );
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  view: Eye, edit: Pencil, delete: Trash2,
};
const ACTION_LABEL: Record<string, string> = {
  view: "Ver", edit: "Editar", delete: "Apagar",
};

export default function CategoryPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: category, isLoading: loadingCat } = useQuery({
    queryKey: ["permission_category", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permission_categories")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: grants = [], isLoading: loadingGrants } = useCategoryGrants(id);

  const grantSet = useMemo(() => {
    const s = new Set<string>();
    grants.forEach(g => { if (g.granted) s.add(`${g.module_key}::${g.action}`); });
    return s;
  }, [grants]);

  const hasGrant = (mk: string, a: string) => grantSet.has(`${mk}::${a}`);

  const stats = useMemo(() => {
    let modulesWithAccess = 0, actions = 0, special = 0;
    PERMISSION_MODULES.forEach(m => {
      const any = m.actions.some(a => hasGrant(m.key, a))
        || (m.subModules?.some(s => s.actions.some(a => hasGrant(s.key, a))) ?? false);
      if (any) modulesWithAccess++;
      m.actions.forEach(a => { if (hasGrant(m.key, a)) actions++; });
      m.specialActions?.forEach(sp => { if (hasGrant(m.key, `special:${sp.key}`)) special++; });
      m.subModules?.forEach(s => s.actions.forEach(a => { if (hasGrant(s.key, a)) actions++; }));
    });
    return { modulesWithAccess, actions, special };
  }, [grantSet]);

  const colorMeta = CATEGORY_COLORS.find(c => c.key === category?.color) || CATEGORY_COLORS[1];

  const shareUrl = () => {
    navigator.clipboard?.writeText(window.location.href);
    toast.success("URL copiada");
  };

  if (loadingCat || loadingGrants) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Categoria não encontrada</p>
          <Button onClick={() => navigate("/admin?tab=categories")}>Voltar</Button>
        </div>
      </div>
    );
  }

  const renderModuleCard = (module: typeof PERMISSION_MODULES[number]) => {
    const moduleHasAny =
      module.actions.some(a => hasGrant(module.key, a)) ||
      (module.specialActions?.some(sp => hasGrant(module.key, `special:${sp.key}`)) ?? false) ||
      (module.subModules?.some(s => s.actions.some(a => hasGrant(s.key, a))) ?? false);

    return (
      <div
        key={module.key}
        className={cn(
          "border rounded-lg p-4 bg-card transition-opacity",
          !moduleHasAny && "opacity-60",
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="font-semibold text-sm text-foreground">{module.label}</div>
          {!moduleHasAny && <Badge variant="secondary" className="text-[10px]">Sem acesso</Badge>}
        </div>
        {module.description && (
          <div className="text-xs text-muted-foreground mb-3">{module.description}</div>
        )}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {module.actions.map(a => (
            <PermissionChip
              key={a}
              granted={hasGrant(module.key, a)}
              label={ACTION_LABEL[a] || a}
              icon={ACTION_ICONS[a]}
            />
          ))}
          {module.specialActions?.map(sp => (
            <PermissionChip
              key={sp.key}
              granted={hasGrant(module.key, `special:${sp.key}`)}
              label={sp.label}
              icon={Sparkles}
            />
          ))}
        </div>
        {module.subModules && module.subModules.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            {module.subModules.map(sub => (
              <div key={sub.key} className="flex items-center gap-2 text-xs">
                <div className="flex-1 truncate text-muted-foreground">{sub.label}</div>
                {sub.actions.map(a => (
                  <span
                    key={a}
                    className={cn(
                      "w-5 h-5 rounded flex items-center justify-center",
                      hasGrant(sub.key, a)
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground/40",
                    )}
                  >
                    {a === "view" && <Eye className="w-3 h-3" />}
                    {a === "edit" && <Pencil className="w-3 h-3" />}
                    {a === "delete" && <Trash2 className="w-3 h-3" />}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const campaignMods = PERMISSION_MODULES.filter(m => m.category === "campaign");
  const crossMods = PERMISSION_MODULES.filter(m => m.category === "cross_cutting");
  const adminMods = PERMISSION_MODULES.filter(m => m.category === "admin");
  const adminHasAny = adminMods.some(m => m.actions.some(a => hasGrant(m.key, a)));

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
          </Button>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className={cn("w-3 h-3 rounded-full", colorMeta.class)} />
            <h1 className="font-semibold text-base">Preview: {category.name}</h1>
            {category.is_system && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={shareUrl}>
              <Share2 className="w-3.5 h-3.5 mr-1.5" /> Compartilhar URL
            </Button>
            <Button size="sm" onClick={() => navigate(`/admin?tab=categories&edit=${category.id}`)}>
              <Edit className="w-3.5 h-3.5 mr-1.5" /> Editar categoria
            </Button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-3 text-xs text-muted-foreground">
          Visualização das permissões — esta tela mostra o que esta categoria autoriza no sistema
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-6">
          {/* Hero */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start gap-4">
              <div className={cn("w-12 h-12 rounded-lg shrink-0", colorMeta.class)} />
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-foreground">{category.name}</h2>
                {category.description && (
                  <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                  <span><strong className="text-foreground">{stats.modulesWithAccess}</strong> módulos com acesso</span>
                  <span>·</span>
                  <span><strong className="text-foreground">{stats.actions}</strong> ações permitidas</span>
                  <span>·</span>
                  <span><strong className="text-foreground">{stats.special}</strong> recursos avançados</span>
                </div>
                {category.created_at && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Criada em {format(new Date(category.created_at), "dd MMM yyyy", { locale: ptBR })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sections */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Módulos da campanha
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {campaignMods.map(renderModuleCard)}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Módulos transversais
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {crossMods.map(renderModuleCard)}
            </div>
          </section>

          {adminHasAny && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Administração
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {adminMods.map(renderModuleCard)}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar preview */}
        <aside className="lg:sticky lg:top-24 self-start">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Como aparece a sidebar
            </div>
            <div className="space-y-1">
              <SidebarRow label="Início" active />
              {hasGrant("clients", "view") && <SidebarRow label="Agências" active />}
              <SidebarRow label="Favoritos" active />
              <div className="h-px bg-border my-2" />
              {PERMISSION_MODULES.filter(m => m.category === "campaign").map(m => {
                const v = hasGrant(m.key, "view")
                  || (m.subModules?.some(s => hasGrant(s.key, "view")) ?? false);
                return <SidebarRow key={m.key} label={m.label} active={v} />;
              })}
            </div>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground px-1">
            Itens em cinza não aparecem para usuários desta categoria.
          </div>
        </aside>
      </main>
    </div>
  );
}

function SidebarRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm",
        active ? "text-foreground" : "text-muted-foreground/50 line-through",
      )}
    >
      <div className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-emerald-500" : "bg-muted-foreground/30")} />
      {label}
    </div>
  );
}
