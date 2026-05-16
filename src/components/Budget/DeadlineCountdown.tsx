import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Clock, AlertTriangle } from "lucide-react";

export function DeadlineCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const deadline = new Date(expiresAt);
  if (isNaN(deadline.getTime())) return null;

  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.floor(diffHours / 24);
  const isExpired = diffMs < 0;
  const isToday = diffDays === 0 && !isExpired;
  const isTomorrow = diffDays === 1;

  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
        <AlertTriangle className="w-3 h-3" />
        Prazo encerrado
      </span>
    );
  }
  if (isToday) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium">
        <Clock className="w-3 h-3" />
        Vence hoje às {format(deadline, "HH:mm")}
      </span>
    );
  }
  if (isTomorrow) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <Clock className="w-3 h-3" />
        Vence amanhã às {format(deadline, "HH:mm")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="w-3 h-3" />
      Vence em {diffDays} dias
    </span>
  );
}
