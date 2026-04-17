import { useState } from "react";
import {
  usePermissionCategories, useAddPermissionCategory,
  useUpdatePermissionCategory, useDeletePermissionCategory,
  type PermissionCategory,
} from "@/hooks/usePermissionCategories";
import { Plus, Edit3, Trash2, Eye, Pencil, X, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MODULES = [
  { key: "clients", label: "Clientes", icon: "🏢" },
  { key: "campaigns", label: "Campanhas", icon: "📢" },
  { key: "stores", label: "Lojas", icon: "🏪" },
  { key: "campaign_stores", label: "Lojas (Campanhas)", icon: "📍" },
  { key: "pieces", label: "Peças", icon: "🧩" },
  { key: "occurrences", label: "Ocorrências", icon: "📋" },
  { key: "schedules", label: "Agendamento", icon: "📅" },
  { key: "installations", label: "Instalações", icon: "📷" },
] as const;

const PERMISSIONS = [
  { key: "view", label: "Ver", icon: <Eye className="w-3.5 h-3.5" /> },
  { key: "edit", label: "Editar", icon: <Pencil className="w-3.5 h-3.5" /> },
  { key: "delete", label: "Apagar", icon: <X className="w-3.5 h-3.5" /> },
] as const;

type ModuleKey = typeof MODULES[number]["key"];
type PermKey = typeof PERMISSIONS[number]["key"];

const getField = (form: any, perm: PermKey, mod: ModuleKey): boolean => form[`can_${perm}_${mod}`] ?? false;
const setField = (form: any, perm: PermKey, mod: ModuleKey, val: boolean) => ({ ...form, [`can_${perm}_${mod}`]: val });

const LAL_SUBAREAS: ReadonlyArray<{ key: string; label: string; isMaster?: boolean }> = [
  { key: "loja_a_loja", label: "Geral (Master)", isMaster: true },
  { key: "lal_estrutura", label: "Estrutura" },
  { key: "lal_classificacao", label: "Classificação" },
  { key: "lal_acessos", label: "Acessos" },
  { key: "lal_config", label: "Configuração" },
  { key: "lal_ocorrencias", label: "Ocorrências" },
];

type LalKey = string;
const LAL_SUB_KEYS: LalKey[] = ["lal_estrutura", "lal_classificacao", "lal_acessos", "lal_config", "lal_ocorrencias"];
const LAL_ALL_KEYS: string[] = LAL_SUBAREAS.flatMap(s =>
  PERMISSIONS.map(p => `can_${p.key}_${s.key}`)
);

const defaultForm = (): Omit<PermissionCategory, "id" | "created_at"> => ({
  name: "",
  can_view_clients: true, can_edit_clients: false, can_delete_clients: false,
  can_view_campaigns: true, can_edit_campaigns: false, can_delete_campaigns: false,
  can_view_stores: true, can_edit_stores: false, can_delete_stores: false,
  can_view_campaign_stores: true, can_edit_campaign_stores: false, can_delete_campaign_stores: false,
  can_view_pieces: true, can_edit_pieces: false, can_delete_pieces: false,
  can_view_occurrences: true, can_edit_occurrences: false, can_delete_occurrences: false,
  can_view_schedules: true, can_edit_schedules: false, can_delete_schedules: false,
  can_view_installations: true, can_edit_installations: false, can_delete_installations: false,
  can_edit_reporter_data: false,
  can_manage_team_codes: false,
  can_lock_cards: false,
  can_view_photo_checkin: false,
  can_view_loja_a_loja: false,
  can_edit_loja_a_loja: false,
  can_delete_loja_a_loja: false,
  can_view_lal_estrutura: false, can_edit_lal_estrutura: false, can_delete_lal_estrutura: false,
  can_view_lal_classificacao: false, can_edit_lal_classificacao: false, can_delete_lal_classificacao: false,
  can_view_lal_acessos: false, can_edit_lal_acessos: false, can_delete_lal_acessos: false,
  can_view_lal_config: false, can_edit_lal_config: false, can_delete_lal_config: false,
  can_view_lal_ocorrencias: false, can_edit_lal_ocorrencias: false, can_delete_lal_ocorrencias: false,
});

export default function CategoryManager() {
  const { data: categories = [] } = usePermissionCategories();
  const addCategory = useAddPermissionCategory();
  const updateCategory = useUpdatePermissionCategory();
  const deleteCategory = useDeletePermissionCategory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PermissionCategory | null>(null);
  const [form, setForm] = useState(defaultForm());

  const openNew = () => { setEditing(null); setForm(defaultForm()); setDialogOpen(true); };
  const openEdit = (cat: PermissionCategory) => {
    setEditing(cat);
    const { id, created_at, ...rest } = cat;
    setForm(rest);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editing) updateCategory.mutate({ id: editing.id, ...form });
    else addCategory.mutate(form);
    setDialogOpen(false);
  };

  const countPerms = (cat: PermissionCategory) => {
    let count = 0;
    for (const m of MODULES) {
      for (const p of PERMISSIONS) {
        if (getField(cat, p.key, m.key)) count++;
      }
    }
    if (cat.can_edit_reporter_data) count++;
    if (cat.can_manage_team_codes) count++;
    if (cat.can_lock_cards) count++;
    if (cat.can_view_photo_checkin) count++;
    for (const k of LAL_ALL_KEYS) {
      if ((cat as Record<string, unknown>)[k]) count++;
    }
    return count;
  };

  // Module column toggle helpers
  const isModuleColumnAllOn = (perm: PermKey) =>
    MODULES.every(m => getField(form, perm, m.key));
  const setModuleColumn = (perm: PermKey, val: boolean) =>
    setForm(f => {
      const next = { ...f } as Record<string, unknown>;
      for (const m of MODULES) next[`can_${perm}_${m.key}`] = val;
      return next as typeof f;
    });

  // LAL helpers for the sub-matrix
  const isLalCellChecked = (perm: PermKey, sub: LalKey) =>
    !!(form as Record<string, unknown>)[`can_${perm}_${sub}`];
  const setLalCell = (perm: PermKey, sub: LalKey, val: boolean) =>
    setForm(f => ({ ...f, [`can_${perm}_${sub}`]: val } as typeof f));
  const setLalColumn = (perm: PermKey, val: boolean) =>
    setForm(f => {
      const next = { ...f } as Record<string, unknown>;
      for (const s of LAL_SUBAREAS) next[`can_${perm}_${s.key}`] = val;
      return next as typeof f;
    });
  const setLalGeneral = (perm: PermKey, val: boolean) =>
    setForm(f => {
      const next = { ...f, [`can_${perm}_loja_a_loja`]: val } as Record<string, unknown>;
      for (const s of LAL_SUB_KEYS) next[`can_${perm}_${s}`] = val;
      return next as typeof f;
    });
  const isLalColumnAllOn = (perm: PermKey) =>
    LAL_SUBAREAS.every(s => !!(form as Record<string, unknown>)[`can_${perm}_${s.key}`]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-base font-semibold text-foreground">Categorias de Permissão ({categories.length})</h2>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="w-4 h-4" /> Nova Categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Nenhuma categoria criada.</p>
          <p className="text-xs mt-1">Crie categorias como "Editor", "Visualizador" etc.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(cat => (
            <div key={cat.id} className="border border-border rounded-xl p-4 bg-card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground text-base">{cat.name}</h3>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEdit(cat)}>
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir "{cat.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>Usuários com esta categoria perderão suas permissões.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCategory.mutate(cat.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Visual matrix */}
              <div className="space-y-1.5">
                {MODULES.map(m => {
                  const hasView = getField(cat, "view", m.key);
                  const hasEdit = getField(cat, "edit", m.key);
                  const hasDelete = getField(cat, "delete", m.key);
                  if (!hasView && !hasEdit && !hasDelete) return null;
                  return (
                    <div key={m.key} className="flex items-center gap-2">
                      <span className="text-xs w-28 truncate text-muted-foreground">{m.icon} {m.label}</span>
                      <div className="flex gap-1">
                        {hasView && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Ver</span>}
                        {hasEdit && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Editar</span>}
                        {hasDelete && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">Apagar</span>}
                      </div>
                    </div>
                  );
                })}
                {cat.can_edit_reporter_data && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-28 truncate text-muted-foreground">📝 Lojista</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20">Editar</span>
                  </div>
                )}
                {cat.can_manage_team_codes && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-28 truncate text-muted-foreground">🔑 Códigos</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">Gerenciar</span>
                  </div>
                )}
                {cat.can_lock_cards && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-28 truncate text-muted-foreground">🔒 Cards</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 border border-purple-500/20">Bloquear</span>
                  </div>
                )}
                {cat.can_view_photo_checkin && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-28 truncate text-muted-foreground">✅ Check-in</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-700 border border-teal-500/20">Ver</span>
                  </div>
                )}
                {(() => {
                  const lalActive = LAL_ALL_KEYS.some(k => !!(cat as Record<string, unknown>)[k]);
                  if (!lalActive) return null;
                  return (
                    <div className="flex items-start gap-2">
                      <span className="text-xs w-28 truncate text-muted-foreground shrink-0">🏪 Loja a Loja</span>
                      <div className="flex flex-wrap gap-1">
                        {LAL_SUBAREAS.map(s => {
                          const v = !!(cat as Record<string, unknown>)[`can_view_${s.key}`];
                          const e = !!(cat as Record<string, unknown>)[`can_edit_${s.key}`];
                          const d = !!(cat as Record<string, unknown>)[`can_delete_${s.key}`];
                          if (!v && !e && !d) return null;
                          const flags = [v && "V", e && "E", d && "D"].filter(Boolean).join("");
                          return (
                            <span key={s.key} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                              {s.label}: {flags}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <p className="text-[10px] text-muted-foreground mt-3">{countPerms(cat)} permissão(ões) ativas</p>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl w-[95vw] p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
          {/* Sticky Header */}
          <DialogHeader className="px-5 py-4 border-b border-border bg-card shrink-0">
            <DialogTitle className="text-base">
              {editing ? `Editar Categoria${form.name ? ` — ${form.name}` : ""}` : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <TooltipProvider delayDuration={200}>
              <Accordion type="multiple" defaultValue={["info", "modules", "advanced", "lal"]} className="space-y-3">
                {/* 1. Information */}
                <AccordionItem value="info" className="border border-border rounded-lg px-3 [&[data-state=open]]:bg-muted/10">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                    Informações
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome da categoria</label>
                    <Input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Editor, Visualizador, Equipe de Campo"
                      className="h-10"
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* 2. Main modules */}
                <AccordionItem value="modules" className="border border-border rounded-lg px-3 [&[data-state=open]]:bg-muted/10">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                    Módulos principais
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    {/* Desktop table */}
                    <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-card">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-muted/40">
                            <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Módulo</th>
                            {PERMISSIONS.map(p => {
                              const allOn = isModuleColumnAllOn(p.key);
                              return (
                                <th key={p.key} className="text-center text-xs font-medium text-muted-foreground px-2 py-2 w-24">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() => setModuleColumn(p.key, !allOn)}
                                        className="inline-flex items-center justify-center gap-1 mx-auto px-2 py-1 rounded hover:bg-background hover:text-foreground transition-colors"
                                      >
                                        {allOn ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                                        {p.icon} {p.label}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Marcar/desmarcar tudo: {p.label}</TooltipContent>
                                  </Tooltip>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {MODULES.map((m, i) => (
                            <tr key={m.key} className={i % 2 === 0 ? "bg-card" : "bg-muted/10"}>
                              <td className="text-sm font-medium px-3 py-2.5">{m.icon} {m.label}</td>
                              {PERMISSIONS.map(p => (
                                <td key={p.key} className="text-center px-2 py-2.5">
                                  <Checkbox
                                    className="h-5 w-5"
                                    checked={getField(form, p.key, m.key)}
                                    onCheckedChange={checked => setForm(f => setField(f, p.key, m.key, !!checked))}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile list */}
                    <div className="md:hidden space-y-2">
                      {MODULES.map(m => (
                        <div key={m.key} className="border border-border rounded-lg p-3 bg-card">
                          <div className="text-sm font-medium text-foreground mb-2">{m.icon} {m.label}</div>
                          <div className="grid grid-cols-3 gap-2">
                            {PERMISSIONS.map(p => {
                              const checked = getField(form, p.key, m.key);
                              return (
                                <label
                                  key={p.key}
                                  className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-md border cursor-pointer transition-colors min-h-[40px] ${
                                    checked ? "bg-primary/10 border-primary/40 text-primary" : "bg-muted/20 border-border text-muted-foreground"
                                  }`}
                                >
                                  <Checkbox
                                    className="h-4 w-4"
                                    checked={checked}
                                    onCheckedChange={c => setForm(f => setField(f, p.key, m.key, !!c))}
                                  />
                                  <span className="text-xs font-medium">{p.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 3. Advanced permissions */}
                <AccordionItem value="advanced" className="border border-border rounded-lg px-3 [&[data-state=open]]:bg-muted/10">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                    Permissões avançadas
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="grid gap-2 md:grid-cols-2">
                      {[
                        { k: "can_edit_reporter_data" as const, label: "📝 Editar Dados do Lojista (Ocorrências)" },
                        { k: "can_manage_team_codes" as const, label: "🔑 Gerenciar Códigos de Acesso Temporário" },
                        { k: "can_lock_cards" as const, label: "🔒 Bloquear/Desbloquear Cards" },
                        { k: "can_view_photo_checkin" as const, label: "✅ Ver Check-in de Fotos" },
                      ].map(item => {
                        const checked = !!(form as Record<string, unknown>)[item.k];
                        return (
                          <label
                            key={item.k}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors min-h-[48px] ${
                              checked ? "bg-primary/5 border-primary/30" : "bg-card border-border hover:bg-muted/20"
                            }`}
                          >
                            <Checkbox
                              className="h-5 w-5"
                              checked={checked}
                              onCheckedChange={c => setForm(f => ({ ...f, [item.k]: !!c }))}
                            />
                            <span className="text-sm font-medium leading-tight">{item.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 4. Loja a Loja */}
                <AccordionItem value="lal" className="border border-border rounded-lg px-3 [&[data-state=open]]:bg-muted/10">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                    🏪 Loja a Loja
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    {/* Desktop table */}
                    <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-card">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-muted/40">
                            <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Sub-área</th>
                            {PERMISSIONS.map(p => {
                              const allOn = isLalColumnAllOn(p.key);
                              return (
                                <th key={p.key} className="text-center text-xs font-medium text-muted-foreground px-2 py-2 w-24">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() => setLalColumn(p.key, !allOn)}
                                        className="inline-flex items-center justify-center gap-1 mx-auto px-2 py-1 rounded hover:bg-background hover:text-foreground transition-colors"
                                      >
                                        {allOn ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                                        {p.icon} {p.label}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Marcar/desmarcar tudo: {p.label}</TooltipContent>
                                  </Tooltip>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {LAL_SUBAREAS.map((s, i) => (
                            <tr key={s.key} className={i % 2 === 0 ? "bg-card" : "bg-muted/10"}>
                              <td className="text-sm font-medium px-3 py-2.5">
                                {s.label}
                                {s.isMaster && <span className="ml-1 text-[10px] text-muted-foreground">(controla todas)</span>}
                              </td>
                              {PERMISSIONS.map(p => (
                                <td key={p.key} className="text-center px-2 py-2.5">
                                  <Checkbox
                                    className="h-5 w-5"
                                    checked={isLalCellChecked(p.key, s.key)}
                                    onCheckedChange={checked => {
                                      if (s.isMaster) setLalGeneral(p.key, !!checked);
                                      else setLalCell(p.key, s.key, !!checked);
                                    }}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile list */}
                    <div className="md:hidden space-y-2">
                      {LAL_SUBAREAS.map(s => (
                        <div key={s.key} className={`border rounded-lg p-3 ${s.isMaster ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
                          <div className="text-sm font-medium text-foreground mb-2">
                            {s.label}
                            {s.isMaster && <span className="ml-1 text-[10px] text-muted-foreground font-normal">(controla todas)</span>}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {PERMISSIONS.map(p => {
                              const checked = isLalCellChecked(p.key, s.key);
                              return (
                                <label
                                  key={p.key}
                                  className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-md border cursor-pointer transition-colors min-h-[40px] ${
                                    checked ? "bg-primary/10 border-primary/40 text-primary" : "bg-muted/20 border-border text-muted-foreground"
                                  }`}
                                >
                                  <Checkbox
                                    className="h-4 w-4"
                                    checked={checked}
                                    onCheckedChange={c => {
                                      if (s.isMaster) setLalGeneral(p.key, !!c);
                                      else setLalCell(p.key, s.key, !!c);
                                    }}
                                  />
                                  <span className="text-xs font-medium">{p.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TooltipProvider>
          </div>

          {/* Sticky Footer */}
          <div className="px-5 py-3 border-t border-border bg-card shrink-0 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || addCategory.isPending || updateCategory.isPending}
            >
              {editing ? "Salvar Alterações" : "Criar Categoria"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
