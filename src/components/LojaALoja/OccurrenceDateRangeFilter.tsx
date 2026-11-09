import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface OccurrenceDateRangeFilterProps {
  from?: Date;
  to?: Date;
  onFromChange: (d: Date | undefined) => void;
  onToChange: (d: Date | undefined) => void;
  className?: string;
}

/** Seletor "Aberta de / até" para filtrar ocorrências pela data de abertura. */
export function OccurrenceDateRangeFilter({ from, to, onFromChange, onToChange, className }: OccurrenceDateRangeFilterProps) {
  const hasValue = Boolean(from || to);
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label="Data de abertura inicial"
            className={cn("h-8 justify-start text-left font-normal text-xs", !from && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-1 h-3 w-3" />
            {from ? `Aberta de ${format(from, "dd/MM/yy")}` : "Aberta de"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={from}
            onSelect={onFromChange}
            disabled={to ? (d) => d > to : undefined}
            locale={ptBR}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label="Data de abertura final"
            className={cn("h-8 justify-start text-left font-normal text-xs", !to && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-1 h-3 w-3" />
            {to ? `até ${format(to, "dd/MM/yy")}` : "até"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={to}
            onSelect={onToChange}
            disabled={from ? (d) => d < from : undefined}
            locale={ptBR}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {hasValue && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Limpar período de abertura"
          onClick={() => {
            onFromChange(undefined);
            onToChange(undefined);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export default OccurrenceDateRangeFilter;
