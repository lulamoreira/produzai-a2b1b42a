import type { ReactNode } from "react";
import { Truck, PackageCheck, RotateCw, CheckCircle2, AlertTriangle, X, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { cn } from "@/lib/utils";
import type { TimelineStep, TimelineStepKey, TratativaTimeline } from "@/lib/tratativaTimeline";
import { STEP_DOT_CLASS, STEP_LINE_CLASS, REINSTALL_BADGE } from "@/components/tratativa/timelineStyles";

/** Mesmo estilo do input "Número da OS". */
const INPUT_CLASS = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60";

const STEP_ICON: Record<TimelineStepKey, typeof Truck> = {
  sent: Truck,
  arrived: PackageCheck,
  reinstall: RotateCw,
  resolved: CheckCircle2,
};

export interface TratativaTimelineEditorProps {
  timeline: TratativaTimeline;
  disabled: boolean;
  today: string;
  sentDate: string;
  onSentDateChange: (v: string) => void;
  etaDate: string;
  onEtaDateChange: (v: string) => void;
  arrivedDate: string;
  onArrivedDateChange: (v: string) => void;
  /** "Aguardando · faltam N dias" / "Atrasado N dia(s)" enquanto a chegada está vazia. */
  arrivalCountdown: string | null;
  reinstallationDate: string;
  onReinstallationDateChange: (v: string) => void;
  reinstallationOs: string;
  onReinstallationOsChange: (v: string) => void;
  reinstallBeforeMaterial: boolean;
}

/** Linha do tempo vertical e editável da tratativa (painel interno). */
export function TratativaTimelineEditor(props: TratativaTimelineEditorProps) {
  const { timeline } = props;
  return (
    <ol className="relative" aria-label="Linha do tempo da tratativa">
      {timeline.steps.map((step, i) => (
        <TimelineRow key={step.key} step={step} isLast={i === timeline.steps.length - 1}>
          <StepBody step={step} {...props} />
        </TimelineRow>
      ))}
    </ol>
  );
}

function TimelineRow({ step, isLast, children }: { step: TimelineStep; isLast: boolean; children: ReactNode }) {
  const Icon = STEP_ICON[step.key];
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!isLast && (
        <span aria-hidden className={cn("absolute left-[13px] top-7 bottom-0 w-0.5", STEP_LINE_CLASS[step.state])} />
      )}
      <span
        className={cn(
          "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
          STEP_DOT_CLASS[step.state],
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-0.5 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-sm font-semibold", step.state === "late" ? "text-destructive" : "text-foreground")}>
            {step.label}
          </span>
          {step.badge && (
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", REINSTALL_BADGE[step.badge].className)}>
              {REINSTALL_BADGE[step.badge].label}
            </span>
          )}
        </div>
        {children}
        {step.recordedBy && <p className="text-[11px] text-muted-foreground">{step.recordedBy}</p>}
      </div>
    </li>
  );
}

function StepBody({ step, ...p }: { step: TimelineStep } & TratativaTimelineEditorProps) {
  if (step.key === "sent") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DateField label="Data do envio" value={p.sentDate} onChange={p.onSentDateChange} disabled={p.disabled} />
        <DateField label="Previsão de chegada" value={p.etaDate} onChange={p.onEtaDateChange} disabled={p.disabled} />
      </div>
    );
  }

  if (step.key === "arrived") {
    if (p.arrivedDate) {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-foreground">Chegou em {step.dateLabel}</span>
          {!p.disabled && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => p.onArrivedDateChange("")}>
              <X className="h-3 w-3" aria-hidden /> Limpar
            </Button>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {p.arrivalCountdown && (
          <p className={cn("text-xs font-medium", step.state === "late" ? "text-destructive" : "text-muted-foreground")}>
            {p.arrivalCountdown}
          </p>
        )}
        <div className="flex items-end gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 gap-1.5"
            disabled={p.disabled}
            onClick={() => p.onArrivedDateChange(p.today)}
          >
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden /> Confirmar chegada hoje
          </Button>
          <div className="w-full sm:w-44">
            <DateField label="Ou escolha a data" value={p.arrivedDate} onChange={p.onArrivedDateChange} disabled={p.disabled} max={p.today} />
          </div>
        </div>
      </div>
    );
  }

  if (step.key === "reinstall") {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Data e horário da reinstalação</label>
            <DateTimePicker
              value={p.reinstallationDate}
              onChange={p.onReinstallationDateChange}
              disabled={p.disabled}
              buttonClassName="h-9"
              clearable
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Número da OS</label>
            <input
              type="text"
              value={p.reinstallationOs}
              onChange={(e) => p.onReinstallationOsChange(e.target.value)}
              disabled={p.disabled}
              placeholder="Ex: OS-2024-001"
              className={INPUT_CLASS}
            />
          </div>
        </div>
        {p.reinstallBeforeMaterial && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive" role="alert">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            A reinstalação está marcada antes da chegada do material.
          </p>
        )}
      </div>
    );
  }

  // resolved — só leitura
  return (
    <p className="text-xs text-muted-foreground">
      {step.state === "done" ? (step.dateLabel ? `Resolvida em ${step.dateLabel}` : "Resolvida") : "Ainda não resolvida"}
    </p>
  );
}

function DateField({
  label,
  value,
  onChange,
  disabled,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  max?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground mb-1 block">{label}</span>
      <input
        type="date"
        value={value}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={INPUT_CLASS}
      />
    </label>
  );
}
