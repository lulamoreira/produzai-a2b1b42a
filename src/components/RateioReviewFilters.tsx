import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FINDING_TYPE_LABELS, type RateioFindingSeverity, type RateioFindingType } from "@/lib/reviewRateio";
import { ALL, EMPTY_FILTERS, hasActiveFilters, type FindingFilters } from "@/lib/rateioReviewView";
import { SEV_LABEL } from "@/components/rateioReviewStyles";

export interface RateioReviewFiltersProps {
  value: FindingFilters;
  onChange: (next: FindingFilters) => void;
  /** Tipos presentes na revisão (as opções do filtro de tipo). */
  types: RateioFindingType[];
  shown: number;
  total: number;
}

/** Busca e filtros da lista (só exibição; contadores do topo e PDF usam o total real). */
export function RateioReviewFilters({ value, onChange, types, shown, total }: RateioReviewFiltersProps) {
  const active = hasActiveFilters(value);
  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
          <Input
            value={value.query}
            onChange={(e) => onChange({ ...value, query: e.target.value })}
            placeholder="Buscar item, código ou loja"
            aria-label="Buscar por nome do item, código ou loja"
            className="pl-8 h-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={value.severity} onValueChange={(v) => onChange({ ...value, severity: v as RateioFindingSeverity | typeof ALL })}>
            <SelectTrigger className="h-9 sm:w-32" aria-label="Filtrar por severidade"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[70]">
              <SelectItem value={ALL}>Todas</SelectItem>
              {(["alta", "media", "baixa"] as const).map((s) => <SelectItem key={s} value={s}>{SEV_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={value.type} onValueChange={(v) => onChange({ ...value, type: v as RateioFindingType | typeof ALL })}>
            <SelectTrigger className="h-9 sm:w-52" aria-label="Filtrar por tipo de apontamento"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[70]">
              <SelectItem value={ALL}>Todos os tipos</SelectItem>
              {types.map((t) => <SelectItem key={t} value={t}>{FINDING_TYPE_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span aria-live="polite">{shown} de {total} apontamentos</span>
        {active ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onChange(EMPTY_FILTERS)}>
            <X className="w-3.5 h-3.5" /> Limpar filtros
          </Button>
        ) : null}
      </div>
    </div>
  );
}
