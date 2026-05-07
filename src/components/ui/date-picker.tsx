import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseLocalDate, formatLocalDate } from "@/lib/dateHelpers";

interface DatePickerProps {
  /** Value as YYYY-MM-DD (preferred) or ISO string */
  value: string | null | undefined;
  /** Emits YYYY-MM-DD */
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  size?: "sm" | "default";
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecionar data",
  disabled,
  className,
  buttonClassName,
  size = "default",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Date | null>(parseLocalDate(value));

  useEffect(() => {
    setPending(parseLocalDate(value));
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    setPending(date);
    onChange(formatLocalDate(date));
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && pending) {
      const formatted = formatLocalDate(pending);
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
          {pending ? format(pending, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <Calendar
          mode="single"
          selected={pending ?? undefined}
          onSelect={handleSelect}
          locale={ptBR}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
