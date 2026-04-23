import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type PhotoPhase = "before" | "during" | "after";

interface PhasePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (phase: PhotoPhase) => void;
}

const PHASES: { value: PhotoPhase; label: string; classes: string }[] = [
  {
    value: "before",
    label: "Antes",
    classes: "bg-blue-500 hover:bg-blue-600 text-white border-blue-500",
  },
  {
    value: "during",
    label: "Durante",
    classes: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500",
  },
  {
    value: "after",
    label: "Depois",
    classes: "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500",
  },
];

export default function PhasePickerDialog({ open, onOpenChange, onSelect }: PhasePickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Qual é o momento desta foto?</DialogTitle>
          <DialogDescription>
            Escolha em que fase da instalação esta(s) foto(s) foi(ram) tirada(s).
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
          {PHASES.map((phase) => (
            <Button
              key={phase.value}
              type="button"
              variant="outline"
              className={`min-h-[56px] text-sm font-semibold ${phase.classes}`}
              onClick={() => onSelect(phase.value)}
            >
              {phase.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
