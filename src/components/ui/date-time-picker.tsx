import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseLocalDate, toLocalISOString } from "@/lib/dateHelpers";

interface DateTimePickerProps {
  /** ISO or local datetime string */
  value: string | null | undefined;
  /** Emits "YYYY-MM-DDTHH:mm:ss" (local wall clock, no UTC drift) */
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  size?: "sm" | "default";
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Selecionar data e hora",
  disabled,
  className,
  buttonClassName,
  size = "default",
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Date | null>(parseLocalDate(value));

  useEffect(() => {
    setPending(parseLocalDate(value));
  }, [value]);

  const commit = (date: Date) => {
    setPending(date);
    onChange(toLocalISOString(date));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const next = new Date(date);
    if (pending) {
      next.setHours(pending.getHours(), pending.getMinutes(), 0, 0);
    } else {
      next.setHours(12, 0, 0, 0);
    }
    commit(next);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    if (!time) return;
    const [h, m] = time.split(":").map(Number);
    const base = pending ?? new Date();
    const next = new Date(base);
    next.setHours(h || 0, m || 0, 0, 0);
    commit(next);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && pending) {
      const formatted = toLocalISOString(pending);
      if (formatted !== value) onChange(formatted);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal normal-case",
            !pending && "text-muted-foreground",
            buttonClassName,
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {pending
            ? format(pending, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <Calendar
          mode="single"
          selected={pending ?? undefined}
          onSelect={handleDateSelect}
          locale={ptBR}
          initialFocus
        />
        <div className="p-3 border-t border-border flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Hora</label>
          <Input
            type="time"
            value={pending ? format(pending, "HH:mm") : ""}
            onChange={handleTimeChange}
            className="h-8 w-auto text-xs"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
