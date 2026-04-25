import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle2, Package, ImageIcon, Trash2, Replace, PowerOff, Pencil, Play } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import type { ClientStore, CampaignPiece, CampaignKit } from "@/hooks/useMultiClientData";
import type { AutomationTemplate, AutomationGroupItem, AutomationTemplateItem } from "@/hooks/useAutomationTemplates";

type CustomFieldDef = { key: string; label: string; index: number };

interface ItemIssue {
  itemIndex: number;
  item: AutomationTemplateItem;
  kind: "piece_deleted" | "kit_deleted" | "kit_no_components";
  message: string;
}

interface FilterIssue {
  kind: "custom_field_removed" | "base_field_invalid";
  message: string;
}

export interface TemplateValidation {
  templateId: string;
  groupItemId: string;
  templateName: string;
  enabled: boolean;
  itemIssues: ItemIssue[];
  filterIssues: FilterIssue[];
  matchingStoreCount: number;
  hasIssues: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  validations: TemplateValidation[];
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  templates: AutomationTemplate[];
  onReplaceItem: (templateId: string, itemIndex: number, newItem: AutomationTemplateItem) => Promise<void>;
  onRemoveItemFromTemplate: (templateId: string, itemIndex: number) => Promise<void>;
  onToggleGroupItem: (groupItemId: string, enabled: boolean) => Promise<void>;
  onEditTemplate: (templateId: string) => void;
  onConfirmRun: () => void;
}

export function GroupRunReviewDialog({
  open, onOpenChange, groupName,
  validations, pieces, kits, templates,
  onReplaceItem, onRemoveItemFromTemplate, onToggleGroupItem, onEditTemplate, onConfirmRun,
}: Props) {
  const enabledValidations = validations.filter(v => v.enabled);
  const okCount = enabledValidations.filter(v => !v.hasIssues).length;
  const issueCount = enabledValidations.filter(v => v.hasIssues).length;

  const allClear = issueCount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" />
            Revisar grupo: {groupName}
          </DialogTitle>
          <DialogDescription>
            Verificamos cada automação habilitada antes de executar. Corrija os problemas abaixo ou ignore para continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 px-1 py-2 border-y">
          <Badge variant="outline" className="gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> {okCount} sem problemas
          </Badge>
          <Badge variant="outline" className={`gap-1.5 ${issueCount > 0 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" : ""}`}>
            <AlertTriangle className="w-3.5 h-3.5" /> {issueCount} com problemas
          </Badge>
          {validations.length - enabledValidations.length > 0 && (
            <Badge variant="outline" className="gap-1.5 opacity-70">
              <PowerOff className="w-3.5 h-3.5" /> {validations.length - enabledValidations.length} desativadas
            </Badge>
          )}
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-3 py-2">
            {validations.map((v) => (
              <TemplateValidationCard
                key={v.groupItemId}
                validation={v}
                pieces={pieces}
                kits={kits}
                onReplaceItem={onReplaceItem}
                onRemoveItemFromTemplate={onRemoveItemFromTemplate}
                onToggleGroupItem={onToggleGroupItem}
                onEditTemplate={onEditTemplate}
              />
            ))}
            {validations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma automação habilitada neste grupo.
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirmRun}
            disabled={enabledValidations.length === 0}
            variant={allClear ? "default" : "destructive"}
          >
            {allClear
              ? <><Play className="w-4 h-4 mr-1.5" /> Executar grupo</>
              : <><AlertTriangle className="w-4 h-4 mr-1.5" /> Executar mesmo com problemas</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Single template card ────────────────────────────────── */

function TemplateValidationCard({
  validation, pieces, kits,
  onReplaceItem, onRemoveItemFromTemplate, onToggleGroupItem, onEditTemplate,
}: {
  validation: TemplateValidation;
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  onReplaceItem: (templateId: string, itemIndex: number, newItem: AutomationTemplateItem) => Promise<void>;
  onRemoveItemFromTemplate: (templateId: string, itemIndex: number) => Promise<void>;
  onToggleGroupItem: (groupItemId: string, enabled: boolean) => Promise<void>;
  onEditTemplate: (templateId: string) => void;
}) {
  const { hasIssues, enabled } = validation;
  const stateClass = !enabled
    ? "border-border opacity-60"
    : hasIssues
    ? "border-amber-500/40 bg-amber-500/5"
    : "border-green-500/30 bg-green-500/5";

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${stateClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {hasIssues
            ? <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            : <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          }
          <div className="min-w-0 flex-1">
            <p className={`font-medium text-sm truncate ${!enabled ? "line-through" : ""}`}>
              {validation.templateName}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {validation.matchingStoreCount} {validation.matchingStoreCount === 1 ? "loja" : "lojas"} correspondem ao filtro
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {enabled && (
            <Button
              size="sm" variant="ghost" className="h-7 text-xs gap-1"
              onClick={() => onToggleGroupItem(validation.groupItemId, false)}
              title="Desativar esta automação no grupo"
            >
              <PowerOff className="w-3.5 h-3.5" /> Desativar
            </Button>
          )}
          {!enabled && (
            <Button
              size="sm" variant="ghost" className="h-7 text-xs gap-1"
              onClick={() => onToggleGroupItem(validation.groupItemId, true)}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Reativar
            </Button>
          )}
          <Button
            size="sm" variant="ghost" className="h-7 text-xs gap-1"
            onClick={() => onEditTemplate(validation.templateId)}
          >
            <Pencil className="w-3.5 h-3.5" /> Editar
          </Button>
        </div>
      </div>

      {/* Filter issues */}
      {validation.filterIssues.length > 0 && (
        <div className="space-y-1 ml-6">
          {validation.filterIssues.map((fi, i) => (
            <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
              ⚠ {fi.message}
            </p>
          ))}
        </div>
      )}

      {/* Item issues */}
      {validation.itemIssues.length > 0 && (
        <div className="space-y-1.5 ml-6">
          {validation.itemIssues.map((ii) => (
            <ItemIssueRow
              key={ii.itemIndex}
              issue={ii}
              templateId={validation.templateId}
              pieces={pieces}
              kits={kits}
              onReplaceItem={onReplaceItem}
              onRemoveItemFromTemplate={onRemoveItemFromTemplate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Single problematic item with actions ────────────────── */

function ItemIssueRow({
  issue, templateId, pieces, kits,
  onReplaceItem, onRemoveItemFromTemplate,
}: {
  issue: ItemIssue;
  templateId: string;
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  onReplaceItem: (templateId: string, itemIndex: number, newItem: AutomationTemplateItem) => Promise<void>;
  onRemoveItemFromTemplate: (templateId: string, itemIndex: number) => Promise<void>;
}) {
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-amber-500/30 bg-background">
      <div className="flex items-center gap-2 min-w-0">
        {issue.item.type === "kit"
          ? <Package className="w-3.5 h-3.5 text-primary shrink-0" />
          : <ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        }
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{issue.item.name} <span className="text-muted-foreground">× {issue.item.quantity}</span></p>
          <p className="text-[10px] text-amber-700 dark:text-amber-400">{issue.message}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Popover open={replaceOpen} onOpenChange={setReplaceOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={busy}>
              <Replace className="w-3 h-3" /> Substituir
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <ItemPicker
              pieces={pieces}
              kits={kits}
              onPick={async (newItem) => {
                setReplaceOpen(false);
                setBusy(true);
                try {
                  await onReplaceItem(templateId, issue.itemIndex, { ...newItem, quantity: issue.item.quantity });
                } finally {
                  setBusy(false);
                }
              }}
            />
          </PopoverContent>
        </Popover>
        <Button
          size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onRemoveItemFromTemplate(templateId, issue.itemIndex);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Trash2 className="w-3 h-3" /> Remover
        </Button>
      </div>
    </div>
  );
}

/* ─── Item picker (popover content) ───────────────────────── */

function ItemPicker({
  pieces, kits, onPick,
}: {
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  onPick: (item: AutomationTemplateItem) => void;
}) {
  const [search, setSearch] = useState("");

  const all = useMemo(() => {
    const list: AutomationTemplateItem[] = [
      ...pieces.map(p => ({ id: p.id, type: "piece" as const, code: p.code, name: p.name, quantity: 1 })),
      ...kits.map(k => ({ id: k.id, type: "kit" as const, code: k.code, name: k.name, quantity: 1 })),
    ];
    const s = search.toLowerCase();
    return list.filter(i => !s || i.name.toLowerCase().includes(s) || String(i.code).includes(s)).slice(0, 30);
  }, [pieces, kits, search]);

  return (
    <div className="flex flex-col">
      <div className="p-2 border-b">
        <Input
          autoFocus
          placeholder="Buscar peça ou kit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <ScrollArea className="max-h-64">
        <div className="p-1">
          {all.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum item encontrado</p>
          ) : (
            all.map(it => (
              <button
                key={`${it.type}-${it.id}`}
                onClick={() => onPick(it)}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent rounded flex items-center gap-2"
              >
                {it.type === "kit"
                  ? <Package className="w-3 h-3 text-primary shrink-0" />
                  : <ImageIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                }
                <span className="font-mono text-muted-foreground">{it.code}</span>
                <span className="truncate flex-1">{it.name}</span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ─── Validation builder (exported helper) ────────────────── */

export interface BuildValidationsArgs {
  groupItems: AutomationGroupItem[];
  templates: AutomationTemplate[];
  pieces: CampaignPiece[];
  kits: CampaignKit[];
  kitPieces: { kit_id: string; piece_id: string; quantity: number }[];
  stores: ClientStore[];
  customFieldLabels: CustomFieldDef[];
  numericFieldKeys: string[];
  filterStores: (stores: ClientStore[], filterValue: string, filterField: string) => ClientStore[];
}

export function buildValidations(args: BuildValidationsArgs): TemplateValidation[] {
  const { groupItems, templates, pieces, kits, kitPieces, stores, customFieldLabels, numericFieldKeys, filterStores } = args;
  const pieceById = new Map(pieces.map(p => [p.id, p]));
  const kitById = new Map(kits.map(k => [k.id, k]));
  const kitsWithComponents = new Set(kitPieces.map(kp => kp.kit_id));
  const customFieldKeys = new Set(customFieldLabels.map(c => c.key));

  return groupItems.map(gi => {
    const tpl = templates.find(t => t.id === gi.template_id);
    if (!tpl) {
      return {
        templateId: gi.template_id,
        groupItemId: gi.id,
        templateName: "(Automação removida)",
        enabled: gi.enabled,
        itemIssues: [],
        filterIssues: [{ kind: "custom_field_removed", message: "Esta automação foi excluída." }],
        matchingStoreCount: 0,
        hasIssues: true,
      };
    }

    const itemIssues: ItemIssue[] = [];
    tpl.items.forEach((item, idx) => {
      if (item.type === "piece") {
        if (!pieceById.has(item.id)) {
          itemIssues.push({
            itemIndex: idx, item,
            kind: "piece_deleted",
            message: "Peça apagada do cadastro — substitua ou remova.",
          });
        }
      } else {
        if (!kitById.has(item.id)) {
          itemIssues.push({
            itemIndex: idx, item,
            kind: "kit_deleted",
            message: "Kit apagado do cadastro — substitua ou remova.",
          });
        } else if (!kitsWithComponents.has(item.id)) {
          itemIssues.push({
            itemIndex: idx, item,
            kind: "kit_no_components",
            message: "Kit não tem peças — adicione componentes ou substitua.",
          });
        }
      }
    });

    const filterIssues: FilterIssue[] = [];
    // Validate custom field references in filters
    if (tpl.filter_field === "__multi_v2__") {
      try {
        const parsed = JSON.parse(tpl.filter_value);
        const filtros = parsed.filtros || [];
        for (const f of filtros) {
          if (f.campo && f.campo.startsWith("custom_field_") && !customFieldKeys.has(f.campo)) {
            filterIssues.push({
              kind: "custom_field_removed",
              message: `Campo customizado "${f.campo}" foi removido do cliente.`,
            });
          }
        }
      } catch {
        filterIssues.push({ kind: "custom_field_removed", message: "Filtro inválido (JSON corrompido)." });
      }
    } else if (tpl.filter_field?.startsWith("custom_field_") && !customFieldKeys.has(tpl.filter_field)) {
      filterIssues.push({
        kind: "custom_field_removed",
        message: `Campo customizado "${tpl.filter_field}" foi removido do cliente.`,
      });
    }

    // Validate base_field for by_field mode
    if (tpl.kind === "by_field") {
      if (!tpl.base_field) {
        filterIssues.push({ kind: "base_field_invalid", message: "Modo 'multiplicar por campo' sem campo base definido." });
      } else if (!numericFieldKeys.includes(tpl.base_field)) {
        filterIssues.push({
          kind: "base_field_invalid",
          message: `Campo base "${tpl.base_field}" não está mais disponível como campo numérico.`,
        });
      }
    }

    let matchingStoreCount = 0;
    try {
      matchingStoreCount = filterStores(stores, tpl.filter_value, tpl.filter_field).length;
    } catch {
      matchingStoreCount = 0;
    }

    const hasIssues = itemIssues.length > 0 || filterIssues.length > 0;
    return {
      templateId: tpl.id,
      groupItemId: gi.id,
      templateName: tpl.name,
      enabled: gi.enabled,
      itemIssues,
      filterIssues,
      matchingStoreCount,
      hasIssues,
    };
  });
}
