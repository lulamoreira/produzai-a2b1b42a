import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { normValue, type GroupDef } from "@/lib/storeClusterCost";

export interface StoreClusterGroupEditorProps {
  values: { value: string; count: number }[];
  groups: GroupDef[];
  onChange: (groups: GroupDef[]) => void;
}

/** Cria grupos com nome e marca os valores do campo que entram em cada um. */
export function StoreClusterGroupEditor({ values, groups, onChange }: StoreClusterGroupEditorProps) {
  const owner = (v: string) => groups.findIndex((g) => g.values.some((x) => normValue(x) === normValue(v)));
  const toggle = (gi: number, v: string, on: boolean) => {
    onChange(groups.map((g, i) => {
      const rest = g.values.filter((x) => normValue(x) !== normValue(v));
      if (i === gi) return { ...g, values: on ? [...rest, v] : rest };
      return on ? { ...g, values: rest } : g; // um valor fica em um só grupo
    }));
  };
  return (
    <div className="space-y-3">
      {groups.map((g, gi) => (
        <div key={gi} className="rounded-md border border-border p-2 space-y-2">
          <div className="flex gap-2">
            <Input
              value={g.name}
              aria-label="Nome do grupo"
              placeholder="Nome do grupo"
              onChange={(e) => onChange(groups.map((x, i) => (i === gi ? { ...x, name: e.target.value } : x)))}
            />
            <Button variant="ghost" size="icon" aria-label="Remover grupo" onClick={() => onChange(groups.filter((_, i) => i !== gi))}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 max-h-40 overflow-y-auto" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
            {values.map((v) => {
              const o = owner(v.value);
              const checked = o === gi;
              return (
                <label key={`${gi}-${v.value}`} className={`flex items-center gap-1.5 text-xs py-1 ${o !== -1 && !checked ? "opacity-50" : ""}`}>
                  <Checkbox checked={checked} onCheckedChange={(c) => toggle(gi, v.value, c === true)} />
                  {v.value || "(vazio)"} <span className="text-muted-foreground">({v.count})</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1" onClick={() => onChange([...groups, { name: `Grupo ${groups.length + 1}`, values: [] }])}>
        <Plus className="w-3.5 h-3.5" /> Novo grupo
      </Button>
      <p className="text-[11px] text-muted-foreground">Valor fora de grupo vira um grupo com o próprio nome; vazio vira "Sem classificação".</p>
    </div>
  );
}
