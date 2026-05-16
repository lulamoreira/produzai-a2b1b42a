import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, Loader2, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (deadlineDays: number) => void;
  isLoading?: boolean;
  defaultDays?: number;
}

export default function DeadlinePickerDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  defaultDays = 7,
}: Props) {
  const [days, setDays] = useState(defaultDays);

  useEffect(() => {
    if (open) setDays(defaultDays);
  }, [open, defaultDays]);

  const deadlineDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(17, 0, 0, 0);
    return d;
  }, [days]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            Prazo para resposta
          </DialogTitle>
          <DialogDescription>
            Quantos dias o fornecedor tem para enviar a recotação?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Número de dias
            </label>
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setDays((d) => Math.max(1, d - 1))}
                disabled={days <= 1 || isLoading}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <div className="min-w-[5rem] text-center">
                <div className="text-3xl font-semibold tabular-nums">{days}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {days === 1 ? 'dia' : 'dias'}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setDays((d) => Math.min(60, d + 1))}
                disabled={days >= 60 || isLoading}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex justify-center gap-1.5 pt-1">
              {[3, 5, 7, 10, 15].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDays(preset)}
                  disabled={isLoading}
                  className={`px-2 py-0.5 text-[11px] rounded-md border transition ${
                    days === preset
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Prazo de resposta
            </div>
            <div className="text-sm font-medium text-foreground">
              {format(deadlineDate, "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Respostas após o prazo continuam sendo aceitas, mas ficam marcadas como atrasadas.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(days)} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
            Confirmar prazo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
